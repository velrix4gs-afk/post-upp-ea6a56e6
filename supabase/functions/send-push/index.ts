// Sends a push notification to a user's registered Android/iOS devices via
// Firebase Cloud Messaging's HTTP v1 API (the legacy server-key API is being
// retired by Google, so this signs its own OAuth token from a service
// account instead of using a static server key).
//
// Called two ways:
//  1. Internally, by the `notify_push_on_notification` Postgres trigger
//     (via pg_net) right after a row is inserted into `notifications`.
//  2. Directly, with { user_id, title, body, data } for ad-hoc pushes.
//
// Requires the FIREBASE_SERVICE_ACCOUNT secret: the full JSON contents of a
// Firebase service account key (Project settings -> Service accounts ->
// Generate new private key), stored as a single-line JSON string secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

const base64url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const importPrivateKey = async (pem: string) => {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
};

/** Mints a short-lived OAuth2 access token for the FCM HTTP v1 API from the service account (cached for its lifetime). */
const getAccessToken = async (sa: ServiceAccount): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) return cachedAccessToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claims)}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedAccessToken = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return json.access_token;
};

const sendToToken = async (sa: ServiceAccount, accessToken: string, token: string, title: string, body: string, data: Record<string, string>) => {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: "high", notification: { channel_id: "default", sound: "default" } },
      },
    }),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? null : await res.text() };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saRaw) return json({ error: "FIREBASE_SERVICE_ACCOUNT is not configured" }, 500);
    const sa: ServiceAccount = JSON.parse(saRaw);

    const payload = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    let userId: string | undefined = payload.user_id;
    let title = payload.title as string | undefined;
    let body = payload.body as string | undefined;
    let data: Record<string, string> = payload.data ?? {};

    // Trigger path: only a notification_id is handed in, so look up the real row
    // ourselves rather than trusting a caller-supplied title/body.
    if (payload.notification_id) {
      const { data: n } = await db.from("notifications").select("*").eq("id", payload.notification_id).maybeSingle();
      if (!n) return json({ ok: true, skipped: "notification not found" });
      userId = n.user_id;
      title = n.title ?? "POST UP";
      body = n.content ?? "";
      data = { type: String(n.type ?? ""), notification_id: String(n.id), ...(n.data ?? {}) };
    }

    if (!userId || !title) return json({ error: "user_id/notification_id and title are required" }, 400);

    const { data: tokens } = await db.from("device_tokens").select("token, platform").eq("user_id", userId);
    if (!tokens || tokens.length === 0) return json({ ok: true, skipped: "no registered devices" });

    const accessToken = await getAccessToken(sa);
    const results = await Promise.all(
      tokens.map((t) => sendToToken(sa, accessToken, t.token, title!, body ?? "", Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])))),
    );

    // Drop tokens FCM says are no longer registered (app uninstalled, token rotated).
    const dead = tokens.filter((_, i) => !results[i].ok && results[i].status === 404);
    if (dead.length) {
      await db.from("device_tokens").delete().eq("user_id", userId).in("token", dead.map((d) => d.token));
    }

    return json({ ok: true, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  } catch (e) {
    console.error("send-push error:", e);
    return json({ error: "Unexpected error" }, 500);
  }
});

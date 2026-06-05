// Edge function: server-side bridge to an Upstash-compatible Redis REST API.
//
// SECURITY:
//   - Credentials (REDIS_URL, REDIS_TOKEN) MUST be set as Supabase edge
//     function secrets. They are NEVER returned to the client.
//   - All requests require a valid Supabase JWT.
//   - Cache keys are namespaced per-user so one user cannot read another
//     user's cached blob.
//   - Operations are restricted to a small allowlist (get/set/del).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function userKey(userId: string, key: string): string {
  // Prevent path traversal / accidental namespace bleed.
  const safe = key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 128);
  return `u:${userId}:${safe}`;
}

async function redis(command: string[]): Promise<unknown> {
  const url = Deno.env.get("REDIS_URL");
  const token = Deno.env.get("REDIS_TOKEN");
  if (!url || !token) {
    throw new Error("Redis bridge not configured");
  }
  const res = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Redis HTTP ${res.status}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error("Redis error");
  return json.result ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: userErr } = await supa.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const op = String(body.op ?? "").toLowerCase();
    const key = typeof body.key === "string" ? body.key : "";
    if (!key) {
      return new Response(JSON.stringify({ error: "key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const scoped = userKey(user.id, key);

    let result: unknown = null;
    if (op === "get") {
      result = await redis(["GET", scoped]);
    } else if (op === "set") {
      const value = typeof body.value === "string"
        ? body.value
        : JSON.stringify(body.value);
      const ttl = Number(body.ttl ?? 0);
      const cmd = ttl > 0
        ? ["SET", scoped, value, "EX", String(ttl)]
        : ["SET", scoped, value];
      result = await redis(cmd);
    } else if (op === "del") {
      result = await redis(["DEL", scoped]);
    } else {
      return new Response(JSON.stringify({ error: "unsupported op" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("redis-bridge error", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

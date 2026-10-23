import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_INBOX = Deno.env.get("SUPPORT_INBOX") ?? "POSTUPPOFFICIAL@GMAIL.COM";
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { ticketId } = await req.json();
    if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) return json({ error: "Bad ticket id" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: t } = await db.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
    // Only freshly created, not-yet-emailed tickets can trigger an email, so this can't be used to spam the inbox.
    if (!t || t.emailed_at || Date.now() - new Date(t.created_at).getTime() > 10 * 60 * 1000) return json({ ok: true, skipped: true });

    let who = "Guest (not signed in)";
    if (t.user_id) {
      const { data: p } = await db.from("profiles").select("username, display_name").eq("id", t.user_id).maybeSingle();
      who = p ? `${p.display_name || ""} (@${p.username}) — ${t.user_id}` : t.user_id;
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "RESEND_API_KEY is not configured" }, 500);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("SUPPORT_FROM") ?? "POST UP Support <onboarding@resend.dev>",
        to: [SUPPORT_INBOX],
        subject: `[POST UP ${t.kind}] ${String(t.subject).slice(0, 120)}`,
        html: `<p><b>From:</b> ${esc(who)}</p><p><b>Type:</b> ${esc(t.kind)}</p><p><b>Subject:</b> ${esc(t.subject)}</p><hr><p style="white-space:pre-wrap">${esc(t.message)}</p><hr><p style="color:#888">Ticket ${esc(t.id)} · ${esc(t.created_at)}</p>`,
      }),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return json({ error: "Email provider rejected the message" }, 502);
    }
    await db.from("support_tickets").update({ emailed_at: new Date().toISOString() }).eq("id", ticketId);
    return json({ ok: true });
  } catch (e) {
    console.error("notify-support-ticket error:", e);
    return json({ error: "Unexpected error" }, 500);
  }
});

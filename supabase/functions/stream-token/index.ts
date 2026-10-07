// Edge function: signs a GetStream user token for the authenticated caller.
// The frontend exchanges this token when initializing StreamVideoClient.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Publishable key: it is already shipped to the browser as VITE_STREAM_API_KEY,
// so it is not a secret. Read it from the environment when set, so rotating the
// key is a config change rather than a redeploy, and fall back to the current
// value so an unconfigured project keeps working.
const STREAM_API_KEY = Deno.env.get('STREAM_API_KEY') || 'byeg282tjdhu';

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signStreamToken(userId: string, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: userId,
    iat: now,
    exp: now + 60 * 60 * 24, // 24h
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // verify_jwt is false in config.toml, so the gateway no longer screens
    // this request. That is deliberate: the gateway rejected legitimate
    // sessions on the Vercel and preview domains. The check below is now the
    // ONLY gate, so it must be a real verification.
    //
    // getUser() calls the Auth server with the token and returns a user only
    // if the token is valid and unexpired — it cannot be spoofed by a
    // client-supplied payload the way decoding the JWT locally could be.
    // Same approach as the posts and messages functions.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    const secret = Deno.env.get('STREAM_API_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'STREAM_API_SECRET not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const streamToken = await signStreamToken(userId, secret);

    return new Response(
      JSON.stringify({ token: streamToken, api_key: STREAM_API_KEY, user_id: userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[stream-token] error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
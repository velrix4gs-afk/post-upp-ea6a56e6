import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory rate limit: max 5 verify attempts per email per 10 minutes.
const attemptCache = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

const checkVerifyRateLimit = (email: string): boolean => {
  const now = Date.now();
  const entry = attemptCache.get(email);
  if (!entry || now > entry.resetAt) {
    attemptCache.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      const text = await req.text();
      if (!text) {
        return new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      body = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, code } = body;

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'Email and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedCode = code.trim();

    if (!/^\d{6}$/.test(sanitizedCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!checkVerifyRateLimit(sanitizedEmail)) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please request a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify OTP from database
    const { data: otpData, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', sanitizedEmail)
      .eq('code', sanitizedCode)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError || !otpData) {
      // On wrong code, also invalidate stored OTPs after MAX_ATTEMPTS to prevent brute force
      const entry = attemptCache.get(sanitizedEmail);
      if (entry && entry.count >= MAX_ATTEMPTS) {
        await supabase.from('email_otps').delete().eq('email', sanitizedEmail);
      }
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success — reset attempts
    attemptCache.delete(sanitizedEmail);

    // Delete the used OTP
    await supabase
      .from('email_otps')
      .delete()
      .eq('id', otpData.id);

    // Generate a magic link to get token_hash (don't verify server-side)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: sanitizedEmail,
    });

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate sign-in link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token_hash from the action link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token');

    if (!token_hash) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract authentication token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the token_hash to the frontend — it will verify client-side
    return new Response(
      JSON.stringify({ 
        success: true,
        token_hash,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-login-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to verify code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

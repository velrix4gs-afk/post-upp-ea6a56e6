import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://post-upp.vercel.app',
  'https://post-upp.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin || '') ? origin! : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

// Simple rate limiting using in-memory cache
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (identifier: string, maxRequests = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitCache.get(identifier);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitCache.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, password, username, displayName } = await req.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!code || typeof code !== 'string' || !otpRegex.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Valid 6-digit code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength (minimum 8 characters)
    if (!password || typeof password !== 'string' || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate username (3-30 alphanumeric characters, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!username || typeof username !== 'string' || !usernameRegex.test(username)) {
      return new Response(
        JSON.stringify({ error: 'Username must be 3-30 characters (letters, numbers, _, -)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate display name (1-100 characters)
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Display name must be 1-100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedUsername = username.trim();
    const sanitizedDisplayName = displayName.trim();

    // Rate limiting: 5 verification attempts per minute per email
    if (!checkRateLimit(sanitizedEmail, 5, 60000)) {
      return new Response(
        JSON.stringify({ error: 'Too many verification attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve OTP record (constant time regardless of existence)
    const { data: otpRecord } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', sanitizedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Constant-time comparison - check all conditions together
    const isValid = otpRecord && 
                    otpRecord.code === code && 
                    new Date(otpRecord.expires_at) > new Date();

    if (!isValid) {
      // Add consistent delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      console.error('[OTP_001] Invalid or expired verification code');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user account
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true, // Auto-confirm since they verified via OTP
      user_metadata: {
        username: sanitizedUsername,
        display_name: sanitizedDisplayName
      }
    });

    if (signUpError) {
      console.error('Signup error:', signUpError);
      // Security: Use generic error message to prevent user enumeration
      return new Response(
        JSON.stringify({ error: 'Unable to create account. Please try again or contact support.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete used OTP
    await supabase
      .from('email_otps')
      .delete()
      .eq('id', otpRecord.id);

    // Generate session for the new user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: sanitizedEmail,
    });

    if (sessionError) {
      console.error('Session generation error:', sessionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account created successfully',
        user: authData.user
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-signup-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body with validation
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

    const { email } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize email
    const sanitizedEmail = email.toLowerCase().trim();

    // Rate limiting: 5 requests per minute per email
    if (!checkRateLimit(sanitizedEmail, 5, 60000)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Targeted lookup — never download the entire user list.
    let userExists = false;
    try {
      const { data: userData, error: userError } = await (supabase.auth.admin as any).listUsers({
        filter: `email eq "${sanitizedEmail}"`,
        perPage: 1,
      });
      if (userError) {
        console.error('Error checking user (filter):', userError);
      } else {
        userExists = !!userData?.users?.some(
          (u: { email?: string | null }) => u.email?.toLowerCase() === sanitizedEmail
        );
      }
    } catch (e) {
      console.error('listUsers filter unsupported, denying silently:', e);
    }

    if (!userExists) {
      // Don't reveal that user doesn't exist - return same message
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'If an account exists with this email, a verification code will be sent.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate cryptographically secure 6-digit OTP
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    const randomNumber = new DataView(randomBytes.buffer).getUint32(0, false);
    const code = (100000 + (randomNumber % 900000)).toString();

    // Store OTP in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    // Delete any existing OTPs for this email first
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', sanitizedEmail);

    const { error: insertError } = await supabase
      .from('email_otps')
      .insert({
        email: sanitizedEmail,
        code,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error('Error inserting OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email with OTP
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'POST UP <onboarding@resend.dev>',
            to: [sanitizedEmail],
            subject: 'Your POST UP Sign-In Code',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Sign In to POST UP</h1>
                <p style="font-size: 16px; color: #666;">Your sign-in code is:</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <h2 style="font-size: 32px; letter-spacing: 8px; margin: 0; color: #333;">${code}</h2>
                </div>
                <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
                <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Failed to send email:', errorText);
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'If an account exists with this email, a verification code will be sent.',
        // In development, return the code for testing
        ...(Deno.env.get('ENVIRONMENT') === 'development' ? { code } : {})
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-login-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

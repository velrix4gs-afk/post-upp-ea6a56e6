import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://post-upp.vercel.app',
  'https://post-upp.lovable.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
];

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

interface EmailUpdateRequest {
  new_email: string;
}

interface PasswordUpdateRequest {
  new_password: string;
}

// Rate limiting storage (simple in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (ip: string, maxRequests = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const url = new URL(req.url);
    const method = req.method;

    // PUT /auth-settings/email - Update email
    if (method === 'PUT' && url.pathname.includes('/email')) {
      const body: EmailUpdateRequest = await req.json();
      
      // Input validation
      if (!body.new_email || typeof body.new_email !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid email' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.new_email)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      const { data, error } = await supabaseClient.auth.updateUser({
        email: body.new_email,
      });

      if (error) {
        console.error('Email update error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update email. Please try again.' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email update confirmation sent to both old and new email addresses'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // PUT /auth-settings/password - Update password
    if (method === 'PUT' && url.pathname.includes('/password')) {
      const body: PasswordUpdateRequest = await req.json();
      
      // Input validation
      if (!body.new_password || typeof body.new_password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (body.new_password.length < 8) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 8 characters' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      const { data, error } = await supabaseClient.auth.updateUser({
        password: body.new_password,
      });

      if (error) {
        console.error('Password update error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update password. Please try again.' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // POST /auth-settings/reset-password - Send password reset email
    if (method === 'POST' && url.pathname.includes('/reset-password')) {
      const body: { email: string } = await req.json();
      
      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(
        body.email,
        {
          redirectTo: `${Deno.env.get('SITE_URL')}/reset-password`,
        }
      );

      if (error) {
        console.error('Password reset error:', error);
        // Security: Always return success to prevent email enumeration
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Password reset email sent'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in auth-settings function:', error);
    // Security: Don't expose internal error details
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req.headers.get('origin')) } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the request is from an authorized source
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is already an admin
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    const body = await req.json();
    const { email, password, bootstrap_secret } = body;

    // Non-admins may only proceed when a valid bootstrap secret is provided AND
    // a server-configured ADMIN_BOOTSTRAP_SECRET exists. This prevents any
    // authenticated user from self-promoting to admin when adminCount is 0.
    if (!existingRoles) {
      const configuredSecret = Deno.env.get('ADMIN_BOOTSTRAP_SECRET');
      if (!configuredSecret || !bootstrap_secret || bootstrap_secret !== configuredSecret) {
        throw new Error('Only admins can create official accounts');
      }
    }

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Create the official account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: 'postupp_official',
        display_name: 'Post Upp Official'
      }
    });

    if (createError || !newUser.user) {
      throw createError || new Error('Failed to create user');
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        username: 'postupp_official',
        display_name: 'Post Upp Official',
        is_verified: true,
        bio: 'Official Post Upp account for platform announcements and updates.'
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw profileError;
    }

    // Grant admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'admin'
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      throw roleError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Official account created successfully',
        userId: newUser.user.id,
        email: newUser.user.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

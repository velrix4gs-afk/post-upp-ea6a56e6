import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const ALLOWED_ORIGINS = [
  'https://post-upp.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin || '') ? origin! : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

// Validation schemas
const profileUpdateSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username format').optional(),
  display_name: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().max(2000).optional().nullable(),
  cover_url: z.string().url().max(2000).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')),
  birth_date: z.string().max(20).optional().nullable(),
  relationship_status: z.string().max(50).optional().nullable(),
  theme_color: z.string().max(20).regex(/^#[0-9a-fA-F]{3,8}$/, 'Invalid color format').optional().nullable(),
  is_private: z.boolean().optional(),
  gender: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).regex(/^\+?[0-9\s-()]+$/, 'Invalid phone format').optional().nullable().or(z.literal('')),
  occupation: z.string().max(100).optional().nullable(),
  interests: z.array(z.string().max(50)).max(20).optional().nullable(),
}).strict();

const settingsUpdateSchema = z.object({
  notification_messages: z.boolean().optional(),
  notification_friend_requests: z.boolean().optional(),
  notification_post_reactions: z.boolean().optional(),
  privacy_who_can_message: z.enum(['everyone', 'friends', 'nobody']).optional(),
  privacy_who_can_view_profile: z.enum(['everyone', 'friends', 'nobody']).optional(),
}).strict();

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const supabaseAnonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    const {
      data: { user },
      error: authError,
    } = await supabaseAnonClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const url = new URL(req.url);
    const method = req.method;

    // GET /profiles - Get user profile
    if (method === 'GET' && !url.pathname.includes('/settings')) {
      const userIdParam = url.searchParams.get('user_id');
      // Validate user_id if provided
      if (userIdParam) {
        const uuidResult = z.string().uuid().safeParse(userIdParam);
        if (!uuidResult.success) {
          return new Response(
            JSON.stringify({ error: 'Invalid user_id format' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
      const userId = userIdParam || user.id;

      const { data: card, error: cardError } = await supabaseClient.rpc('get_profile_card', {
        p_id: userId,
      });
      const profile = Array.isArray(card) ? card[0] : card;

      if (cardError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const payload: Record<string, unknown> = { ...profile };
      delete payload.phone;
      delete payload.birth_date;
      delete payload.gender;

      if (userId === user.id) {
        const { data: own } = await supabaseClient
          .from('profiles')
          .select('phone, birth_date, gender')
          .eq('id', user.id)
          .maybeSingle();
        if (own) {
          payload.phone = own.phone ?? null;
          payload.birth_date = own.birth_date ?? null;
          payload.gender = own.gender ?? null;
        }
      }

      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // PUT /profiles/settings - Update user settings (check before general PUT)
    if (method === 'PUT' && url.pathname.includes('/settings')) {
      const body = await req.json();
      const parsed = settingsUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid settings data', details: parsed.error.flatten() }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      const { data, error } = await supabaseClient
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update settings' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // PUT /profiles - Update user profile
    if (method === 'PUT') {
      const body = await req.json();
      const parsed = profileUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid profile data', details: parsed.error.flatten() }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update profile' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET /profiles/settings - Get user settings
    if (method === 'GET' && url.pathname.includes('/settings')) {
      const { data: settings, error } = await supabaseClient
        .from('settings_view')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch settings' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in profiles function:', error);
    return new Response(
      JSON.stringify({ error: 'Operation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req.headers.get('origin')) } }
    );
  }
};

serve(handler);

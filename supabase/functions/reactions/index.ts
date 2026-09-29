import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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

// Validation schema
const reactionSchema = z.object({
  target_id: z.string().uuid('Invalid target_id format'),
  target_type: z.enum(['post', 'comment', 'message'], { message: 'target_type must be post, comment, or message' }),
  reaction_type: z.string().min(1).max(50, 'Reaction type too long'),
});

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabaseAnonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      const parsed = reactionSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.flatten(),
          code: 'VALIDATION_ERROR',
          message: 'Invalid reaction data'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { target_id, reaction_type } = parsed.data;

      // Check if reaction already exists
      const { data: existingReaction } = await supabaseClient
        .from('post_reactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('post_id', target_id)
        .single();

      if (existingReaction) {
        if (existingReaction.reaction_type === reaction_type) {
          // Remove reaction
          const { error } = await supabaseClient
            .from('post_reactions')
            .delete()
            .eq('id', existingReaction.id);

          if (error) throw error;

          return new Response(JSON.stringify({ 
            action: 'removed', 
            reaction_type,
            code: 'SUCCESS',
            message: 'Reaction removed successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Update reaction type
          const { data: reaction, error } = await supabaseClient
            .from('post_reactions')
            .update({ reaction_type })
            .eq('id', existingReaction.id)
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify({ 
            action: 'updated', 
            reaction,
            code: 'SUCCESS',
            message: 'Reaction updated successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Create new reaction
        const { data: reaction, error } = await supabaseClient
          .from('post_reactions')
          .insert({
            user_id: user.id,
            post_id: target_id,
            reaction_type
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ 
          action: 'created', 
          reaction,
          code: 'SUCCESS',
          message: 'Reaction created successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reactions API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request',
      code: 'INTERNAL_ERROR',
      message: 'Failed to process reaction'
    }), {
      status: 400,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify authentication and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate the JWT and get the user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: role } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[SCHEDULE_001] Publishing scheduled posts...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get all scheduled posts that are ready to publish
    const now = new Date().toISOString();
    const { data: scheduledPosts, error: fetchError } = await supabaseClient
      .from('posts')
      .select('*')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now)
      .eq('privacy', 'scheduled'); // Assuming scheduled posts have a special privacy setting

    if (fetchError) {
      console.error('[SCHEDULE_002] Error fetching scheduled posts:', fetchError);
      throw fetchError;
    }

    console.log(`[SCHEDULE_003] Found ${scheduledPosts?.length || 0} posts to publish`);

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No scheduled posts to publish',
        count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Publish each post by updating privacy to public
    const publishedIds = [];
    for (const post of scheduledPosts) {
      const { error: updateError } = await supabaseClient
        .from('posts')
        .update({ 
          privacy: 'public',
          scheduled_for: null 
        })
        .eq('id', post.id);

      if (updateError) {
        console.error(`[SCHEDULE_004] Error publishing post ${post.id}:`, updateError);
      } else {
        console.log(`[SCHEDULE_005] Successfully published post ${post.id}`);
        publishedIds.push(post.id);

        // Create notification for the post author
        await supabaseClient.from('notifications').insert({
          user_id: post.user_id,
          type: 'post',
          title: 'Post Published',
          content: 'Your scheduled post has been published',
          data: { post_id: post.id }
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: `Published ${publishedIds.length} scheduled posts`,
      count: publishedIds.length,
      published_ids: publishedIds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SCHEDULE_ERROR] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'An unexpected error occurred',
      code: 'SCHEDULE_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

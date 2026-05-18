import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const ALLOWED_ORIGINS = [
  'https://post-upp.lovable.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

// Validation schemas
const createPostSchema = z.object({
  content: z.string().max(5000, 'Content must be less than 5000 characters').optional(),
  media_url: z.string().url('Invalid media URL').max(500).optional(),
  media_type: z.enum(['image', 'video']).optional(),
  location: z.string().max(200).optional(),
  tagged_users: z.array(z.string().uuid()).max(50, 'Maximum 50 users can be tagged').optional(),
  hashtags: z.array(z.string().max(50)).max(30, 'Maximum 30 hashtags').optional(),
  privacy: z.enum(['public', 'friends', 'private']).default('public'),
}).refine(
  (data) => data.content || data.media_url,
  'Post must have either content or media'
);

const deletePostSchema = z.object({
  action: z.literal('delete'),
  postId: z.string().uuid('Invalid post ID'),
});

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client with service role for database operations
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
    
    // Create anon client for auth verification
    const supabaseAnonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const method = req.method;
    const url = new URL(req.url);
    
    // For GET requests, auth is optional (public feed)
    let user = null;
    if (method !== 'GET') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Authorization required');
      }
      
      const { data: { user: authUser }, error: userError } = await supabaseAnonClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userError || !authUser) {
        throw new Error('Invalid or expired token');
      }
      user = authUser;
    }

    // Parse body for non-GET requests
    let body: any = {};
    if (method !== 'GET') {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        throw new Error('Invalid request body');
      }
    }

    console.log(`Posts API: ${method} ${url.pathname}`);

    if (method === 'GET') {
      // Get posts feed — only public, non-deleted posts for unauth/general feed.
      // Anything more sensitive must go through an authenticated path that
      // respects RLS instead of using the service-role client.
      const { data: posts, error } = await supabaseClient
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('privacy', 'public')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get reactions for each post
      const postsWithReactions = await Promise.all(
        (posts || []).map(async (post) => {
          const { data: reactions } = await supabaseClient
            .from('post_reactions')
            .select('*')
            .eq('post_id', post.id);

          return {
            ...post,
            reactions: reactions || [],
            likes_count: reactions?.filter(r => r.reaction_type === 'like').length || 0,
            comments_count: post.comments_count || 0,
            shares_count: 0
          };
        })
      );

      return new Response(JSON.stringify(postsWithReactions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      if (!user) throw new Error('User not authenticated');

      // Check if this is a delete action
      if (body.action === 'delete') {
        try {
          const validated = deletePostSchema.parse(body);
          console.log('Deleting post:', validated.postId, 'for user:', user.id);

          // First check if post exists and belongs to user
          const { data: existingPost, error: checkError } = await supabaseClient
            .from('posts')
            .select('id, user_id')
            .eq('id', validated.postId)
            .eq('user_id', user.id)
            .single();

          if (checkError || !existingPost) {
            return new Response(
              JSON.stringify({ error: 'Post not found or unauthorized' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Delete the post
          const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', validated.postId)
            .eq('user_id', user.id);

          if (error) {
            console.error('Error deleting post:', error);
            throw error;
          }

          console.log('Post deleted successfully:', validated.postId);

          return new Response(JSON.stringify({ success: true, message: 'Post deleted successfully' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Invalid input', details: e.issues }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw e;
        }
      }

      // Regular post creation - validate input
      try {
        const validated = createPostSchema.parse(body);
        console.log('Creating post with validated data:', validated);

        const { data: post, error } = await supabaseClient
          .from('posts')
          .insert({
            user_id: user.id,
            content: validated.content,
            media_url: validated.media_url,
            media_type: validated.media_type,
            privacy: validated.privacy
          })
          .select(`
            *,
            profiles:user_id (
              username,
              display_name,
              avatar_url,
              is_verified
            )
          `)
          .single();

        if (error) throw error;

        // Create notification for tagged users
        if (validated.tagged_users && validated.tagged_users.length > 0) {
          const notifications = validated.tagged_users.map((taggedUserId: string) => ({
            user_id: taggedUserId,
            type: 'mention',
            title: 'You were tagged in a post',
            content: `${post.profiles.display_name} tagged you in a post`,
            data: { post_id: post.id, user_id: user.id }
          }));

          await supabaseClient.from('notifications').insert(notifications);
        }

        return new Response(JSON.stringify(post), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        if (e instanceof z.ZodError) {
          return new Response(
            JSON.stringify({ error: 'Invalid input', details: e.issues }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    if (method === 'PUT') {
      if (!user) throw new Error('User not authenticated');
      const { postId, content, media_url, media_type, privacy } = body;

      const { data: post, error } = await supabaseClient
        .from('posts')
        .update({
          content,
          media_url,
          media_type,
          privacy
        })
        .eq('id', postId)
        .eq('user_id', user.id) // Ensure user owns the post
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(post), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE') {
      if (!user) throw new Error('User not authenticated');
      const { postId } = body;
      console.log('Deleting post:', postId, 'for user:', user.id);

      if (!postId) {
        throw new Error('Post ID is required');
      }

      // First check if post exists and belongs to user
      const { data: existingPost, error: checkError } = await supabaseClient
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (checkError) {
        console.error('Error checking post:', checkError);
        throw new Error('Post not found or you do not have permission to delete it');
      }

      if (!existingPost) {
        throw new Error('Post not found or you do not have permission to delete it');
      }

      // Delete the post
      const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting post:', error);
        throw error;
      }

      console.log('Post deleted successfully:', postId);

      return new Response(JSON.stringify({ success: true, message: 'Post deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Posts API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
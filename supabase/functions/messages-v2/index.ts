import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
const sendMessageSchema = z.object({
  action: z.literal('send'),
  chat_id: z.string().uuid(),
  content: z.string().max(5000).optional(),
  media_url: z.string().url().optional(),
  media_type: z.string().optional(),
  reply_to: z.string().uuid().optional(),
}).refine(data => data.content || data.media_url, {
  message: "Message must have either content or media"
});

const editMessageSchema = z.object({
  action: z.literal('edit'),
  messageId: z.string().uuid(),
  content: z.string().max(5000).min(1),
});

const deleteMessageSchema = z.object({
  action: z.literal('delete'),
  messageId: z.string().uuid(),
  deleteFor: z.enum(['me', 'everyone']).optional(),
});

const reactSchema = z.object({
  action: z.literal('react'),
  messageId: z.string().uuid(),
  reactionType: z.string().min(1).max(50),
});

const markReadSchema = z.object({
  action: z.literal('mark_read'),
  messageId: z.string().uuid(),
});

// Rate limiting cache (simple in-memory cache)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (userId: string, maxRequests = 30, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitCache.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitCache.set(userId, { count: 1, resetAt: now + windowMs });
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
    
    const supabaseAnonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabaseAnonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    if (!checkRateLimit(user.id, 30, 60000)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method !== 'GET' ? await req.json() : {};
    const action = body.action;

    console.log(`Messages API: ${req.method} - Action: ${action}`);

    // List chats
    if (action === 'list_chats' || (req.method === 'POST' && !body.chat_id && !body.messageId)) {
      const { data: participantChats, error } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const chatIds = participantChats?.map(p => p.chat_id) || [];
      
      if (chatIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error: chatsError } = await supabaseClient
        .from('chats')
        .select(`id, name, avatar_url, type, created_at`)
        .in('id', chatIds)
        .order('created_at', { ascending: false });

      if (chatsError) throw chatsError;

      const chatsWithParticipants = await Promise.all(
        (data || []).map(async (chat) => {
          const { data: participants } = await supabaseClient
            .from('chat_participants')
            .select(`user_id, role, joined_at, profiles:user_id (username, display_name, avatar_url)`)
            .eq('chat_id', chat.id);

          return {
            ...chat,
            is_group: chat.type === 'group',
            created_by: '',
            updated_at: chat.created_at,
            participants: participants?.map(p => ({
              user_id: p.user_id,
              role: p.role,
              joined_at: p.joined_at,
              profiles: p.profiles
            })) || []
          };
        })
      );

      return new Response(JSON.stringify(chatsWithParticipants), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch messages
    if (body.chat_id && !action) {
      const { data: membership, error: memErr } = await supabaseClient
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', body.chat_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (memErr) throw memErr;
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Not a participant in this chat' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: messages, error } = await supabaseClient
        .from('messages')
        .select(`
          *,
          sender:sender_id (username, display_name, avatar_url),
          reply_to_message:reply_to (id, content, sender:sender_id (display_name))
        `)
        .eq('chat_id', body.chat_id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify(messages || []), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send message
    if (action === 'send') {
      const validated = sendMessageSchema.parse(body);

      // Verify user is participant
      const { data: participant } = await supabaseClient
        .from('chat_participants')
        .select('*')
        .eq('chat_id', validated.chat_id)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        return new Response(JSON.stringify({ error: 'Not a participant in this chat' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: message, error } = await supabaseClient
        .from('messages')
        .insert({
          chat_id: validated.chat_id,
          sender_id: user.id,
          content: validated.content,
          media_url: validated.media_url,
          media_type: validated.media_type,
          reply_to: validated.reply_to,
          status: 'sent'
        })
        .select(`*, sender:sender_id (username, display_name, avatar_url)`)
        .single();

      if (error) throw error;

      // Update chat timestamp
      await supabaseClient
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', validated.chat_id);

      // Create notifications
      const { data: participants } = await supabaseClient
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', validated.chat_id)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const notifications = participants.map(p => ({
          user_id: p.user_id,
          type: 'message',
          title: 'New message',
          content: validated.content || 'Sent a media file',
          data: { chat_id: validated.chat_id, message_id: message.id, sender_id: user.id }
        }));

        await supabaseClient.from('notifications').insert(notifications);
      }

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Edit message
    if (action === 'edit') {
      const validated = editMessageSchema.parse(body);

      const { data: message, error } = await supabaseClient
        .from('messages')
        .update({ content: validated.content, is_edited: true })
        .eq('id', validated.messageId)
        .eq('sender_id', user.id)
        .select(`*, sender:sender_id (username, display_name, avatar_url)`)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete message
    if (action === 'delete') {
      const validated = deleteMessageSchema.parse(body);

      if (validated.deleteFor === 'everyone') {
        const { error } = await supabaseClient
          .from('messages')
          .delete()
          .eq('id', validated.messageId)
          .eq('sender_id', user.id);

        if (error) throw error;
      } else {
        const { data: message, error: fetchError } = await supabaseClient
          .from('messages')
          .select('deleted_for, chat_id')
          .eq('id', validated.messageId)
          .single();

        if (fetchError) throw fetchError;

        const { data: membership } = await supabaseClient
          .from('chat_participants')
          .select('chat_id')
          .eq('chat_id', message.chat_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!membership) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const deletedFor = message.deleted_for || [];
        if (!deletedFor.includes(user.id)) {
          deletedFor.push(user.id);
        }

        const { error } = await supabaseClient
          .from('messages')
          .update({ deleted_for: deletedFor })
          .eq('id', validated.messageId);

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // React to message
    if (action === 'react') {
      const validated = reactSchema.parse(body);

      const { data: srcMsg } = await supabaseClient
        .from('messages')
        .select('chat_id')
        .eq('id', validated.messageId)
        .maybeSingle();
      if (!srcMsg) {
        return new Response(JSON.stringify({ error: 'Message not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: reactMembership } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('chat_id', srcMsg.chat_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!reactMembership) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existing } = await supabaseClient
        .from('message_reactions')
        .select('id')
        .eq('message_id', validated.messageId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseClient
          .from('message_reactions')
          .update({ reaction_type: validated.reactionType })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('message_reactions')
          .insert({
            message_id: validated.messageId,
            user_id: user.id,
            reaction_type: validated.reactionType
          });

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove reaction
    if (action === 'unreact') {
      const { error } = await supabaseClient
        .from('message_reactions')
        .delete()
        .eq('message_id', body.messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Star/unstar message
    if (action === 'star' || action === 'unstar') {
      const { data: starMsg } = await supabaseClient
        .from('messages')
        .select('chat_id')
        .eq('id', body.messageId)
        .maybeSingle();
      if (!starMsg) {
        return new Response(JSON.stringify({ error: 'Message not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: starMembership } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('chat_id', starMsg.chat_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!starMembership) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'star') {
        const { error } = await supabaseClient
          .from('starred_messages')
          .insert({ user_id: user.id, message_id: body.messageId });

        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabaseClient
          .from('starred_messages')
          .delete()
          .eq('user_id', user.id)
          .eq('message_id', body.messageId);

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward message
    if (action === 'forward') {
      const { data: originalMessage, error: fetchError } = await supabaseClient
        .from('messages')
        .select('content, media_url, media_type, chat_id')
        .eq('id', body.messageId)
        .single();

      if (fetchError) throw fetchError;

      // Verify caller is participant in the SOURCE chat
      const { data: srcMembership } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('chat_id', originalMessage.chat_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!srcMembership) {
        return new Response(JSON.stringify({ error: 'Forbidden: not a participant in source chat' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const toChatIds: string[] = Array.isArray(body.toChatIds) ? body.toChatIds : [];
      if (toChatIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No target chats provided' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify caller is a participant in every target chat
      const { data: memberships, error: memErr } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id)
        .in('chat_id', toChatIds);
      if (memErr) throw memErr;
      const allowed = new Set((memberships || []).map((m: any) => m.chat_id));
      const unauthorized = toChatIds.filter((id) => !allowed.has(id));
      if (unauthorized.length > 0) {
        return new Response(JSON.stringify({ error: 'Not a participant in one or more target chats', unauthorized }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const forwardedMessages = toChatIds.map((chatId: string) => ({
        chat_id: chatId,
        sender_id: user.id,
        content: originalMessage.content,
        media_url: originalMessage.media_url,
        media_type: originalMessage.media_type,
        is_forwarded: true,
        forwarded_from_message_id: body.messageId
      }));

      const { error } = await supabaseClient
        .from('messages')
        .insert(forwardedMessages);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark message as read
    if (action === 'mark_read') {
      const validated = markReadSchema.parse(body);

      const { error } = await supabaseClient
        .from('message_reads')
        .insert({ message_id: validated.messageId, user_id: user.id });

      if (error && error.code !== '23505') throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Messages API Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        error: 'Validation error',
        details: error.issues[0].message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
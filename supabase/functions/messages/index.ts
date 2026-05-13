import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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

// Validation schemas
const uuidSchema = z.string().uuid();

const sendMessageSchema = z.object({
  action: z.literal('send'),
  chat_id: uuidSchema,
  content: z.string().max(5000).optional(),
  media_url: z.string().url().max(2000).optional(),
  media_type: z.enum(['image', 'video', 'audio', 'file']).optional(),
  reply_to: uuidSchema.optional().nullable(),
}).refine(data => data.content || data.media_url, {
  message: 'Must have content or media',
});

const editMessageSchema = z.object({
  action: z.literal('edit'),
  messageId: uuidSchema,
  content: z.string().min(1).max(5000),
});

const deleteMessageSchema = z.object({
  action: z.literal('delete'),
  messageId: uuidSchema,
  deleteFor: z.enum(['me', 'everyone']).optional(),
});

const reactMessageSchema = z.object({
  action: z.literal('react'),
  messageId: uuidSchema,
  reactionType: z.string().min(1).max(50),
});

const unreactMessageSchema = z.object({
  action: z.literal('unreact'),
  messageId: uuidSchema,
});

const starMessageSchema = z.object({
  action: z.enum(['star', 'unstar']),
  messageId: uuidSchema,
});

const forwardMessageSchema = z.object({
  action: z.literal('forward'),
  messageId: uuidSchema,
  toChatIds: z.array(uuidSchema).min(1).max(20),
});

const markReadSchema = z.object({
  action: z.literal('mark_read'),
  messageId: uuidSchema,
});

const typingSchema = z.object({
  action: z.literal('typing'),
  chatId: uuidSchema,
  isTyping: z.boolean(),
});

const fetchMessagesSchema = z.object({
  chat_id: uuidSchema,
  action: z.undefined().optional(),
});

const listChatsSchema = z.object({
  action: z.literal('list_chats').optional(),
}).passthrough();

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

    const method = req.method;
    const body = method !== 'GET' ? await req.json() : {};
    const action = body.action;

    // Handle list chats action
    if (action === 'list_chats' || (method === 'POST' && !body.chat_id && !body.messageId)) {
      const { data: participantChats, error: participantError } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const chatIds = participantChats?.map(p => p.chat_id) || [];
      
      if (chatIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabaseClient
        .from('chats')
        .select(`id, name, avatar_url, type, created_at`)
        .in('id', chatIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

    // Handle fetch messages action
    if (body.chat_id && !action) {
      const parsed = fetchMessagesSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: messages, error } = await supabaseClient
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', parsed.data.chat_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!messages) {
        return new Response(JSON.stringify({ error: 'Not a participant in this chat' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: messagesData, error: msgErr } = await supabaseClient
        .from('messages')
        .select(`*, sender:sender_id (username, display_name, avatar_url), reply_to_message:reply_to (id, content, sender:sender_id (display_name))`)
        .eq('chat_id', parsed.data.chat_id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (msgErr) throw msgErr;

      return new Response(JSON.stringify(messagesData || []), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle send message action
    if (action === 'send') {
      const parsed = sendMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid message data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { chat_id, content, media_url, media_type, reply_to } = parsed.data;

      // Verify user is participant in the chat
      const { data: participant } = await supabaseClient
        .from('chat_participants')
        .select('*')
        .eq('chat_id', chat_id)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        return new Response(JSON.stringify({ error: 'Not a participant in this chat' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: message, error } = await supabaseClient
        .from('messages')
        .insert({
          chat_id,
          sender_id: user.id,
          content,
          media_url,
          media_type,
          reply_to
        })
        .select(`*, sender:sender_id (username, display_name, avatar_url)`)
        .single();

      if (error) throw error;

      await supabaseClient
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chat_id);

      const { data: participants } = await supabaseClient
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat_id)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const notifications = participants.map(p => ({
          user_id: p.user_id,
          type: 'message',
          title: 'New message',
          content: content || 'Sent a media file',
          data: { chat_id, message_id: message.id, sender_id: user.id }
        }));
        await supabaseClient.from('notifications').insert(notifications);
      }

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle edit message action
    if (action === 'edit') {
      const parsed = editMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid edit data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: message, error } = await supabaseClient
        .from('messages')
        .update({ content: parsed.data.content, is_edited: true })
        .eq('id', parsed.data.messageId)
        .eq('sender_id', user.id)
        .select(`*, sender:sender_id (username, display_name, avatar_url)`)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(message), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle delete message action
    if (action === 'delete') {
      const parsed = deleteMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid delete data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (parsed.data.deleteFor === 'everyone') {
        const { error } = await supabaseClient
          .from('messages')
          .delete()
          .eq('id', parsed.data.messageId)
          .eq('sender_id', user.id);
        if (error) throw error;
      } else {
        const { data: message, error: fetchError } = await supabaseClient
          .from('messages')
          .select('deleted_for')
          .eq('id', parsed.data.messageId)
          .single();
        if (fetchError) throw fetchError;

        const deletedFor = message.deleted_for || [];
        if (!deletedFor.includes(user.id)) {
          deletedFor.push(user.id);
        }
        const { error } = await supabaseClient
          .from('messages')
          .update({ deleted_for: deletedFor })
          .eq('id', parsed.data.messageId);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle react to message
    if (action === 'react') {
      const parsed = reactMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid reaction data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existing } = await supabaseClient
        .from('message_reactions')
        .select('id')
        .eq('message_id', parsed.data.messageId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseClient
          .from('message_reactions')
          .update({ reaction_type: parsed.data.reactionType })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('message_reactions')
          .insert({
            message_id: parsed.data.messageId,
            user_id: user.id,
            reaction_type: parsed.data.reactionType
          });
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle remove reaction
    if (action === 'unreact') {
      const parsed = unreactMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabaseClient
        .from('message_reactions')
        .delete()
        .eq('message_id', parsed.data.messageId)
        .eq('user_id', user.id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle star/unstar message
    if (action === 'star' || action === 'unstar') {
      const parsed = starMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'star') {
        const { error } = await supabaseClient
          .from('starred_messages')
          .insert({ user_id: user.id, message_id: parsed.data.messageId });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabaseClient
          .from('starred_messages')
          .delete()
          .eq('user_id', user.id)
          .eq('message_id', parsed.data.messageId);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle forward message
    if (action === 'forward') {
      const parsed = forwardMessageSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid forward data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: originalMessage, error: fetchError } = await supabaseClient
        .from('messages')
        .select('content, media_url, media_type')
        .eq('id', parsed.data.messageId)
        .single();
      if (fetchError) throw fetchError;

      // Verify caller is a participant in every target chat
      const { data: memberships, error: memErr } = await supabaseClient
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id)
        .in('chat_id', parsed.data.toChatIds);
      if (memErr) throw memErr;
      const allowed = new Set((memberships || []).map((m: any) => m.chat_id));
      const unauthorized = parsed.data.toChatIds.filter((id) => !allowed.has(id));
      if (unauthorized.length > 0) {
        return new Response(JSON.stringify({ error: 'Not a participant in one or more target chats', unauthorized }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const forwardedMessages = parsed.data.toChatIds.map((chatId) => ({
        chat_id: chatId,
        sender_id: user.id,
        content: originalMessage.content,
        media_url: originalMessage.media_url,
        media_type: originalMessage.media_type,
        is_forwarded: true,
        forwarded_from_message_id: parsed.data.messageId
      }));

      const { error } = await supabaseClient.from('messages').insert(forwardedMessages);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle mark message as read
    if (action === 'mark_read') {
      const parsed = markReadSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabaseClient
        .from('message_reads')
        .insert({ message_id: parsed.data.messageId, user_id: user.id });
      if (error && error.code !== '23505') throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle typing indicator
    if (action === 'typing') {
      const parsed = typingSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid data', details: parsed.error.flatten() }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabaseClient
        .from('typing_status')
        .upsert({
          chat_id: parsed.data.chatId,
          user_id: user.id,
          is_typing: parsed.data.isTyping,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Messages API Error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request' }), {
      status: 400,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    });
  }
});

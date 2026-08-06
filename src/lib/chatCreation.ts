import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for opening/creating a 1:1 chat.
 *
 * Why this exists: several call sites inserted into `chats` without
 * `created_by`/`creator_id`. The INSERT passes RLS, but the follow-up
 * `.select()` matches no SELECT policy (no participants exist yet, and
 * `created_by` is null) so PostgREST returns "no rows" and the whole
 * flow crashes. Setting both ownership columns keeps INSERT + SELECT valid.
 */
export const ensurePrivateChat = async (
  userId: string,
  otherUserId: string
): Promise<string> => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId) || !uuidRegex.test(otherUserId)) {
    throw new Error('Invalid user id');
  }
  if (userId === otherUserId) {
    throw new Error('Cannot start a chat with yourself');
  }

  // 1) Reuse an existing DM when there is one.
  const { data: existingId } = await supabase.rpc('find_private_chat', {
    p_user_a: userId,
    p_user_b: otherUserId,
  });
  if (existingId) return existingId as unknown as string;

  // 2) Create the chat with explicit ownership so RLS SELECT succeeds.
  const now = new Date().toISOString();
  const { data: newChat, error: chatError } = await supabase
    .from('chats')
    .insert({
      type: 'private',
      created_by: userId,
      creator_id: userId,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (chatError || !newChat) {
    throw new Error(chatError?.message || 'Could not create conversation');
  }

  // 3) Add both participants. Insert self first so participant-scoped
  //    policies see us as a member for the second row.
  const { error: selfError } = await supabase
    .from('chat_participants')
    .insert({ chat_id: newChat.id, user_id: userId, role: 'admin' });
  if (selfError) {
    await supabase.from('chats').delete().eq('id', newChat.id);
    throw new Error(selfError.message);
  }

  const { error: otherError } = await supabase
    .from('chat_participants')
    .insert({ chat_id: newChat.id, user_id: otherUserId, role: 'member' });
  if (otherError) {
    await supabase.from('chats').delete().eq('id', newChat.id);
    throw new Error(otherError.message);
  }

  return newChat.id as string;
};

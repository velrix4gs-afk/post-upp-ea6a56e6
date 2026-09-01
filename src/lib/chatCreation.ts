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

  // Find-or-create happens server side in one transaction (SECURITY DEFINER),
  // so a failure can never leave a half-created chat behind.
  const { data, error } = await supabase.rpc('ensure_private_chat', {
    p_other_user: otherUserId,
  });

  if (error) {
    throw new Error(error.message || 'Could not create conversation');
  }

  const chatId = (Array.isArray(data) ? data[0] : data) as string | null;
  if (!chatId) {
    throw new Error('Could not create conversation');
  }

  return chatId;
};

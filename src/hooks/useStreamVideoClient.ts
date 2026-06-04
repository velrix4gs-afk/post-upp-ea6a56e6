import { useEffect, useState } from 'react';
import { StreamVideoClient, type User as StreamUser } from '@stream-io/video-react-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Module-level singleton so multiple call components share one client.
let clientPromise: Promise<StreamVideoClient> | null = null;
let cachedClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;

async function getOrCreateClient(
  userId: string,
  displayName: string,
  avatar?: string,
): Promise<StreamVideoClient> {
  if (cachedClient && cachedUserId === userId) return cachedClient;
  if (clientPromise && cachedUserId === userId) return clientPromise;

  cachedUserId = userId;
  clientPromise = (async () => {
    const { data, error } = await supabase.functions.invoke('stream-token');
    if (error || !data?.token || !data?.api_key) {
      throw new Error(error?.message || 'Failed to fetch Stream token');
    }
    const user: StreamUser = {
      id: userId,
      name: displayName,
      image: avatar,
    };
    const client = new StreamVideoClient({
      apiKey: data.api_key as string,
      user,
      token: data.token as string,
    });
    cachedClient = client;
    return client;
  })();
  return clientPromise;
}

export function useStreamVideoClient() {
  const { user } = useAuth();
  const [client, setClient] = useState<StreamVideoClient | null>(cachedClient);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const displayName =
      (user.user_metadata as any)?.display_name ||
      (user.user_metadata as any)?.username ||
      user.email ||
      'User';
    const avatar = (user.user_metadata as any)?.avatar_url;
    getOrCreateClient(user.id, displayName, avatar)
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e as Error);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { client, error };
}

// Deterministic call id from a chatId so both participants join the same call.
export function callIdForChat(chatId: string, kind: 'voice' | 'video') {
  return `${kind}-${chatId}`.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64);
}
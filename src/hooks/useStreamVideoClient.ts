import { useCallback, useEffect, useState } from 'react';
import { StreamVideoClient, type User as StreamUser } from '@stream-io/video-react-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Module-level singleton so multiple call components share one client.
let clientPromise: Promise<StreamVideoClient> | null = null;
let cachedClient: StreamVideoClient | null = null;
let cachedUserId: string | null = null;

export function describeStreamCallError(error: unknown, action: string): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/not authorized|unauthori[sz]ed|permission denied|\b40[13]\b/i.test(message)) {
    return `Stream did not authorize this ${action}. Verify the Stream API key and secret belong to the same app and that the deployed token function uses that secret. (${message})`;
  }
  return message || `Could not ${action}.`;
}

async function getOrCreateClient(
  userId: string,
  displayName: string,
  avatar?: string,
): Promise<StreamVideoClient> {
  if (cachedClient && cachedUserId === userId) return cachedClient;
  if (clientPromise && cachedUserId === userId) return clientPromise;

  if (cachedClient && cachedUserId !== userId) {
    const previousClient = cachedClient;
    cachedClient = null;
    void previousClient.disconnectUser().catch((error) => {
      console.error('[Stream] Failed to disconnect previous user', error);
    });
  }

  cachedUserId = userId;
  const pendingClient = (async () => {
    const { data, error } = await supabase.functions.invoke('stream-token');
    if (error) {
      const status = error.context instanceof Response ? error.context.status : undefined;
      const failureBody = error.context instanceof Response
        ? await error.context.clone().json().catch(() => null)
        : null;
      if (status === 404) {
        throw new Error('Call service is not deployed. Deploy the Supabase stream-token function and try again.');
      }
      if (status === 401 || status === 403) {
        throw new Error('Supabase did not authorize the call-token request. Refresh your sign-in session and verify the function JWT settings.');
      }
      throw new Error(failureBody?.error || error.message || 'Could not retrieve call credentials.');
    }
    if (!data?.token || !data?.api_key) {
      throw new Error(data?.error || 'Call service returned an incomplete token response.');
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
    return client;
  })();
  clientPromise = pendingClient;

  try {
    const client = await pendingClient;
    if (clientPromise === pendingClient) cachedClient = client;
    return client;
  } catch (error) {
    if (clientPromise === pendingClient) {
      clientPromise = null;
      cachedUserId = null;
    }
    throw error;
  }
}

export function useStreamVideoClient() {
  const { user } = useAuth();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    setClient(null);
    setError(null);
    if (!user?.id) {
      const previousClient = cachedClient;
      cachedClient = null;
      cachedUserId = null;
      clientPromise = null;
      if (previousClient) {
        void previousClient.disconnectUser().catch((disconnectError) => {
          console.error('[Stream] Failed to disconnect client on sign out', disconnectError);
        });
      }
      return;
    }
    let cancelled = false;
    const metadata = user.user_metadata as Record<string, unknown>;
    const displayName =
      (typeof metadata.display_name === 'string' && metadata.display_name) ||
      (typeof metadata.username === 'string' && metadata.username) ||
      user.email ||
      'User';
    const avatar = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined;
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
  }, [user?.id, user?.email, user?.user_metadata, retryVersion]);

  const retry = useCallback(() => {
    const previousClient = cachedClient;
    cachedClient = null;
    cachedUserId = null;
    clientPromise = null;
    if (previousClient) {
      void previousClient.disconnectUser().catch((disconnectError) => {
        console.error('[Stream] Failed to disconnect client before retry', disconnectError);
      });
    }
    setClient(null);
    setError(null);
    setRetryVersion((version) => version + 1);
  }, []);

  return { client, error, retry, retryVersion };
}

// Deterministic call id from a chatId so both participants join the same call.
export function callIdForChat(chatId: string, kind: 'voice' | 'video') {
  return `${kind}-${chatId}`.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64);
}
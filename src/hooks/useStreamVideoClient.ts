import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StreamVideoClient, type User as StreamUser } from '@stream-io/video-react-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface StreamVideoClientState {
  client: StreamVideoClient | null;
  error: Error | null;
  retry: () => void;
  userId: string | null;
}

const StreamVideoClientContext = createContext<StreamVideoClientState | null>(null);

export function describeStreamCallError(error: unknown, action: string): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/not authorized|unauthori[sz]ed|permission denied|\b40[13]\b/i.test(message)) {
    return `Stream did not authorize this ${action}. Verify this deployment's origin is enabled for the Stream app and that the signed-in user has call permissions. (${message})`;
  }
  return message || `Could not ${action}.`;
}

export const StreamVideoClientProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; client: StreamVideoClient | null; error: Error | null }>({
    userId: null,
    client: null,
    error: null,
  });
  const [retryVersion, setRetryVersion] = useState(0);
  const generationRef = useRef(0);
  const clientRef = useRef<StreamVideoClient | null>(null);

  const disconnectOwnedClient = useCallback(() => {
    const previous = clientRef.current;
    clientRef.current = null;
    if (previous) {
      void previous.disconnectUser().catch((error) => {
        console.error('[Stream] Failed to disconnect client', error);
      });
    }
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    const previous = clientRef.current;
    clientRef.current = null;
    if (previous) {
      void previous.disconnectUser().catch((error) => {
        console.error('[Stream] Failed to disconnect previous user', error);
      });
    }
    setState({ userId, client: null, error: null });
    if (!userId || !user) return;

    let cancelled = false;
    const metadata = user.user_metadata as Record<string, unknown>;
    const displayName =
      (typeof metadata.display_name === 'string' && metadata.display_name) ||
      (typeof metadata.username === 'string' && metadata.username) ||
      user.email ||
      'User';
    const avatar = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined;

    const loadClient = async () => {
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
      if (cancelled || generationRef.current !== generation) return;

      const streamUser: StreamUser = { id: userId, name: displayName, image: avatar };
      const client = new StreamVideoClient({
        apiKey: data.api_key as string,
        user: streamUser,
        token: data.token as string,
      });
      clientRef.current = client;
      setState({ userId, client, error: null });
    };

    void loadClient().catch((error: unknown) => {
      if (!cancelled && generationRef.current === generation) {
        setState({ userId, client: null, error: error instanceof Error ? error : new Error(String(error)) });
      }
    });

    return () => {
      cancelled = true;
      if (generationRef.current === generation) generationRef.current++;
      const owned = clientRef.current;
      if (owned) {
        clientRef.current = null;
        void owned.disconnectUser().catch((error) => {
          console.error('[Stream] Failed to disconnect client on lifecycle cleanup', error);
        });
      }
    };
  }, [userId, retryVersion]);

  const retry = useCallback(() => {
    generationRef.current++;
    disconnectOwnedClient();
    setState({ userId, client: null, error: null });
    setRetryVersion((version) => version + 1);
  }, [disconnectOwnedClient, userId]);

  const value = useMemo(() => ({ ...state, retry }), [state, retry]);
  return createElement(StreamVideoClientContext.Provider, { value }, children);
};

export function useStreamVideoClient() {
  const context = useContext(StreamVideoClientContext);
  const { user } = useAuth();
  if (!context) throw new Error('useStreamVideoClient must be used within StreamVideoClientProvider');
  const matchesUser = context.userId === (user?.id ?? null);
  return {
    client: matchesUser ? context.client : null,
    error: matchesUser ? context.error : null,
    retry: context.retry,
  };
}

export function callIdForChat(chatId: string, kind: 'voice' | 'video') {
  return `${kind}-${chatId}`.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64);
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AI_CHAT_URL = `https://ccyyxkjpgebjnstevgkw.supabase.co/functions/v1/ai-chat`;
const HISTORY_KEY_PREFIX = 'postup_ai_chat_history_';
const HISTORY_LIMIT = 100;

const loadHistory = (userId: string | null): AIMessage[] => {
  try {
    const key = `${HISTORY_KEY_PREFIX}${userId || 'anon'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<AIMessage, 'timestamp'> & { timestamp: string }>;
    return parsed
      .filter((message) =>
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        typeof message.timestamp === 'string' &&
        Number.isFinite(new Date(message.timestamp).getTime())
      )
      .map((message) => ({ ...message, timestamp: new Date(message.timestamp) }));
  } catch {
    return [];
  }
};

const saveHistory = (userId: string | null, messages: AIMessage[]): boolean => {
  try {
    const key = `${HISTORY_KEY_PREFIX}${userId || 'anon'}`;
    const trimmed = messages.slice(-HISTORY_LIMIT);
    localStorage.setItem(key, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
};

export const useAIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const userId = user?.id || null;
  const userIdRef = useRef<string | null>(userId);
  const messagesRef = useRef<AIMessage[]>([]);
  const hydratedUserIdRef = useRef<string | null | undefined>(undefined);

  // The database is the source of truth; local history is an offline fallback
  // and is migrated once when a user's server-side history is still empty.
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    userIdRef.current = userId;
    hydratedUserIdRef.current = undefined;

    (async () => {
      const localHistory = loadHistory(userId);
      if (!userId) {
        if (!cancelled) {
          messagesRef.current = localHistory;
          setMessages(localHistory);
          hydratedUserIdRef.current = null;
          setHistoryLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;
      if (error) {
        console.error('Could not load AI chat history:', error);
        toast({
          title: 'AI history could not sync',
          description: 'Showing history saved on this device.',
          variant: 'destructive',
        });
        messagesRef.current = localHistory;
        setMessages(localHistory);
        hydratedUserIdRef.current = userId;
        setHistoryLoading(false);
        return;
      }

      let history: AIMessage[] = [...(data || [])].reverse().map((message) => ({
        id: message.id,
        role: message.role as AIMessage['role'],
        content: message.content,
        timestamp: new Date(message.created_at),
      }));

      if (history.length === 0 && localHistory.length > 0) {
        const { data: migrated, error: migrationError } = await supabase
          .from('ai_chat_messages')
          .insert(localHistory.map(({ role, content, timestamp }) => ({
            user_id: userId,
            role,
            content,
            created_at: timestamp.toISOString(),
          })))
          .select('id, role, content, created_at');
        if (migrationError) {
          console.error('Could not migrate local AI chat history:', migrationError);
          toast({
            title: 'AI history could not sync',
            description: 'Your previous conversation remains available on this device.',
            variant: 'destructive',
          });
          history = localHistory;
        } else {
          history = (migrated || []).map((message) => ({
            id: message.id,
            role: message.role as AIMessage['role'],
            content: message.content,
            timestamp: new Date(message.created_at),
          }));
        }
      }

      if (!cancelled) {
        messagesRef.current = history;
        setMessages(history);
        hydratedUserIdRef.current = userId;
        setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Keep an offline copy so history remains usable through temporary outages.
  useEffect(() => {
    if (hydratedUserIdRef.current !== userId) return;
    messagesRef.current = messages;
    if (!saveHistory(userId, messages)) {
      console.error('Could not save AI chat history to this device.');
    }
  }, [messages, userId]);

  const persistMessage = useCallback(async (message: AIMessage) => {
    if (!userIdRef.current) return;
    try {
      const { error } = await supabase.from('ai_chat_messages').insert({
        user_id: userIdRef.current,
        role: message.role,
        content: message.content,
        created_at: message.timestamp.toISOString(),
      });
      if (error) throw error;
    } catch (error) {
      console.error('Could not save AI chat history to the server:', error);
      toast({
        title: 'AI history is only saved on this device',
        description: 'Reconnect or try again later to sync this conversation.',
        variant: 'destructive',
      });
    }
  }, []);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;
    if (historyLoading || !userIdRef.current) {
      toast({
        title: 'Sign in to use AI chat',
        description: 'Your conversation history is saved to your account.',
        variant: 'destructive',
      });
      return;
    }

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    };

    const chatHistory = messagesRef.current.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => {
      const next = [...prev, userMsg].slice(-HISTORY_LIMIT);
      messagesRef.current = next;
      return next;
    });
    void persistMessage(userMsg);
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Please sign in to use AI chat');
      }

      const response = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [...chatHistory, { role: 'user', content: userMessage.trim() }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      let assistantContent = '';
      const contentType = response.headers.get('content-type') || '';
      const isStream = contentType.includes('text/event-stream');

      if (isStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setStreamingContent(assistantContent);
              }
            } catch {
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }
      } else {
        // Non-streaming JSON response (Google direct, or fallback shape)
        const data = await response.json();
        assistantContent =
          data.choices?.[0]?.message?.content ||
          data.choices?.[0]?.delta?.content ||
          data.content ||
          data.message ||
          '';
        if (assistantContent) setStreamingContent(assistantContent);
      }

      if (!assistantContent) {
        throw new Error('Empty response from AI');
      }

      // Add final assistant message
      const assistantMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg].slice(-HISTORY_LIMIT);
        messagesRef.current = next;
        return next;
      });
      void persistMessage(assistantMsg);
      setStreamingContent('');
    } catch (error) {
      console.error('AI chat error:', error);
      toast({
        title: 'AI Error',
        description: error instanceof Error ? error.message : 'Failed to get response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [historyLoading, persistMessage]);

  const clearHistory = useCallback(async () => {
    if (isLoading) return;
    const currentUserId = userIdRef.current;
    if (currentUserId) {
      const { error } = await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('user_id', currentUserId);
      if (error) {
        console.error('Could not clear AI chat history:', error);
        toast({ title: 'Could not clear AI history', variant: 'destructive' });
        return;
      }
    }
    messagesRef.current = [];
    setMessages([]);
    setStreamingContent('');
    try {
      localStorage.removeItem(`${HISTORY_KEY_PREFIX}${currentUserId || 'anon'}`);
    } catch (error) {
      console.error('Could not clear local AI chat history:', error);
    }
  }, [isLoading]);

  return {
    messages,
    historyLoading,
    isLoading,
    streamingContent,
    sendMessage,
    clearHistory,
  };
};

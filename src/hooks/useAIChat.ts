import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
};

const saveHistory = (userId: string | null, messages: AIMessage[]) => {
  try {
    const key = `${HISTORY_KEY_PREFIX}${userId || 'anon'}`;
    const trimmed = messages.slice(-HISTORY_LIMIT);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — silently ignore
  }
};

export const useAIChat = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const userIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount (per-user)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id || null;
      if (cancelled) return;
      userIdRef.current = uid;
      const history = loadHistory(uid);
      if (history.length > 0) setMessages(history);
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change (after hydration)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveHistory(userIdRef.current, messages);
  }, [messages]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Please sign in to use AI chat');
      }

      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

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

      setMessages(prev => [...prev, assistantMsg]);
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
  }, [messages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    try {
      const key = `${HISTORY_KEY_PREFIX}${userIdRef.current || 'anon'}`;
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, []);

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearHistory,
  };
};

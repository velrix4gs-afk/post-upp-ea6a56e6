import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, Trash2, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { useAIChat, AIMessage } from '@/hooks/useAIChat';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

/** Routes the assistant is allowed to link to (must exist in App.tsx). */
const STATIC_ROUTES = [
  '/feed', '/explore', '/search', '/reels', '/messages', '/friends', '/bookmarks',
  '/pages', '/premium', '/purchases', '/settings', '/onboarding',
  '/create/story', '/create/reel', '/create/page', '/verification', '/analytics',
  '/starred-messages', '/chat-media', '/chat-settings', '/instructions', '/dashboard', '/help-support',
];
const DYNAMIC_ROUTES = [/^\/profile\/[^/]+$/, /^\/post\/[^/]+$/, /^\/hashtag\/[^/]+$/, /^\/page\/[^/]+$/, /^\/creator\/[^/]+$/];

const isRealRoute = (path: string) => {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return STATIC_ROUTES.includes(clean) || DYNAMIC_ROUTES.some((r) => r.test(clean));
};

/**
 * Renders the handful of markdown bits AI replies actually use
 * (**bold**, *italic*, `code`, "- " bullets) as real formatting instead
 * of showing the raw asterisks/backticks. Intentionally not a full
 * markdown parser — just enough to make chat replies look normal.
 */
const renderInlineMarkdown = (line: string, keyPrefix: string) => {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.9em] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
};

const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (bulletMatch) {
      return (
        <span key={i} className="flex gap-1.5">
          <span className="select-none">•</span>
          <span>{renderInlineMarkdown(bulletMatch[1], `l${i}`)}</span>
        </span>
      );
    }
    return (
      <span key={i} className="block">
        {renderInlineMarkdown(line, `l${i}`)}
      </span>
    );
  });
};

/** Parses `[[go:/route|Label]]` action links out of an assistant reply. */
const parseNavActions = (content: string) => {
  const actions: { path: string; label: string }[] = [];
  const text = content.replace(/\[\[go:([^|\]]+)\|([^\]]+)\]\]/g, (_m, path, label) => {
    const p = String(path).trim();
    if (isRealRoute(p)) actions.push({ path: p, label: String(label).trim() });
    return '';
  });
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), actions };
};


interface AIAssistantChatProps {
  isAdmin?: boolean;
  onBack?: () => void;
}

export const AIAssistantChat = ({ isAdmin = false, onBack }: AIAssistantChatProps) => {
  const [inputValue, setInputValue] = useState('');
  // isAdmin is now validated server-side - client just uses it for UI display
  const { messages, historyLoading, isLoading, streamingContent, sendMessage, clearHistory } = useAIChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (message: AIMessage) => {
    const isUser = message.role === 'user';
    const { text, actions } = isUser
      ? { text: message.content, actions: [] as { path: string; label: string }[] }
      : parseNavActions(message.content);

    return (
      <div
        key={message.id}
        className={cn(
          'flex gap-3 mb-4',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        {!isUser && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src="https://ccyyxkjpgebjnstevgkw.supabase.co/storage/v1/object/public/avatars/IMG-20250412-WA0017.jpg" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={cn(
            'max-w-[80%] rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md'
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{renderFormattedText(text)}</p>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {actions.map((action) => (
                <Button
                  key={`${action.path}-${action.label}`}
                  size="sm"
                  variant="secondary"
                  className="h-8 rounded-full text-xs"
                  onClick={() => navigate(action.path)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          <span className={cn(
            'text-[10px] mt-1 block',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {format(message.timestamp, 'h:mm a')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground">
            {isAdmin ? 'Admin AI Assistant' : 'Post Up AI'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Summarize requests & analyze feedback' : 'Your helpful companion'}
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearHistory}
            disabled={isLoading}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {historyLoading
                ? <Loader2 className="h-8 w-8 text-primary animate-spin" />
                : <Sparkles className="h-8 w-8 text-primary" />}
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">
              {historyLoading ? 'Loading your conversation…' : isAdmin ? 'Admin AI Assistant' : 'Hi there! 👋'}
            </h3>
            {!historyLoading && <p className="text-sm text-muted-foreground max-w-xs">
              {isAdmin
                ? 'I can help you summarize user feedback, analyze reports, and identify trends.'
                : "I'm here to help you navigate Post Up. Ask me anything!"}
            </p>}
          </div>
        )}

        {messages.map(renderMessage)}

        {/* Streaming response */}
        {streamingContent && (
          <div className="flex gap-3 mb-4">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-muted">
              <p className="text-sm whitespace-pre-wrap break-words">
                {renderFormattedText(parseNavActions(streamingContent).text)}
              </p>
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <div className="flex gap-3 mb-4">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isAdmin ? 'Ask about user feedback...' : 'Ask me anything...'}
            disabled={historyLoading || isLoading}
            className="flex-1 text-[16px]"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || historyLoading || isLoading}
            size="icon"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
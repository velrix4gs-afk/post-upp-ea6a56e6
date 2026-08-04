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

/** Parses `[[go:/route|Label]]` action links out of an assistant reply. */
const parseNavActions = (content: string) => {
  const actions: { path: string; label: string }[] = [];
  const text = content.replace(/\[\[go:([^|\]]+)\|([^\]]+)\]\]/g, (_m, path, label) => {
    actions.push({ path: String(path).trim(), label: String(label).trim() });
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
  const { messages, isLoading, streamingContent, sendMessage, clearHistory } = useAIChat();
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
          <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
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
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">
              {isAdmin ? 'Admin AI Assistant' : 'Hi there! 👋'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {isAdmin
                ? 'I can help you summarize user feedback, analyze reports, and identify trends.'
                : "I'm here to help you navigate Post Up. Ask me anything!"}
            </p>
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
                {parseNavActions(streamingContent).text}
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
            disabled={isLoading}
            className="flex-1 text-[16px]"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
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

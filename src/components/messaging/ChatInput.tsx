import { useEffect, useRef } from 'react';
import { Plus, Smile, Send, Mic, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  onAttachClick: () => void;
  onCameraClick?: () => void;
  onMicClick: () => void;
  onEmojiClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  hasMedia?: boolean;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  onTyping,
  onAttachClick,
  onCameraClick,
  onMicClick,
  onEmojiClick,
  disabled,
  placeholder = 'Message',
  isEditing,
  onCancelEdit,
  hasMedia,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (1-5 lines)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 22;
    const maxHeight = lineHeight * 5;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || hasMedia) onSend();
    }
  };

  const hasContent = value.trim().length > 0 || hasMedia;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (hasContent) onSend();
      }}
      data-chat-input
      className="flex items-end gap-1.5 px-2 py-2 bg-card"
    >
      {isEditing && onCancelEdit && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onCancelEdit}
          className="h-9 w-9 rounded-full text-destructive tap-scale flex-shrink-0"
          aria-label="Cancel edit"
        >
          <X className="h-5 w-5" />
        </Button>
      )}

      {!isEditing && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onAttachClick}
          className="h-9 w-9 rounded-full hover:bg-muted tap-scale flex-shrink-0"
          aria-label="Attach"
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      <div
        className={cn(
          'flex-1 flex items-end gap-1 bg-muted/50 rounded-3xl px-3 py-1.5 border border-border/40 transition-all duration-200',
          'focus-within:border-primary/50 focus-within:bg-muted/30'
        )}
      >
        {onEmojiClick && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onEmojiClick}
            className="h-7 w-7 rounded-full hover:bg-transparent text-muted-foreground tap-scale flex-shrink-0 mb-0.5"
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none bg-transparent border-0 outline-none text-[16px] md:text-[15px] leading-[22px] py-1 px-1',
            'placeholder:text-muted-foreground/70 max-h-[110px]',
            'scrollbar-hide'
          )}
        />

        {!hasContent && onCameraClick && !isEditing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onCameraClick}
            className="h-7 w-7 rounded-full hover:bg-transparent text-muted-foreground tap-scale flex-shrink-0 mb-0.5"
            aria-label="Camera"
          >
            <Camera className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Send / Mic swap with scale-in animation */}
      <Button
        type="button"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          if (hasContent) {
            onSend();
          } else {
            onMicClick();
          }
        }}
        disabled={disabled}
        className={cn(
          'h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0',
          'tap-scale shadow-md animate-scale-in'
        )}
        key={hasContent ? 'send' : 'mic'}
        aria-label={hasContent ? 'Send' : 'Record voice'}
      >
        {hasContent ? <Send className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
      </Button>
    </form>
  );
};
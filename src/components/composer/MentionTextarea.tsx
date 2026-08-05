import { forwardRef, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMentionSuggestions } from '@/hooks/useMentionSuggestions';
import { cn } from '@/lib/utils';

type MentionTextareaProps = React.ComponentProps<typeof Textarea> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Finds the active "@token" the caret sits inside, if any. */
const activeMentionAt = (text: string, caret: number): { start: number; query: string } | null => {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;
  const before = at === 0 ? '' : upto[at - 1];
  if (before && !/\s/.test(before)) return null;
  const token = upto.slice(at + 1);
  if (/\s/.test(token)) return null;
  if (token.length > 20) return null;
  return { start: at, query: token };
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onValueChange, onChange, onKeyDown, className, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
    const { suggestions } = useMentionSuggestions(mention ? mention.query : null);
    const open = Boolean(mention) && suggestions.length > 0;

    const setRefs = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    };

    const syncMention = (text: string, caret: number) => {
      setMention(activeMentionAt(text, caret));
    };

    const insert = (username: string) => {
      if (!mention) return;
      const el = innerRef.current;
      const caret = el?.selectionStart ?? value.length;
      const next = `${value.slice(0, mention.start)}@${username} ${value.slice(caret)}`;
      onValueChange(next);
      setMention(null);
      requestAnimationFrame(() => {
        const pos = mention.start + username.length + 2;
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
    };

    const label = useMemo(
      () => (s: { rank: number }) =>
        s.rank === 0 ? 'Close friend' : s.rank === 1 ? 'Recent chat' : s.rank === 2 ? 'Connected' : '',
      []
    );

    return (
      <div className="relative">
        <Textarea
          {...rest}
          ref={setRefs}
          value={value}
          className={className}
          onChange={(e) => {
            onValueChange(e.target.value);
            onChange?.(e);
            syncMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            syncMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onKeyDown={(e) => {
            if (open && (e.key === 'Escape' || e.key === 'Tab')) {
              if (e.key === 'Tab') {
                e.preventDefault();
                insert(suggestions[0].username);
              } else {
                setMention(null);
              }
              return;
            }
            onKeyDown?.(e);
          }}
        />

        {open && (
          <div
            className={cn(
              'absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg'
            )}
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(s.username)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent touch-manipulation"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={s.avatar_url || undefined} />
                  <AvatarFallback>{(s.display_name || s.username)[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {s.display_name || s.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">@{s.username}</span>
                </span>
                {label(s) && (
                  <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {label(s)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Check, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'postup_agent_instructions_md';

/**
 * Scratchpad page: paste MD instructions for the Lovable agent to follow.
 * Persisted in localStorage only — no DB writes, no schema changes.
 */
export default function InstructionsPage() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ?? '';
      setText(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch {}
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied', description: 'Instructions copied to clipboard' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the text and copy manually',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    setText('');
    toast({ title: 'Cleared' });
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Agent Instructions</h1>
          <p className="text-xs text-muted-foreground">
            Draft MD here, then copy it into chat for the agent to follow.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear
        </Button>
        <Button size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 mr-1.5" />
          ) : (
            <Copy className="h-4 w-4 mr-1.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </header>

      <main className="flex-1 p-3">
        <Card className="h-full p-0 overflow-hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="# Task...\n\nPaste or type Markdown instructions here. Auto-saved locally."
            className="w-full h-full min-h-[60dvh] p-4 bg-transparent outline-none resize-none font-mono text-sm leading-relaxed"
            spellCheck={false}
          />
        </Card>
      </main>
    </div>
  );
}
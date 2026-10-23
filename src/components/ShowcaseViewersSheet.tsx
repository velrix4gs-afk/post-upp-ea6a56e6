import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ViewerRow {
  id: string;
  name: string;
  avatar?: string | null;
  viewedAt: string;
  emoji?: string;
}

interface Props {
  showcaseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Instagram-style sheet for the author: who viewed this Showcase, and which reaction they left. */
export const ShowcaseViewersSheet = ({ showcaseId, open, onOpenChange }: Props) => {
  const [rows, setRows] = useState<ViewerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !showcaseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: views }, { data: reactions }] = await Promise.all([
        supabase.from('showcase_views').select('viewer_id, viewed_at').eq('showcase_id', showcaseId).order('viewed_at', { ascending: false }),
        supabase.from('showcase_reactions').select('user_id, emoji, created_at').eq('showcase_id', showcaseId),
      ]);
      const reactionBy = new Map((reactions ?? []).map((r) => [r.user_id, r.emoji]));
      const times = new Map((views ?? []).map((v) => [v.viewer_id, v.viewed_at]));
      // Someone can react without a recorded view; still list them.
      (reactions ?? []).forEach((r) => { if (!times.has(r.user_id)) times.set(r.user_id, r.created_at); });
      const ids = [...times.keys()];
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', ids)
        : { data: [] as any[] };
      if (cancelled) return;
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const list: ViewerRow[] = ids
        .map((id) => {
          const p: any = byId.get(id);
          return {
            id,
            name: p ? p.display_name || p.username : 'Someone',
            avatar: p?.avatar_url,
            viewedAt: times.get(id)!,
            emoji: reactionBy.get(id),
          };
        })
        // Reactions first, then most recent.
        .sort((a, b) => Number(!!b.emoji) - Number(!!a.emoji) || +new Date(b.viewedAt) - +new Date(a.viewedAt));
      setRows(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, showcaseId]);

  if (!open) return null;

  // Rendered inline (absolute) so it works inside the Showcase dialog, which would block a portalled drawer.
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="max-h-[70%] w-full overflow-y-auto rounded-t-3xl bg-background px-4 pb-6 pt-3 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
        <h3 className="mb-2 text-base font-semibold">Viewers {rows.length > 0 && `(${rows.length})`}</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No views yet.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={r.avatar || undefined} />
              <AvatarFallback>{r.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.viewedAt), { addSuffix: true })}</p>
            </div>
            {r.emoji && <span className="text-2xl">{r.emoji}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

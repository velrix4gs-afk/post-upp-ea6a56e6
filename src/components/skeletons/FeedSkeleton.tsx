import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder that mirrors the real post card (header, caption, media, actions),
 * with a mix of media / text-only cards so it doesn't look like three identical blocks.
 */
const variants = ['media', 'text', 'media'] as const;

export const FeedSkeleton = () => (
  <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading posts">
    {variants.map((variant, i) => (
      <div key={i} className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <div className="mb-3 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          {variant === 'text' && <Skeleton className="h-3.5 w-2/3" />}
        </div>
        {variant === 'media' && <Skeleton className="mb-3 aspect-[4/3] max-h-[420px] w-full rounded-xl" />}
        <div className="flex items-center gap-6">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    ))}
  </div>
);

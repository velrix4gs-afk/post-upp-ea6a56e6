import { useRef, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

interface ReorderableThumbsProps {
  items: string[];
  onReorder: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  className?: string;
}

/**
 * Press-and-hold (or click-and-drag) thumbnail strip.
 * Dragging a thumbnail over another instantly swaps display order.
 */
export const ReorderableThumbs = ({
  items,
  onReorder,
  onRemove,
  className,
}: ReorderableThumbsProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDrag = (index: number) => {
    setDragIndex(index);
    try {
      haptic?.('light' as any);
    } catch {
      /* haptics optional */
    }
  };

  const endDrag = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const indexFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const holder = el?.closest('[data-thumb-index]') as HTMLElement | null;
    if (!holder) return null;
    const idx = Number(holder.dataset.thumbIndex);
    return Number.isNaN(idx) ? null : idx;
  };

  if (items.length === 0) return null;

  return (
    <div className={cn('flex gap-2 mt-3 flex-wrap select-none', className)}>
      {items.map((src, index) => (
        <div
          key={`${src}-${index}`}
          data-thumb-index={index}
          draggable
          onDragStart={() => startDrag(index)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOverIndex(index);
            endDrag();
          }}
          onDragEnd={endDrag}
          onTouchStart={() => {
            holdTimer.current = setTimeout(() => startDrag(index), 220);
          }}
          onTouchMove={(e) => {
            if (dragIndex === null) {
              if (holdTimer.current) clearTimeout(holdTimer.current);
              return;
            }
            e.preventDefault();
            const t = e.touches[0];
            const idx = indexFromPoint(t.clientX, t.clientY);
            if (idx !== null) setOverIndex(idx);
          }}
          onTouchEnd={() => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            endDrag();
          }}
          className={cn(
            'relative group w-20 h-20 flex-shrink-0 touch-none transition-transform duration-150',
            dragIndex === index && 'scale-110 shadow-xl z-10 opacity-90',
            overIndex === index && dragIndex !== null && dragIndex !== index && 'ring-2 ring-primary rounded-lg'
          )}
        >
          <img
            src={src}
            alt={`Selected media ${index + 1}`}
            className="w-20 h-20 object-cover rounded-lg border border-border pointer-events-none"
          />
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-background/80 px-1 text-[10px] text-muted-foreground">
            <GripVertical className="h-3 w-3" />
            {index + 1}
          </span>
          {onRemove && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-destructive hover:bg-destructive/90 rounded-full shadow-sm"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3 text-primary-foreground" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReorderableThumbs;

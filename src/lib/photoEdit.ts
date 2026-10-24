import { storyFilters } from '@/components/showcase/StoryFilters';
import { adjustmentsToCss, type AdjustmentValues } from '@/components/showcase/StoryAdjustments';

/** CSS filter string for a look + adjustments (same maths as the Showcase editor, so previews match exports). */
export const photoFilterCss = (filterId: string, adj: AdjustmentValues): string => {
  const look = storyFilters.find((f) => f.id === filterId)?.css || 'none';
  const adjust = adjustmentsToCss(adj);
  const parts = [look, adjust].filter((p) => p && p !== 'none');
  return parts.length ? parts.join(' ') : 'none';
};

/** Bakes filter + vignette into a JPEG. Output is capped at 2560px on the long edge. */
export const renderEditedPhoto = async (
  source: Blob,
  filterCss: string,
  vignette: number,
  fileName = 'photo.jpg',
): Promise<File> => {
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This image could not be read.'));
      i.src = url;
    });
    const scale = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * scale);
    const H = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not start the image editor.');
    if (filterCss !== 'none') ctx.filter = filterCss;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.filter = 'none';
    if (vignette > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${vignette / 100})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export the edited photo.'))), 'image/jpeg', 0.92),
    );
    return new File([blob], fileName.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
};

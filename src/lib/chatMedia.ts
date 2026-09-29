export type ChatMediaCategory = 'image' | 'video' | 'audio' | 'document';

export const getChatMediaCategory = (mediaType?: string | null): ChatMediaCategory => {
  const normalized = mediaType?.trim().toLowerCase() || '';

  if (normalized === 'image' || normalized === 'photo' || normalized.startsWith('image/')) return 'image';
  if (normalized === 'video' || normalized.startsWith('video/')) return 'video';
  if (normalized === 'audio' || normalized.startsWith('audio/')) return 'audio';
  return 'document';
};

export const getChatMediaFileName = (mediaUrl?: string | null): string => {
  if (!mediaUrl) return 'Shared file';

  try {
    const path = new URL(mediaUrl).pathname;
    const fileName = decodeURIComponent(path.split('/').pop() || '');
    return fileName || 'Shared file';
  } catch {
    return 'Shared file';
  }
};

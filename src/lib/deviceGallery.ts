import { Capacitor } from '@capacitor/core';
import DeviceGallery, {
  isNativeGalleryAvailable,
  type DeviceMediaAsset,
  type DeviceMediaKind,
} from '@/plugins/device-gallery';
import { reportSilently } from '@/lib/errorSuppression';

export type GalleryFilter = 'all' | 'photos' | 'videos';

export interface DeviceGalleryItem {
  id: string;
  name: string;
  kind: DeviceMediaKind;
  mimeType: string;
  thumbUrl: string;
  durationMs?: number;
  source: 'native' | 'folder';
  file?: File;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'windows', 'program files', 'system volume information']);

export const canUseNativeGallery = () => isNativeGalleryAvailable();

export const canUseFolderPicker = () =>
  typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';

export async function checkDeviceGalleryAccess(): Promise<boolean> {
  if (!canUseNativeGallery()) return false;
  try {
    const { granted } = await DeviceGallery.checkAccess();
    return granted;
  } catch (err) {
    reportSilently('GALLERY_010', err);
    return false;
  }
}

export async function requestDeviceGalleryAccess(): Promise<boolean> {
  if (!canUseNativeGallery()) return false;
  try {
    const { granted } = await DeviceGallery.requestAccess();
    return granted;
  } catch (err) {
    reportSilently('GALLERY_011', err);
    return false;
  }
}

export async function openDeviceGallerySettings(): Promise<void> {
  if (!canUseNativeGallery()) return;
  try {
    await DeviceGallery.openSettings();
  } catch (err) {
    reportSilently('GALLERY_012', err);
  }
}

export async function listNativeDeviceMedia(
  quantity = 120,
  types: GalleryFilter = 'all',
): Promise<DeviceGalleryItem[]> {
  const nativeTypes = types === 'photos' ? 'photos' : types === 'videos' ? 'videos' : 'all';
  const { items } = await DeviceGallery.listMedia({ quantity, types: nativeTypes });
  return (items || []).map(assetToItem);
}

function assetToItem(asset: DeviceMediaAsset): DeviceGalleryItem {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    mimeType: asset.mimeType || (asset.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    thumbUrl: asset.thumbnail,
    durationMs: asset.durationMs || undefined,
    source: 'native',
  };
}

export async function deviceItemToFile(item: DeviceGalleryItem): Promise<File> {
  if (item.file) return item.file;
  if (item.source !== 'native') {
    throw new Error('Missing file for gallery item');
  }
  const copied = await DeviceGallery.copyToCache({ uri: item.id, name: item.name });
  const webPath = Capacitor.convertFileSrc(copied.path.startsWith('file:') ? copied.path : `file://${copied.path}`);
  const res = await fetch(webPath);
  const blob = await res.blob();
  return new File([blob], copied.name || item.name, { type: copied.mimeType || item.mimeType || blob.type });
}

function fileKind(file: File): DeviceMediaKind | null {
  if (file.type.startsWith('image/') || IMAGE_EXT.test(file.name)) return 'image';
  if (file.type.startsWith('video/') || VIDEO_EXT.test(file.name)) return 'video';
  return null;
}

export function filesToGalleryItems(files: File[]): DeviceGalleryItem[] {
  return files
    .map((file) => {
      const kind = fileKind(file);
      if (!kind) return null;
      const item: DeviceGalleryItem = {
        id: `file:${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        kind,
        mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        thumbUrl: URL.createObjectURL(file),
        source: 'folder',
        file,
      };
      return item;
    })
    .filter((x): x is DeviceGalleryItem => x !== null)
    .sort((a, b) => (b.file?.lastModified || 0) - (a.file?.lastModified || 0));
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  acc: File[],
  depth = 0,
): Promise<void> {
  if (acc.length >= 400 || depth > 6) return;
  for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (acc.length >= 400) return;
    if (handle.kind === 'directory') {
      if (SKIP_DIRS.has(name.toLowerCase())) continue;
      await walkDirectory(handle as FileSystemDirectoryHandle, acc, depth + 1);
    } else if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      if (fileKind(file)) acc.push(file);
    }
  }
}

export async function pickDeviceFolder(): Promise<DeviceGalleryItem[]> {
  const picker = (window as any).showDirectoryPicker as
    | ((opts?: { mode?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle>)
    | undefined;
  if (!picker) {
    throw new Error('Folder access is not supported in this browser');
  }
  const dir = await picker({ mode: 'read', startIn: 'pictures' });
  const files: File[] = [];
  await walkDirectory(dir, files);
  return filesToGalleryItems(files);
}

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function revokeGalleryThumbs(items: DeviceGalleryItem[]) {
  items.forEach((item) => {
    if (item.thumbUrl.startsWith('blob:')) URL.revokeObjectURL(item.thumbUrl);
  });
}

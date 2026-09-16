import { Capacitor, registerPlugin } from '@capacitor/core';

export type DeviceMediaKind = 'image' | 'video';

export interface DeviceMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  kind: DeviceMediaKind;
  durationMs: number;
  dateAdded: number;
  thumbnail: string;
}

export interface DeviceGalleryPlugin {
  checkAccess(): Promise<{ granted: boolean }>;
  requestAccess(): Promise<{ granted: boolean }>;
  openSettings(): Promise<void>;
  listMedia(options: { quantity?: number; types?: 'all' | 'photos' | 'videos' }): Promise<{
    items: DeviceMediaAsset[];
  }>;
  copyToCache(options: { uri: string; name: string }): Promise<{
    path: string;
    mimeType: string;
    name: string;
  }>;
}

const DeviceGallery = registerPlugin<DeviceGalleryPlugin>('DeviceGallery');

export const isNativeGalleryAvailable = () => Capacitor.isNativePlatform();

export default DeviceGallery;

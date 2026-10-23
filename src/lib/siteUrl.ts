export const PRODUCTION_ORIGIN = 'https://post-upp.vercel.app';

/** Origin to use in links people share. Dev/preview/native hosts fall back to the public production URL. */
export const shareOrigin = (): string => {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  const { origin, hostname, protocol } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^(10|192\.168|172\.)/.test(hostname) || hostname.endsWith('.local');
  const isNative = protocol === 'capacitor:' || protocol === 'file:' || hostname === 'localhost';
  const isLovablePreview = hostname.endsWith('lovableproject.com') || hostname.includes('id-preview');
  return isLocal || isNative || isLovablePreview ? PRODUCTION_ORIGIN : origin;
};

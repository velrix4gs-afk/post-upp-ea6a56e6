/**
 * Shared chat theming so the in-chat view and the long-press preview always look the same.
 */

// Preset wallpaper id → Tailwind class. Anything else is treated as an image URL.
export const WALLPAPER_PRESETS: Record<string, string> = {
  default: '',
  blue: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900',
  green: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-950 dark:to-green-900',
  purple: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950 dark:to-purple-900',
  pink: 'bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-950 dark:to-pink-900',
  orange: 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900',
};

export const isWallpaperUrl = (v?: string | null) => !!v && /^(https?:|\/|data:)/i.test(v);

const NAMED_COLORS: Record<string, string> = {
  default: 'hsl(var(--primary))',
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#a855f7',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
  teal: '#14b8a6',
  yellow: '#eab308',
  indigo: '#6366f1',
  'whatsapp-sent': '#6e3cfd',
  'whatsapp-sent-dark': '#005c4b',
  'whatsapp-received': '#ffffff',
  'whatsapp-received-dark': '#202c33',
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};

/**
 * Chat theme colours should be thick and solid, not pastel: a picked "red" must read as
 * full red, not pink. Saturated hues are pushed to high saturation and a deep lightness.
 * Greys/neutrals keep their (low) saturation and are just darkened.
 */
const thicken = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const sat = s < 0.2 ? s : Math.max(s, 0.78);
  const light = Math.min(l, s < 0.2 ? 0.36 : 0.44);
  return `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`;
};

export const getBubbleColorValue = (color: string): string => {
  const named = NAMED_COLORS[color];
  const value = named ?? (HEX.test(color) ? color : NAMED_COLORS.default);
  // Keep exact white/received colours and CSS-variable values as-is.
  if (value.startsWith('hsl(') || color === 'whatsapp-received' || color === 'whatsapp-received-dark') return value;
  return HEX.test(value) ? thicken(value) : value;
};

/** Custom (picked) bubble colours are dark and saturated, so text on them is white. */
export const bubbleTextIsLight = (color?: string | null): boolean =>
  !!color && color !== 'whatsapp-received' && color !== 'whatsapp-received-dark';

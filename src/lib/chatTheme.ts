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

const hslToHex = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
};

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Chat theme colours should be thick and solid, not pastel: a picked "red" must read as
 * full red, not pink. Saturated hues are pushed to high saturation and a deep lightness,
 * and lightness is lowered further until white text reaches AA contrast (4.5:1) — even for
 * naturally light hues like yellow and cyan. Greys keep their low saturation.
 */
const thicken = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l0] = rgbToHsl(r, g, b);
  const grey = s < 0.2;
  const sat = grey ? s : Math.max(s, 0.8);
  let light = Math.min(l0, grey ? 0.34 : 0.42);
  let out = hslToHex(h, sat, light);
  // White text contrast = 1.05 / (L + 0.05)
  while (1.05 / (luminance(out) + 0.05) < 4.5 && light > 0.18) {
    light -= 0.02;
    out = hslToHex(h, sat, light);
  }
  return out;
};

export const getBubbleColorValue = (color: string): string => {
  const named = NAMED_COLORS[color];
  const value = named ?? (HEX.test(color) ? color : NAMED_COLORS.default);
  // Keep exact white/received colours and CSS-variable values as-is.
  if (value.startsWith('hsl(') || color === 'whatsapp-received' || color === 'whatsapp-received-dark') return value;
  return HEX.test(value) ? thicken(value) : value;
};

/** Readable text colour for a picked bubble colour: white on thick colours, near-black on light ones. */
export const getBubbleTextColor = (color?: string | null): string | undefined => {
  if (!color) return undefined;
  const value = getBubbleColorValue(color);
  if (!HEX.test(value)) return '#ffffff'; // hsl(var(--primary)) default is a deep brand colour
  const white = 1.05 / (luminance(value) + 0.05);
  const black = (luminance(value) + 0.05) / 0.05;
  return white >= black ? '#ffffff' : '#111111';
};

/** @deprecated kept for older call sites; prefer getBubbleTextColor. */
export const bubbleTextIsLight = (color?: string | null): boolean => getBubbleTextColor(color) === '#ffffff';

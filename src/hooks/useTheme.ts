import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
export type ContrastMode = 'normal' | 'amoled' | 'dim';
type ColorTheme =
  | 'fb-twitter'
  | 'deep-teal'
  | 'lemon-yellow'
  | 'seamist'
  | 'curious-blue'
  | 'mulled-wine'
  | null;

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  });

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('colorTheme') as ColorTheme;
      // Default to the clean Facebook+Twitter combined skin if user has no pick.
      return stored || 'fb-twitter';
    }
    return 'fb-twitter';
  });

  const [contrast, setContrast] = useState<ContrastMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('contrastMode') as ContrastMode) || 'normal';
    }
    return 'normal';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    // Always persist so reloads & cross-page navs restore correctly.
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (colorTheme) {
      root.setAttribute('data-color-theme', colorTheme);
      try { localStorage.setItem('colorTheme', colorTheme); } catch {}
    } else {
      root.removeAttribute('data-color-theme');
      try { localStorage.removeItem('colorTheme'); } catch {}
    }
  }, [colorTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-contrast', contrast);
    try { localStorage.setItem('contrastMode', contrast); } catch {}
  }, [contrast]);

  const setThemeValue = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  const setColorThemeValue = (newColorTheme: ColorTheme) => {
    if (newColorTheme) localStorage.setItem('colorTheme', newColorTheme);
    else localStorage.removeItem('colorTheme');
    setColorTheme(newColorTheme);
  };

  const setContrastValue = (mode: ContrastMode) => {
    try { localStorage.setItem('contrastMode', mode); } catch {}
    // AMOLED / Dim only make sense on a dark canvas — force dark alongside.
    if (mode !== 'normal') setThemeValue('dark');
    setContrast(mode);
  };

  return {
    theme,
    setTheme: setThemeValue,
    colorTheme,
    setColorTheme: setColorThemeValue,
    contrast,
    setContrast: setContrastValue,
  };
};
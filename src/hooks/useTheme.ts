import { useCallback, useEffect, useState } from 'react';
import { loadTheme, saveTheme } from '../lib/storage';
import type { Theme } from '../types';

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'dark' || fromDom === 'light') return fromDom;
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const fallback: Theme = prefersLight ? 'light' : 'dark';
  return loadTheme(fallback);
}

/**
 * テーマは html[data-theme] に載せる。
 * thinking-orbs の theme="auto" もこの属性を読むので、
 * 4 つのライブラリと自分の CSS が同じ値で揃う。
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    saveTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, setTheme };
}

/** 画面幅に応じた値。VoiceRing の size はピクセル指定なので JS 側で決める。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

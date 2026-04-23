/**
 * ThemeContext — thin ConfigProvider wrapper over the settings store.
 *
 * Reads `appearance.theme`, `appearance.density`, and
 * `appearance.accentColor` from the settings store and translates
 * them into Ant Design's ConfigProvider token overrides. Mutations go
 * straight to the settings store via `setSettingValue`.
 *
 * The `useTheme()` API predates the settings system and is kept stable
 * so popup/workspace callers don't need to rewrite — they still see
 * `themeMode`, `isDarkMode`, `isCompactMode`, `toggleCompactMode`, etc.
 * Internally, every field is derived from the store.
 *
 * Requires `SettingsProvider` to be mounted above this component.
 */

import { ConfigProvider, theme } from 'antd';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { setSettingValue, useSettingValue } from '@/workbench/settings';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  isCompactMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleCompactMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  isDarkMode: false,
  themeMode: 'auto',
  isCompactMode: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  toggleCompactMode: () => {},
});

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeMode = useSettingValue('appearance.theme');
  const density = useSettingValue('appearance.density');
  const accentColor = useSettingValue('appearance.accentColor');
  const isCompactMode = density === 'compact';

  // System color-scheme preference drives `auto` theme resolution.
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent): void => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const isDarkMode = themeMode === 'dark' || (themeMode === 'auto' && systemPrefersDark);

  // Mirror the resolved theme onto the document element and into
  // localStorage so the next page load can render the correct theme on
  // its first paint via `src/assets/theme-init.js`. localStorage is the
  // only synchronous storage available in the pre-mount script — the
  // settings store itself lives in chrome.storage, which is async.
  useEffect(() => {
    const resolved = isDarkMode ? 'dark' : 'light';
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;
    try {
      localStorage.setItem('oh:theme', themeMode);
    } catch {
      // private mode / storage disabled — accept the FOUC on next load.
    }
  }, [isDarkMode, themeMode]);

  // ── Store mutators ───────────────────────────────────────────────
  const handleSetThemeMode = (mode: ThemeMode): void => {
    setSettingValue('appearance.theme', mode);
  };

  const toggleTheme = (): void => {
    handleSetThemeMode(isDarkMode ? 'light' : 'dark');
  };

  const toggleCompactMode = (): void => {
    setSettingValue('appearance.density', isCompactMode ? 'comfortable' : 'compact');
  };

  // ── Ant theme config ─────────────────────────────────────────────
  const algorithms: Array<typeof theme.darkAlgorithm> = [isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (isCompactMode) algorithms.push(theme.compactAlgorithm);

  const antTheme = {
    algorithm: algorithms.length === 1 ? algorithms[0] : algorithms,
    token: {
      colorPrimary: accentColor,
      borderRadius: 6,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      // Shell frame tone — sits behind the dock/editor "cards" and shows
      // through as the gutter between them. antd's default light value
      // (`#f5f5f5`) is almost indistinguishable from `colorBgContainer`
      // (`#fff`), so the gutters disappear. A slightly darker neutral
      // gives us the IDE-style visible frame without loud contrast.
      // Dark mode is already fine by default (layout `#000` vs
      // container `#141414`), but we pin it explicitly so the relationship
      // doesn't drift if antd changes its algorithm.
      colorBgLayout: isDarkMode ? '#1a1a1a' : '#e8e8e8',
    },
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        themeMode,
        isCompactMode,
        toggleTheme,
        setThemeMode: handleSetThemeMode,
        toggleCompactMode,
      }}
    >
      <ConfigProvider theme={antTheme}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
};

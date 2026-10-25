/**
 * ThemeContext — thin ConfigProvider wrapper over the settings store.
 *
 * Reads `appearance.theme`, `appearance.density`,
 * `appearance.accentColor`, `appearance.lightVariant`, and
 * `appearance.darkVariant` from the settings store, resolves the
 * active variant via the themes registry, and feeds Ant Design's
 * ConfigProvider with the variant's token overrides plus the algorithm
 * for the resolved mode.
 *
 * The variant also publishes a Monaco theme id (`monacoTheme`) so
 * editor surfaces — CodeEditor, CodeViewer, MergePane,
 * RichDiffEditor — switch in lockstep with the surrounding UI.
 *
 * The `useTheme()` API surface stays compatible with existing callers:
 * `themeMode`, `isDarkMode`, `isCompactMode`, `toggleCompactMode`, etc.
 * The added `monacoTheme` field is the single source of truth for
 * editor theming — callers should prefer it over deriving an id from
 * `isDarkMode`.
 *
 * Requires `SettingsProvider` to be mounted above this component.
 */

import { UiThemeProvider } from './ui-theme';
import { getCapability } from '@openheaders/core/capabilities';
import { buildAntTheme, getVariant, type ThemeVariant } from '@openheaders/ui/themes';
// Concrete modules, not the settings barrel — the barrel reaches
// SettingsProvider's schema side-effect chain, which loops back into
// this context layer and closes a chunk-level import cycle at build
// time.
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { set as setSettingValue } from '@openheaders/ui/workbench/settings/store';
import { resolveAppearanceFontFamily } from '@openheaders/ui/workbench/settings/schema/appearance';
import { ConfigProvider, theme as antdTheme } from 'antd';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  isCompactMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleCompactMode: () => void;
  /** Active variant (after mode resolution + variant lookup). */
  variant: ThemeVariant;
  /** Monaco theme id matching the active variant. */
  monacoTheme: string;
}

// Sentinel default — ThemeProvider always overrides this. The variant
// shape is required so consumers don't need to null-check `variant`.
import { lightDefault as DEFAULT_VARIANT } from '@openheaders/ui/themes/light/default';

export const ThemeContext = createContext<ThemeContextValue>({
  isDarkMode: false,
  themeMode: 'auto',
  isCompactMode: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  toggleCompactMode: () => {},
  variant: DEFAULT_VARIANT,
  monacoTheme: DEFAULT_VARIANT.monacoTheme,
});

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeMode = useSettingValue('appearance.theme');
  const density = useSettingValue('appearance.density');
  const accentColor = useSettingValue('appearance.accentColor');
  const lightVariantId = useSettingValue('appearance.lightVariant');
  const darkVariantId = useSettingValue('appearance.darkVariant');
  const uiScale = useSettingValue('appearance.uiScale');
  const fontFamilyPreset = useSettingValue('appearance.fontFamilyPreset');
  const fontFamily = resolveAppearanceFontFamily(fontFamilyPreset);
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
  const variant = useMemo(
    () => getVariant(isDarkMode ? 'dark' : 'light', isDarkMode ? darkVariantId : lightVariantId),
    [isDarkMode, lightVariantId, darkVariantId],
  );

  // Mirror the resolved theme onto the document element and into
  // localStorage so the next page load can render the correct theme on
  // its first paint via the host's pre-mount theme script. localStorage
  // is the only synchronous storage available in that pre-mount script —
  // the settings store itself is host-backed and async.
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

  // Publish the active chrome font as a CSS custom property so global
  // stylesheets (popup.less, rules.less, panel.css) can opt every plain
  // HTML element into the user's choice. Without this, hardcoded
  // `body { font-family: ... }` rules win over Ant Design's token and
  // every preset renders identically on macOS (system fallback).
  useEffect(() => {
    document.documentElement.style.setProperty('--oh-ui-font-family', fontFamily);
  }, [fontFamily]);

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
  // One builder for every chrome surface — the root error fallback
  // above the providers resolves the same config through it.
  const antTheme = useMemo(
    () => buildAntTheme({ variant, isDarkMode, isCompactMode, accentColor, uiScale, fontFamily }),
    [variant, isDarkMode, isCompactMode, accentColor, uiScale, fontFamily],
  );

  // The chrome the host paints outside the document — the Windows /
  // Linux title-bar overlay — takes the top bar's palette under the
  // active variant (`colorBgLayout` under `colorText`, what TopBar
  // paints). The mode is the host's own read of the persisted setting;
  // hosts without such chrome never register the capability.
  useEffect(() => {
    const applyWindowChrome = getCapability('applyWindowChrome');
    if (!applyWindowChrome) return;
    const tokens = antdTheme.getDesignToken(antTheme);
    applyWindowChrome({ background: tokens.colorBgLayout, symbolColor: tokens.colorText });
  }, [antTheme]);

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        themeMode,
        isCompactMode,
        toggleTheme,
        setThemeMode: handleSetThemeMode,
        toggleCompactMode,
        variant,
        monacoTheme: variant.monacoTheme,
      }}
    >
      <ConfigProvider theme={antTheme}>
        <UiThemeProvider
          value={{
            isDarkMode,
            monacoTheme: variant.monacoTheme,
            dirtyTone: variant.dirtyTone,
            unresolvedTone: variant.unresolvedTone,
            saveAccent: variant.saveAccent,
          }}
        >
          {children}
        </UiThemeProvider>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

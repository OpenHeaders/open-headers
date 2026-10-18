/**
 * UI theme context — the host-neutral slice of theme state that shared
 * UI components need.
 *
 * The full theme system (variants, compact mode, accent colour,
 * persistence, system-preference tracking, Ant Design `ConfigProvider`
 * wiring) stays host-local — it pulls host settings and surface-specific
 * subsystems. This context is the seam: the host's theme provider
 * resolves the active variant and feeds the two values shared editor
 * surfaces actually need — the dark-mode flag and the Monaco theme id —
 * so a component in `@openheaders/ui` can read them via {@link useUiTheme}
 * without importing the host theme module.
 */

import { createContext, type ReactNode, useContext } from 'react';

export interface UiTheme {
  /** True when the resolved theme is a dark variant. */
  isDarkMode: boolean;
  /** Monaco theme id matching the active variant — the single source of
   *  truth for editor pane theming. */
  monacoTheme: string;
  /** The color every "differs from the saved entity" mark wears — the
   *  tab bar's and sidebar's unsaved dots, the request editor's section
   *  dots and count badges (a white number sits on it), the Settings
   *  rows' and script rail's dots, the MQTT gears' badge. The variant
   *  pins it (`ThemeVariant.dirtyTone`): the light variants the salmon
   *  the marks were born with, the dark variants a deep red white reads
   *  on (white on the salmon read at ~2.4:1). */
  dirtyTone: string;
}

// Sentinel default — a host that hasn't mounted `UiThemeProvider` still
// renders sensible light-mode editor surfaces. `'vs'` is Monaco's
// built-in light theme id; the salmon is the light variants' dirty tone.
const DEFAULT_UI_THEME: UiTheme = { isDarkMode: false, monacoTheme: 'vs', dirtyTone: '#ff7875' };

const UiThemeContext = createContext<UiTheme>(DEFAULT_UI_THEME);

export interface UiThemeProviderProps {
  /** Resolved theme values, supplied by the host theme provider. */
  value: UiTheme;
  children: ReactNode;
}

/** Feeds the host's resolved theme values into the shared UI tree. */
export function UiThemeProvider({ value, children }: UiThemeProviderProps): ReactNode {
  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

/** Read the host-neutral theme slice from any `@openheaders/ui` component. */
export function useUiTheme(): UiTheme {
  return useContext(UiThemeContext);
}

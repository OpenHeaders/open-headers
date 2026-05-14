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
}

// Sentinel default — a host that hasn't mounted `UiThemeProvider` still
// renders sensible light-mode editor surfaces. `'vs'` is Monaco's
// built-in light theme id.
const DEFAULT_UI_THEME: UiTheme = { isDarkMode: false, monacoTheme: 'vs' };

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

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
  /** The color every "differs from the saved entity" dot wears — the
   *  tab bar's and sidebar's unsaved dots, the request editor's section
   *  dots, the Settings rows' and script rail's dots, the MQTT gears'
   *  badge. The variant pins it (`ThemeVariant.dirtyTone`): the salmon
   *  the marks were born with, on every variant. */
  dirtyTone: string;
  /** The color the unresolved dots wear — the field's right-end dot
   *  and the tab label's (`ThemeVariant.unresolvedTone`): a strong red
   *  a step past `colorError`, apart from the salmon dirty dot. */
  unresolvedTone: string;
  /** The commit action's accent — the fill under the white label of
   *  the editor shell's Save while dirty and of every "do it" button
   *  cut from it. The variant pins it (`ThemeVariant.saveAccent`): the
   *  light variants the brand orange, the dark variants a deeper
   *  orange white reads on (white on the brand orange read at ~2.9:1). */
  saveAccent: string;
}

// Sentinel default — a host that hasn't mounted `UiThemeProvider` still
// renders sensible light-mode editor surfaces. `'vs'` is Monaco's
// built-in light theme id; the salmon and the brand orange are the
// light variants' dirty tone and save accent.
const DEFAULT_UI_THEME: UiTheme = {
  isDarkMode: false,
  monacoTheme: 'vs',
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
};

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

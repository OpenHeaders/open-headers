/**
 * Theme types for the DevTools Inspector panel.
 *
 * The panel inherits its theme from the app's global ThemeContext
 * (backed by the settings store), set up in index.tsx via
 * SettingsProvider + ThemeProvider. The pre-mount theme-init.js
 * script handles first-paint correctness.
 */

export type PanelTheme = 'light' | 'dark';

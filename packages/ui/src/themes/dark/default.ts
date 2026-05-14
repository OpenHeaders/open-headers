import type { ThemeVariant } from '../types';

export const darkDefault: ThemeVariant = {
  id: 'default',
  mode: 'dark',
  label: 'Default',
  description: 'Balanced neutral dark theme for everyday use.',
  honorsAccentColor: true,
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Pinned so the layout/container relationship doesn't drift if
    // antd changes its dark algorithm.
    colorBgLayout: '#1a1a1a',
  },
  monacoTheme: 'oh-dark',
  monacoDefinition: {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.lineHighlightBackground': '#2A2D2E',
      'editor.lineHighlightBorder': '#2A2D2E',
    },
  },
};

import type { ThemeVariant } from '../types';

export const lightDefault: ThemeVariant = {
  id: 'default',
  mode: 'light',
  label: 'Default',
  description: 'Balanced neutral light theme for everyday use.',
  honorsAccentColor: true,
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Slightly darker than antd's default so the gutter between the
    // dock and the editor "cards" stays visible.
    colorBgLayout: '#f0f0f0',
  },
  monacoTheme: 'oh-light',
  monacoDefinition: {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.lineHighlightBackground': '#F1F3F5',
      'editor.lineHighlightBorder': '#F1F3F5',
    },
  },
};

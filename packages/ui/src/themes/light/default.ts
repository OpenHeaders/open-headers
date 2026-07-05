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
    // Darker than antd's default so the gutter between the dock and
    // the editor "cards" reads at a glance against white content.
    colorBgLayout: '#e8e8e8',
    // antd's light borders (#d9d9d9 / #f0f0f0) wash out on the white
    // cards; darkened so hairlines and dividers stay visible.
    colorBorder: '#c9c9c9',
    colorBorderSecondary: '#dcdcdc',
    colorSplit: '#dcdcdc',
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

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
    // antd changes its dark algorithm. The frame gutter sits well above
    // the #141414 cards so pane boundaries read at a glance.
    colorBgLayout: '#262626',
    // antd's dark borders (#424242 / #303030) sink into the near-black
    // cards; lifted so hairlines and dividers stay visible.
    colorBorder: '#4d4d4d',
    colorBorderSecondary: '#3d3d3d',
    colorSplit: '#3d3d3d',
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

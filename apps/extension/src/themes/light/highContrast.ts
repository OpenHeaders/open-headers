import type { ThemeVariant } from '../types';

export const lightHighContrast: ThemeVariant = {
  id: 'highContrast',
  mode: 'light',
  label: 'High Contrast',
  description: 'Maximum legibility — pure white surfaces, near-black text, AAA contrast.',
  honorsAccentColor: false,
  antdTokens: {
    borderRadius: 4,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#ffffff',
    colorBgLayout: '#e8e8e8',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorTextBase: '#000000',
    colorBorder: '#000000',
    colorBorderSecondary: '#595959',
    colorPrimary: '#003a8c',
    colorSuccess: '#135200',
    colorWarning: '#874d00',
    colorError: '#a8071a',
    colorInfo: '#003a8c',
    lineWidth: 1.5,
  },
  monacoTheme: 'oh-light-hc',
  monacoDefinition: {
    base: 'hc-light',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#e6e6e6',
      'editor.lineHighlightBorder': '#000000',
      'editorLineNumber.foreground': '#000000',
    },
  },
};

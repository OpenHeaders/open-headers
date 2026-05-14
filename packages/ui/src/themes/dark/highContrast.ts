import type { ThemeVariant } from '../types';

export const darkHighContrast: ThemeVariant = {
  id: 'highContrast',
  mode: 'dark',
  label: 'High Contrast',
  description: 'Maximum legibility — true black surfaces, bright text, AAA contrast.',
  honorsAccentColor: false,
  antdTokens: {
    borderRadius: 4,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#000000',
    colorBgLayout: '#000000',
    colorBgContainer: '#000000',
    colorBgElevated: '#0a0a0a',
    colorTextBase: '#ffffff',
    colorBorder: '#ffffff',
    colorBorderSecondary: '#bfbfbf',
    colorPrimary: '#69b1ff',
    colorSuccess: '#73d13d',
    colorWarning: '#ffc53d',
    colorError: '#ff7875',
    colorInfo: '#69b1ff',
    lineWidth: 1.5,
  },
  monacoTheme: 'oh-dark-hc',
  monacoDefinition: {
    base: 'hc-black',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#1a1a1a',
      'editor.lineHighlightBorder': '#ffffff',
      'editorLineNumber.foreground': '#ffffff',
    },
  },
};

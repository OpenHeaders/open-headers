import type { ThemeVariant } from '../types';

export const lightSepia: ThemeVariant = {
  id: 'sepia',
  mode: 'light',
  labelKey: 'workbench.settings.def.appearance.lightVariant.option.sepia.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.option.sepia.description',
  honorsAccentColor: false,
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#f4ecd8',
    colorBgLayout: '#e8dec5',
    colorBgContainer: '#f4ecd8',
    colorBgElevated: '#fbf5e3',
    colorTextBase: '#3b2a14',
    colorBorder: '#cdba93',
    colorBorderSecondary: '#dccfa9',
    colorPrimary: '#854d0e',
    colorSuccess: '#3f6212',
    // antd derives the success wash and border by lightening the seed,
    // and a dark seed yields a muddy wash; pinned pale so status tags
    // keep a light tint under the dark text.
    colorSuccessBg: '#e8e6ce',
    colorSuccessBorder: '#b0ba8f',
    colorWarning: '#92400e',
    colorError: '#7f1d1d',
    colorInfo: '#1e40af',
  },
  monacoTheme: 'oh-light-sepia',
  monacoDefinition: {
    base: 'vs',
    inherit: true,
    rules: [{ token: 'comment', foreground: '8c7449', fontStyle: 'italic' }],
    colors: {
      'editor.background': '#f4ecd8',
      'editor.foreground': '#3b2a14',
      'editor.lineHighlightBackground': '#ecdfba',
      'editor.lineHighlightBorder': '#ecdfba',
      'editorLineNumber.foreground': '#a78a4f',
      'editorLineNumber.activeForeground': '#3b2a14',
      'editorCursor.foreground': '#854d0e',
    },
  },
};

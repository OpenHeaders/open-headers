import type { ThemeVariant } from '../types';

export const lightWarm: ThemeVariant = {
  id: 'warm',
  mode: 'light',
  labelKey: 'workbench.settings.def.appearance.lightVariant.option.warm.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.option.warm.description',
  honorsAccentColor: false,
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#faf7f2',
    colorBgLayout: '#efe7d7',
    colorBgContainer: '#faf7f2',
    colorBgElevated: '#fffdf8',
    colorTextBase: '#3b2f1d',
    colorBorder: '#d6cab2',
    colorBorderSecondary: '#e7decb',
    colorPrimary: '#a85a00',
    colorSuccess: '#3f6212',
    // antd derives the success wash and border by lightening the seed,
    // and a dark seed yields a muddy wash; pinned pale so status tags
    // keep a light tint under the dark text.
    colorSuccessBg: '#eceee1',
    colorSuccessBorder: '#b2bf9c',
    colorWarning: '#9a3412',
    colorError: '#9b1c1c',
    colorInfo: '#1d4ed8',
  },
  monacoTheme: 'oh-light-warm',
  monacoDefinition: {
    base: 'vs',
    inherit: true,
    rules: [{ token: 'comment', foreground: '8a7a5b', fontStyle: 'italic' }],
    colors: {
      'editor.background': '#faf7f2',
      'editor.foreground': '#3b2f1d',
      'editor.lineHighlightBackground': '#f1ead9',
      'editor.lineHighlightBorder': '#f1ead9',
      'editorLineNumber.foreground': '#a89072',
      'editorLineNumber.activeForeground': '#3b2f1d',
      'editorCursor.foreground': '#a85a00',
    },
  },
};

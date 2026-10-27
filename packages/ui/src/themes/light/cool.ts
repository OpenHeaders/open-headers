import type { ThemeVariant } from '../types';

export const lightCool: ThemeVariant = {
  id: 'cool',
  mode: 'light',
  labelKey: 'workbench.settings.def.appearance.lightVariant.option.cool.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.option.cool.description',
  honorsAccentColor: false,
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#f5f7fa',
    colorBgLayout: '#e6ebf2',
    colorBgContainer: '#f5f7fa',
    colorBgElevated: '#ffffff',
    colorTextBase: '#1f2937',
    colorBorder: '#c8d1de',
    colorBorderSecondary: '#dde3ec',
    colorPrimary: '#1d4ed8',
    colorSuccess: '#0e7490',
    // antd derives the success wash and border by lightening the seed,
    // and a dark seed yields a muddy wash; pinned pale so status tags
    // keep a light tint under the dark text.
    colorSuccessBg: '#e7f1f4',
    colorSuccessBorder: '#9fc7d3',
    colorWarning: '#b45309',
    colorError: '#b91c1c',
    colorInfo: '#1d4ed8',
  },
  monacoTheme: 'oh-light-cool',
  monacoDefinition: {
    base: 'vs',
    inherit: true,
    rules: [{ token: 'comment', foreground: '6b7a90', fontStyle: 'italic' }],
    colors: {
      'editor.background': '#f5f7fa',
      'editor.foreground': '#1f2937',
      'editor.lineHighlightBackground': '#e6ebf2',
      'editor.lineHighlightBorder': '#e6ebf2',
      'editorLineNumber.foreground': '#8893a8',
      'editorLineNumber.activeForeground': '#1f2937',
      'editorCursor.foreground': '#1d4ed8',
    },
  },
};

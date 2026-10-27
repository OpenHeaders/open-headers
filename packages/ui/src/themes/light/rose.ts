import type { ThemeVariant } from '../types';

export const lightRose: ThemeVariant = {
  id: 'rose',
  mode: 'light',
  labelKey: 'workbench.settings.def.appearance.lightVariant.option.rose.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.option.rose.description',
  honorsAccentColor: false,
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    colorBgBase: '#fdf6f7',
    colorBgLayout: '#f4e3e6',
    colorBgContainer: '#fdf6f7',
    colorBgElevated: '#fffafb',
    colorTextBase: '#3b1f29',
    colorBorder: '#e7c9cf',
    colorBorderSecondary: '#f0d9de',
    colorPrimary: '#9d174d',
    colorSuccess: '#3f6212',
    // antd derives the success wash and border by lightening the seed,
    // and a dark seed yields a muddy wash; pinned pale so status tags
    // keep a light tint under the dark text.
    colorSuccessBg: '#ecebe4',
    colorSuccessBorder: '#b2bd9e',
    colorWarning: '#92400e',
    colorError: '#9f1239',
    colorInfo: '#7c3aed',
  },
  monacoTheme: 'oh-light-rose',
  monacoDefinition: {
    base: 'vs',
    inherit: true,
    rules: [{ token: 'comment', foreground: '997381', fontStyle: 'italic' }],
    colors: {
      'editor.background': '#fdf6f7',
      'editor.foreground': '#3b1f29',
      'editor.lineHighlightBackground': '#f6e6ea',
      'editor.lineHighlightBorder': '#f6e6ea',
      'editorLineNumber.foreground': '#b7919c',
      'editorLineNumber.activeForeground': '#3b1f29',
      'editorCursor.foreground': '#9d174d',
    },
  },
};

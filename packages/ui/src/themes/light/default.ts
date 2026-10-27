import { DEFAULT_CHROME } from '@openheaders/core/chrome';
import type { ThemeVariant } from '../types';

export const lightDefault: ThemeVariant = {
  id: 'default',
  mode: 'light',
  labelKey: 'workbench.settings.def.appearance.lightVariant.option.default.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.option.default.description',
  honorsAccentColor: true,
  dirtyTone: '#ff7875',
  unresolvedTone: '#f5222d',
  saveAccent: '#f5722d',
  antdTokens: {
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    // Darker than antd's default so the gutter between the dock and
    // the editor "cards" reads at a glance against white content.
    colorBgLayout: DEFAULT_CHROME.light.topBar,
    // antd's light borders (#d9d9d9 / #f0f0f0) wash out on the white
    // cards; darkened so hairlines and dividers stay visible.
    colorBorder: '#c9c9c9',
    colorBorderSecondary: '#dcdcdc',
    colorSplit: '#dcdcdc',
    // antd's lime success (#52c41a) reads at ~2:1 on white; one step
    // darker keeps status text, tags and dots legible. antd lightens
    // the seed for the wash and border, which muddies from a dark
    // seed, so the stock pale pair is pinned.
    colorSuccess: '#389e0d',
    colorSuccessBg: '#f6ffed',
    colorSuccessBorder: '#b7eb8f',
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

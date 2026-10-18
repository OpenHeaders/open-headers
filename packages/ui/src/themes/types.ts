import type { MessageKey } from '@openheaders/i18n';
import type { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

/** Subset of Monaco's IStandaloneThemeData we need locally. Avoids
 *  pulling a `monaco-editor` type dependency into the registry, since
 *  the registry is consumed by both the bootstrap (which has monaco)
 *  and the workbench React tree (which doesn't import monaco at top
 *  level). */
export interface MonacoThemeDefinition {
  base: 'vs' | 'vs-dark' | 'hc-light' | 'hc-black';
  inherit: boolean;
  rules: { token: string; foreground?: string; background?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

export interface ThemeVariant {
  /** Stable id stored in `appearance.lightVariant` / `appearance.darkVariant`. */
  id: string;
  mode: ThemeMode;
  labelKey: MessageKey;
  /** Shown as a tooltip on the settings row. */
  descriptionKey: MessageKey;
  /** When false, the variant pins its own primary and ignores
   *  `appearance.accentColor` (high-contrast and tinted variants). */
  honorsAccentColor: boolean;
  /** The color every "differs from the saved entity" mark wears (the
   *  unsaved dots, the section count badge's fill under a white
   *  number) — see `themes/dirty-tone.ts`. A dark variant pins a deep
   *  red so white reads on it; the light variants keep the salmon. */
  dirtyTone: string;
  /** The commit action's accent — the fill under the white label of
   *  the editor shell's Save while the form is dirty and of every
   *  "do it" button cut from it (the value editors' Save, the variable
   *  popover's, the cookie editor's, the quick editor's, the HAR
   *  import, the companion download). A dark variant pins a deeper
   *  orange so white reads on it; the light variants keep the brand
   *  orange. */
  saveAccent: string;
  /** Tokens merged into Ant Design's ConfigProvider on top of the
   *  algorithm-derived defaults. */
  antdTokens: NonNullable<ThemeConfig['token']>;
  /** Monaco theme id this variant uses. Must match a key registered by
   *  `registerMonacoVariantThemes` in `themes/monaco.ts`. */
  monacoTheme: string;
  /** Monaco theme definition the bootstrap registers under `monacoTheme`. */
  monacoDefinition: MonacoThemeDefinition;
}

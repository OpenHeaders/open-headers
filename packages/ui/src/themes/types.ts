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
  /** Tokens merged into Ant Design's ConfigProvider on top of the
   *  algorithm-derived defaults. */
  antdTokens: NonNullable<ThemeConfig['token']>;
  /** Monaco theme id this variant uses. Must match a key registered by
   *  `registerMonacoVariantThemes` in `themes/monaco.ts`. */
  monacoTheme: string;
  /** Monaco theme definition the bootstrap registers under `monacoTheme`. */
  monacoDefinition: MonacoThemeDefinition;
}

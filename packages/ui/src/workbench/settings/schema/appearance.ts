/**
 * Appearance category schemas.
 *
 * Theme is split across two orthogonal axes:
 *   • `appearance.theme` — light / dark / auto (mode).
 *   • `appearance.lightVariant` / `appearance.darkVariant` — palette
 *     within the resolved mode. Each variant is defined in
 *     `src/themes/` and ships its own Ant Design token overrides plus a
 *     Monaco theme. ThemeContext consumes the active variant and feeds
 *     ConfigProvider; the Monaco bootstrap registers all variants once
 *     so editor surfaces can switch in place.
 *
 * Density and accent color stay flat. `appearance.accentColor` only
 * applies when the active variant has `honorsAccentColor: true` — the
 * tinted and high-contrast variants pin their own primary so the
 * palette stays internally consistent.
 */

import { DARK_VARIANT_IDS, getDarkVariant, getLightVariant, LIGHT_VARIANT_IDS } from '@openheaders/ui/themes';
import * as v from 'valibot';
import { registerSetting } from '../registry';
import type { FontPreset } from '../types';

// ── valibot schemas ──────────────────────────────────────────────────

/**
 * Curated UI font-family presets for the chrome (everything outside
 * the editor). Every entry either bundles its font (via `@fontsource`
 * imports in `popup.less` / `rules.less` / `panel.css`) or is the
 * OS-native fallback stack — availability is guaranteed in both cases,
 * so we don't probe `document.fonts.check()` here.
 *
 * Ant Design's component sizing is tuned against sans-serif metrics,
 * so the bundled additions are deliberately limited: Inter as the
 * cross-OS default, Atkinson Hyperlegible for accessibility, Press
 * Start 2P as a novelty pick that doubles as our wordmark font.
 */
export const APPEARANCE_FONT_PRESETS: ReadonlyArray<FontPreset> = [
  {
    id: 'inter',
    label: 'Inter',
    descriptionKey: 'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description',
    stack: "'Inter', system-ui, -apple-system, sans-serif",
    // Bundled in `popup.less` / `rules.less` / `panel.css` via the
    // `@fontsource/inter` package — availability is guaranteed.
  },
  {
    id: 'system',
    label: 'System Sans',
    descriptionKey: 'workbench.settings.def.appearance.fontFamilyPreset.option.system.description',
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    descriptionKey: 'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description',
    stack: "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
    // Bundled in `popup.less` / `rules.less` / `panel.css` via the
    // `@fontsource/atkinson-hyperlegible` package — availability is guaranteed.
  },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P',
    descriptionKey: 'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description',
    stack: "'Press Start 2P', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    // Bundled, registered programmatically — availability guaranteed.
  },
] as const;

const fontFamilyPresetSchema = v.picklist(APPEARANCE_FONT_PRESETS.map((p) => p.id) as [string, ...string[]]);

/** Resolve the active chrome font-family stack for a preset id.
 *  Falls back to System Sans if the id is unknown. */
export function resolveAppearanceFontFamily(preset: string): string {
  const def = APPEARANCE_FONT_PRESETS.find((p) => p.id === preset);
  return def?.stack ?? APPEARANCE_FONT_PRESETS[1].stack;
}

/** Default `appearance.fontFamilyPreset` resolved per OS at first run.
 *  macOS: keep the native SF Pro / SF Pro Text rendering (with its
 *  built-in optical sizing). Everywhere else: bundled Inter, so the
 *  Windows / Linux fallback stacks (Segoe UI / Roboto / Noto) don't
 *  produce a per-machine inconsistent look. The user's explicit pick
 *  always wins once they change it. */
function defaultFontFamilyPreset(): string {
  if (typeof navigator === 'undefined') return 'inter';
  // Modern browsers expose `userAgentData.platform`; fall back to the
  // legacy `navigator.platform` (deprecated but still ubiquitous).
  // biome-ignore lint/suspicious/noExplicitAny: navigator.userAgentData isn't yet in the lib.dom type
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform) ? 'system' : 'inter';
}

const themeSchema = v.picklist(['light', 'dark', 'auto']);
// The browser locale reflects the browser's UI language, not the OS
// region format, so hour-cycle can't be derived reliably — it's an
// explicit user choice instead.
const clockFormatSchema = v.picklist(['24h', '12h']);
const densitySchema = v.picklist(['comfortable', 'compact']);
const editorHeaderPositionSchema = v.picklist(['top', 'bottom']);
const accentSchema = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color like #1677ff'));
const lightVariantSchema = v.picklist(LIGHT_VARIANT_IDS);
const darkVariantSchema = v.picklist(DARK_VARIANT_IDS);
// UI scale is a multiplier applied to Ant Design's `token.fontSize`
// (and, transitively, to component sizing — controlHeight, paddings,
// etc. are all derived from the seed font size).
const uiScaleSchema = v.picklist([0.7, 0.8, 0.9, 1, 1.1, 1.25]);

export type Theme = v.InferOutput<typeof themeSchema>;
export type ClockFormat = v.InferOutput<typeof clockFormatSchema>;
export type Density = v.InferOutput<typeof densitySchema>;
export type EditorHeaderPosition = v.InferOutput<typeof editorHeaderPositionSchema>;
export type LightVariant = v.InferOutput<typeof lightVariantSchema>;
export type DarkVariant = v.InferOutput<typeof darkVariantSchema>;
export type UiScale = v.InferOutput<typeof uiScaleSchema>;
export type AppearanceFontFamilyPreset = v.InferOutput<typeof fontFamilyPresetSchema>;

// ── Type augmentation ────────────────────────────────────────────────

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'appearance.theme': Theme;
    'appearance.clockFormat': ClockFormat;
    'appearance.density': Density;
    'appearance.accentColor': string;
    'appearance.lightVariant': LightVariant;
    'appearance.darkVariant': DarkVariant;
    'appearance.uiScale': UiScale;
    'appearance.fontFamilyPreset': AppearanceFontFamilyPreset;
    'appearance.editorHeaderPosition': EditorHeaderPosition;
  }
}

// ── Registration ─────────────────────────────────────────────────────

registerSetting({
  key: 'appearance.theme',
  type: 'enum',
  default: 'auto',
  schema: themeSchema,
  labelKey: 'workbench.settings.def.appearance.theme.label',
  descriptionKey: 'workbench.settings.def.appearance.theme.description',
  category: 'appearance',
  tags: ['dark mode', 'light mode', 'color scheme'],
  scope: 'user',
  enumOptions: [
    { value: 'light', labelKey: 'workbench.settings.def.appearance.theme.option.light.label' },
    { value: 'dark', labelKey: 'workbench.settings.def.appearance.theme.option.dark.label' },
    {
      value: 'auto',
      labelKey: 'workbench.settings.def.appearance.theme.option.auto.label',
      descriptionKey: 'workbench.settings.def.appearance.theme.option.auto.description',
    },
  ],
});

registerSetting({
  key: 'appearance.lightVariant',
  type: 'enum',
  default: 'default',
  schema: lightVariantSchema,
  labelKey: 'workbench.settings.def.appearance.lightVariant.label',
  descriptionKey: 'workbench.settings.def.appearance.lightVariant.description',
  category: 'appearance',
  tags: ['palette', 'variant', 'light', 'high contrast', 'accessibility'],
  scope: 'user',
  enumOptions: LIGHT_VARIANT_IDS.map((id) => {
    const v = getLightVariant(id);
    return { value: id, labelKey: v.labelKey, descriptionKey: v.descriptionKey };
  }),
});

registerSetting({
  key: 'appearance.darkVariant',
  type: 'enum',
  default: 'default',
  schema: darkVariantSchema,
  labelKey: 'workbench.settings.def.appearance.darkVariant.label',
  descriptionKey: 'workbench.settings.def.appearance.darkVariant.description',
  category: 'appearance',
  tags: ['palette', 'variant', 'dark', 'high contrast', 'accessibility'],
  scope: 'user',
  enumOptions: DARK_VARIANT_IDS.map((id) => {
    const v = getDarkVariant(id);
    return { value: id, labelKey: v.labelKey, descriptionKey: v.descriptionKey };
  }),
});

registerSetting({
  key: 'appearance.uiScale',
  type: 'enum',
  default: 1,
  schema: uiScaleSchema,
  labelKey: 'workbench.settings.def.appearance.uiScale.label',
  descriptionKey: 'workbench.settings.def.appearance.uiScale.description',
  category: 'appearance',
  tags: ['zoom', 'scale', 'font size', 'accessibility', 'large text'],
  scope: 'user',
  enumOptions: [
    {
      value: 0.7,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.0.7.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.0.7.description',
    },
    {
      value: 0.8,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.0.8.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.0.8.description',
    },
    {
      value: 0.9,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.0.9.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.0.9.description',
    },
    {
      value: 1,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.1.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.1.description',
    },
    {
      value: 1.1,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.1.1.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.1.1.description',
    },
    {
      value: 1.25,
      labelKey: 'workbench.settings.def.appearance.uiScale.option.1.25.label',
      descriptionKey: 'workbench.settings.def.appearance.uiScale.option.1.25.description',
    },
  ],
});

registerSetting({
  key: 'appearance.fontFamilyPreset',
  type: 'enum',
  default: defaultFontFamilyPreset(),
  schema: fontFamilyPresetSchema,
  labelKey: 'workbench.settings.def.appearance.fontFamilyPreset.label',
  descriptionKey: 'workbench.settings.def.appearance.fontFamilyPreset.description',
  category: 'appearance',
  tags: ['font', 'typography', 'sans', 'inter', 'atkinson', 'accessibility'],
  scope: 'user',
  enumOptions: APPEARANCE_FONT_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
    descriptionKey: p.descriptionKey,
  })),
});

registerSetting({
  key: 'appearance.density',
  type: 'enum',
  default: 'comfortable',
  schema: densitySchema,
  labelKey: 'workbench.settings.def.appearance.density.label',
  descriptionKey: 'workbench.settings.def.appearance.density.description',
  category: 'appearance',
  tags: ['compact', 'spacing', 'padding'],
  scope: 'user',
  enumOptions: [
    { value: 'comfortable', labelKey: 'workbench.settings.def.appearance.density.option.comfortable.label' },
    { value: 'compact', labelKey: 'workbench.settings.def.appearance.density.option.compact.label' },
  ],
});

registerSetting({
  key: 'appearance.editorHeaderPosition',
  type: 'enum',
  default: 'top',
  schema: editorHeaderPositionSchema,
  labelKey: 'workbench.settings.def.appearance.editorHeaderPosition.label',
  descriptionKey: 'workbench.settings.def.appearance.editorHeaderPosition.description',
  category: 'appearance',
  tags: ['header', 'toolbar', 'layout', 'save', 'actions', 'bottom'],
  scope: 'user',
  enumOptions: [
    {
      value: 'top',
      labelKey: 'workbench.settings.def.appearance.editorHeaderPosition.option.top.label',
      descriptionKey: 'workbench.settings.def.appearance.editorHeaderPosition.option.top.description',
    },
    {
      value: 'bottom',
      labelKey: 'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label',
      descriptionKey: 'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description',
    },
  ],
});

registerSetting({
  key: 'appearance.clockFormat',
  type: 'enum',
  default: '24h',
  schema: clockFormatSchema,
  labelKey: 'workbench.settings.def.appearance.clockFormat.label',
  descriptionKey: 'workbench.settings.def.appearance.clockFormat.description',
  category: 'appearance',
  tags: ['time', 'clock', '24-hour', '12-hour', 'am', 'pm', 'timestamp'],
  scope: 'user',
  // Option descriptions are literal format examples (13:41 / 01:41 PM)
  // — never keyed (plan §3).
  enumOptions: [
    { value: '24h', labelKey: 'workbench.settings.def.appearance.clockFormat.option.24h.label', description: '13:41' },
    {
      value: '12h',
      labelKey: 'workbench.settings.def.appearance.clockFormat.option.12h.label',
      description: '01:41 PM',
    },
  ],
});

registerSetting({
  key: 'appearance.accentColor',
  type: 'color',
  default: '#1677ff',
  schema: accentSchema,
  labelKey: 'workbench.settings.def.appearance.accentColor.label',
  descriptionKey: 'workbench.settings.def.appearance.accentColor.description',
  category: 'appearance',
  tags: ['color', 'primary', 'brand', 'theme'],
  scope: 'user',
});

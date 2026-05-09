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

import * as v from 'valibot';
import { DARK_VARIANT_IDS, LIGHT_VARIANT_IDS, getDarkVariant, getLightVariant } from '@/themes';
import { registerSetting } from '../registry';

// ── valibot schemas ──────────────────────────────────────────────────

/**
 * Curated UI font-family presets for the chrome (everything outside
 * the editor). Same shape as `EDITOR_FONT_PRESETS` — `stack` is a
 * ready-to-use CSS family list ending in `sans-serif`, `probe` is the
 * primary family name fed to `document.fonts.check()`. The OS stack
 * and the custom escape hatch carry `probe: null`.
 *
 * Ant Design's component sizing is tuned against system sans-serif
 * metrics, so the curated additions are limited to two well-behaved
 * proportional fonts: Inter (modern app UI) and Atkinson Hyperlegible
 * (accessibility-first). Anything else goes through Custom.
 */
export const APPEARANCE_FONT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  stack: string;
  probe: string | null;
}> = [
  {
    id: 'system',
    label: 'System Sans',
    description: 'Operating-system default UI sans — San Francisco on macOS, Segoe UI on Windows, Roboto on Linux.',
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    probe: null,
  },
  {
    id: 'inter',
    label: 'Inter',
    description: 'Free modern UI sans tuned for screens. Falls back to System Sans if not installed.',
    stack: "'Inter', system-ui, -apple-system, sans-serif",
    probe: 'Inter',
  },
  {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    description: 'Free sans designed for low-vision readability — distinctive letterforms reduce character confusion.',
    stack: "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
    probe: 'Atkinson Hyperlegible',
  },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P',
    description: 'The pixel-style display font we ship with the app. Bundled — always available. A novelty pick: legible but tall and wide; chrome paddings will look generous.',
    stack: "'Press Start 2P', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    // Bundled, registered programmatically — availability guaranteed.
    probe: null,
  },
] as const;

const fontFamilyPresetSchema = v.picklist(APPEARANCE_FONT_PRESETS.map((p) => p.id) as [string, ...string[]]);

/** Resolve the active chrome font-family stack for a preset id.
 *  Falls back to System Sans if the id is unknown. */
export function resolveAppearanceFontFamily(preset: string): string {
  const def = APPEARANCE_FONT_PRESETS.find((p) => p.id === preset);
  return def?.stack ?? APPEARANCE_FONT_PRESETS[0].stack;
}

const themeSchema = v.picklist(['light', 'dark', 'auto']);
const densitySchema = v.picklist(['comfortable', 'compact']);
const accentSchema = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color like #1677ff'));
const lightVariantSchema = v.picklist(LIGHT_VARIANT_IDS);
const darkVariantSchema = v.picklist(DARK_VARIANT_IDS);
// UI scale is a multiplier applied to Ant Design's `token.fontSize`
// (and, transitively, to component sizing — controlHeight, paddings,
// etc. are all derived from the seed font size).
const uiScaleSchema = v.picklist([0.7, 0.8, 0.9, 1, 1.1, 1.25]);

export type Theme = v.InferOutput<typeof themeSchema>;
export type Density = v.InferOutput<typeof densitySchema>;
export type LightVariant = v.InferOutput<typeof lightVariantSchema>;
export type DarkVariant = v.InferOutput<typeof darkVariantSchema>;
export type UiScale = v.InferOutput<typeof uiScaleSchema>;
export type AppearanceFontFamilyPreset = v.InferOutput<typeof fontFamilyPresetSchema>;

// ── Type augmentation ────────────────────────────────────────────────

declare module '../types' {
  interface SettingsMap {
    'appearance.theme': Theme;
    'appearance.density': Density;
    'appearance.accentColor': string;
    'appearance.lightVariant': LightVariant;
    'appearance.darkVariant': DarkVariant;
    'appearance.uiScale': UiScale;
    'appearance.fontFamilyPreset': AppearanceFontFamilyPreset;
  }
}

// ── Registration ─────────────────────────────────────────────────────

registerSetting({
  key: 'appearance.theme',
  type: 'enum',
  default: 'auto',
  schema: themeSchema,
  label: 'Color Theme',
  description: 'Controls the overall color theme of the app.',
  category: 'appearance',
  tags: ['dark mode', 'light mode', 'color scheme'],
  scope: 'user',
  enumOptions: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Follow system', description: 'Match your operating system' },
  ],
});

registerSetting({
  key: 'appearance.lightVariant',
  type: 'enum',
  default: 'default',
  schema: lightVariantSchema,
  label: 'Light Theme Variant',
  description: 'Palette used when the resolved color theme is light.',
  category: 'appearance',
  tags: ['palette', 'variant', 'light', 'high contrast', 'accessibility'],
  scope: 'user',
  enumOptions: LIGHT_VARIANT_IDS.map((id) => {
    const v = getLightVariant(id);
    return { value: id, label: v.label, description: v.description };
  }),
});

registerSetting({
  key: 'appearance.darkVariant',
  type: 'enum',
  default: 'default',
  schema: darkVariantSchema,
  label: 'Dark Theme Variant',
  description: 'Palette used when the resolved color theme is dark.',
  category: 'appearance',
  tags: ['palette', 'variant', 'dark', 'high contrast', 'accessibility'],
  scope: 'user',
  enumOptions: DARK_VARIANT_IDS.map((id) => {
    const v = getDarkVariant(id);
    return { value: id, label: v.label, description: v.description };
  }),
});

registerSetting({
  key: 'appearance.uiScale',
  type: 'enum',
  default: 1,
  schema: uiScaleSchema,
  label: 'UI Scale',
  description: 'Scales the entire chrome — buttons, text, paddings, controls — without changing the editor font size.',
  category: 'appearance',
  tags: ['zoom', 'scale', 'font size', 'accessibility', 'large text'],
  scope: 'user',
  enumOptions: [
    {
      value: 0.7,
      label: 'Tiny (70%)',
      description: 'Densest layout — useful when paired with the Press Start 2P UI font, which renders unusually tall and wide.',
    },
    { value: 0.8, label: 'Compact (80%)', description: 'Tighter chrome that still keeps comfortable click targets.' },
    { value: 0.9, label: 'Small (90%)', description: 'Slightly tighter than default — fits more on screen.' },
    { value: 1, label: 'Normal (100%)', description: 'Default chrome size.' },
    { value: 1.1, label: 'Large (110%)', description: 'Slightly enlarged for easier reading.' },
    { value: 1.25, label: 'Extra Large (125%)', description: 'Maximum chrome scale — best for accessibility.' },
  ],
});

registerSetting({
  key: 'appearance.fontFamilyPreset',
  type: 'enum',
  default: 'system',
  schema: fontFamilyPresetSchema,
  label: 'UI Font Family',
  description: 'Curated sans-serif stacks for the app chrome. Names with the "Falls back" tag are not installed on this system. Editor surfaces have their own font setting.',
  category: 'appearance',
  tags: ['font', 'typography', 'sans', 'inter', 'atkinson', 'accessibility'],
  scope: 'user',
  enumOptions: APPEARANCE_FONT_PRESETS.map((p) => ({ value: p.id, label: p.label, description: p.description })),
});

registerSetting({
  key: 'appearance.density',
  type: 'enum',
  default: 'comfortable',
  schema: densitySchema,
  label: 'UI Density',
  description: 'Compact mode reduces padding in lists, tables and forms.',
  category: 'appearance',
  tags: ['compact', 'spacing', 'padding'],
  scope: 'user',
  enumOptions: [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
  ],
});

registerSetting({
  key: 'appearance.accentColor',
  type: 'color',
  default: '#1677ff',
  schema: accentSchema,
  label: 'Accent Color',
  description:
    'The primary color used for buttons, links, and active highlights. Applies only to the Default theme variants — high-contrast and tinted variants pin their own accent.',
  category: 'appearance',
  tags: ['color', 'primary', 'brand', 'theme'],
  scope: 'user',
});

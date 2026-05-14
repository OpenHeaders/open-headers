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
import { DARK_VARIANT_IDS, LIGHT_VARIANT_IDS, getDarkVariant, getLightVariant } from '@openheaders/ui/themes';
import { registerSetting } from '../registry';

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
export const APPEARANCE_FONT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  stack: string;
}> = [
  {
    id: 'inter',
    label: 'Inter',
    description:
      'Bundled UI sans designed for screens — renders identically on every operating system, so the app looks the same on macOS, Windows, and Linux.',
    stack: "'Inter', system-ui, -apple-system, sans-serif",
    // Bundled in `popup.less` / `rules.less` / `panel.css` via the
    // `@fontsource/inter` package — availability is guaranteed.
  },
  {
    id: 'system',
    label: 'System Sans',
    description:
      'Operating-system default UI sans — San Francisco on macOS, Segoe UI on Windows, Roboto on Linux. Use this if you prefer the native look at the cost of cross-platform consistency.',
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    description:
      'Sans designed for low-vision readability — distinctive letterforms reduce character confusion. Bundled — always available.',
    stack: "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
    // Bundled in `popup.less` / `rules.less` / `panel.css` via the
    // `@fontsource/atkinson-hyperlegible` package — availability is guaranteed.
  },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P',
    description: 'The pixel-style display font we ship with the app. Bundled — always available. A novelty pick: legible but tall and wide; chrome paddings will look generous.',
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

declare module '@openheaders/ui/workbench/settings/types' {
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
  default: defaultFontFamilyPreset(),
  schema: fontFamilyPresetSchema,
  label: 'UI Font Family',
  description:
    'Curated sans-serif stacks for the app chrome. Default is Inter on Windows / Linux for cross-platform consistency, and System Sans on macOS to keep SF Pro\'s native optical sizing. Every option is bundled with the extension. Editor surfaces have their own font setting.',
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

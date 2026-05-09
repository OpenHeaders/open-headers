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

const themeSchema = v.picklist(['light', 'dark', 'auto']);
const densitySchema = v.picklist(['comfortable', 'compact']);
const accentSchema = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color like #1677ff'));
const lightVariantSchema = v.picklist(LIGHT_VARIANT_IDS);
const darkVariantSchema = v.picklist(DARK_VARIANT_IDS);
// UI scale is a multiplier applied to Ant Design's `token.fontSize`
// (and, transitively, to component sizing — controlHeight, paddings,
// etc. are all derived from the seed font size).
const uiScaleSchema = v.picklist([0.9, 1, 1.1, 1.25]);

export type Theme = v.InferOutput<typeof themeSchema>;
export type Density = v.InferOutput<typeof densitySchema>;
export type LightVariant = v.InferOutput<typeof lightVariantSchema>;
export type DarkVariant = v.InferOutput<typeof darkVariantSchema>;
export type UiScale = v.InferOutput<typeof uiScaleSchema>;

// ── Type augmentation ────────────────────────────────────────────────

declare module '../types' {
  interface SettingsMap {
    'appearance.theme': Theme;
    'appearance.density': Density;
    'appearance.accentColor': string;
    'appearance.lightVariant': LightVariant;
    'appearance.darkVariant': DarkVariant;
    'appearance.uiScale': UiScale;
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
    { value: 0.9, label: 'Small (90%)', description: 'Compact chrome — fits more on screen.' },
    { value: 1, label: 'Normal (100%)', description: 'Default chrome size.' },
    { value: 1.1, label: 'Large (110%)', description: 'Slightly enlarged for easier reading.' },
    { value: 1.25, label: 'Extra Large (125%)', description: 'Maximum chrome scale — best for accessibility.' },
  ],
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

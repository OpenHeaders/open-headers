/**
 * Appearance category schemas.
 *
 * Theme, density, and accent color. All three live in the default dict
 * under `settings.user` — the settings store is the single source of
 * truth. ThemeContext consumes these via `useSettingValue` and
 * translates them into Ant's ConfigProvider token overrides.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

// ── valibot schemas ──────────────────────────────────────────────────

const themeSchema = v.picklist(['light', 'dark', 'auto']);
const densitySchema = v.picklist(['comfortable', 'compact']);
const accentSchema = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color like #1677ff'));

export type Theme = v.InferOutput<typeof themeSchema>;
export type Density = v.InferOutput<typeof densitySchema>;

// ── Type augmentation ────────────────────────────────────────────────

declare module '../types' {
  interface SettingsMap {
    'appearance.theme': Theme;
    'appearance.density': Density;
    'appearance.accentColor': string;
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
  description: 'The primary color used for buttons, links, and active highlights.',
  category: 'appearance',
  tags: ['color', 'primary', 'brand', 'theme'],
  scope: 'user',
});

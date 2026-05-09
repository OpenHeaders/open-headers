/**
 * Theme variant registry.
 *
 * Each variant is a self-contained palette: an Ant Design token
 * override map for the chrome and a Monaco theme definition for the
 * editor surfaces. ConfigProvider and the Monaco bootstrap consume
 * variants from here — there is no other source of palette data.
 *
 * The two axes — mode (`appearance.theme`) and variant
 * (`appearance.lightVariant` / `appearance.darkVariant`) — are
 * orthogonal. The mode picks which sub-registry we look in; the
 * variant id picks the entry within it.
 */

import { darkArctic } from './dark/arctic';
import { darkDefault } from './dark/default';
import { darkDim } from './dark/dim';
import { darkForest } from './dark/forest';
import { darkHighContrast } from './dark/highContrast';
import { darkMidnight } from './dark/midnight';
import { lightCool } from './light/cool';
import { lightDefault } from './light/default';
import { lightHighContrast } from './light/highContrast';
import { lightRose } from './light/rose';
import { lightSepia } from './light/sepia';
import { lightWarm } from './light/warm';
import type { ThemeMode, ThemeVariant } from './types';

const lightVariants = {
  default: lightDefault,
  highContrast: lightHighContrast,
  warm: lightWarm,
  cool: lightCool,
  rose: lightRose,
  sepia: lightSepia,
} as const;

const darkVariants = {
  default: darkDefault,
  highContrast: darkHighContrast,
  dim: darkDim,
  midnight: darkMidnight,
  forest: darkForest,
  arctic: darkArctic,
} as const;

export type LightVariantId = keyof typeof lightVariants;
export type DarkVariantId = keyof typeof darkVariants;

/** Display order in the settings dropdown. Default first, then HC, then
 *  the tinted variants — keeps the most common picks at the top. */
export const LIGHT_VARIANT_IDS = [
  'default',
  'highContrast',
  'warm',
  'cool',
  'rose',
  'sepia',
] as const satisfies readonly LightVariantId[];
export const DARK_VARIANT_IDS = [
  'default',
  'highContrast',
  'dim',
  'midnight',
  'forest',
  'arctic',
] as const satisfies readonly DarkVariantId[];

/** Fallback when an unknown id is read from storage (e.g. after a
 *  variant is removed). Both fallbacks are `default`. */
export function getLightVariant(id: string): ThemeVariant {
  return lightVariants[id as LightVariantId] ?? lightVariants.default;
}

export function getDarkVariant(id: string): ThemeVariant {
  return darkVariants[id as DarkVariantId] ?? darkVariants.default;
}

export function getVariant(mode: ThemeMode, id: string): ThemeVariant {
  return mode === 'dark' ? getDarkVariant(id) : getLightVariant(id);
}

export function listVariants(mode: ThemeMode): readonly ThemeVariant[] {
  const ids = mode === 'dark' ? DARK_VARIANT_IDS : LIGHT_VARIANT_IDS;
  return ids.map((id) => (mode === 'dark' ? getDarkVariant(id) : getLightVariant(id)));
}

/** Every variant in the registry, used by the Monaco bootstrap to
 *  register one Monaco theme per variant. */
export function allVariants(): readonly ThemeVariant[] {
  return [...listVariants('light'), ...listVariants('dark')];
}

export type { ThemeMode, ThemeVariant } from './types';

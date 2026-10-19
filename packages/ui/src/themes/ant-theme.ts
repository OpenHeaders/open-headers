/**
 * The Ant Design theme config for a resolved appearance — ONE
 * definition for every surface that paints the chrome: the theme
 * provider inside the app, and the root error fallback that mounts
 * above every provider and must still look like the app.
 *
 * Pure: the resolved variant and the appearance values in, the
 * `ConfigProvider` config out. Nothing here reads a store.
 */

import { type ThemeConfig, theme } from 'antd';
import { darkLinkAlgorithm } from './dark/link-tokens';
import type { ThemeVariant } from './types';

export interface AntThemeInput {
  variant: ThemeVariant;
  isDarkMode: boolean;
  isCompactMode: boolean;
  accentColor: string;
  uiScale: number;
  fontFamily: string;
}

/** The primary the variant paints with: its own pin, or the accent when it honours one. */
export function resolvePrimaryColor(variant: ThemeVariant, accentColor: string): string {
  return variant.honorsAccentColor ? accentColor : (variant.antdTokens.colorPrimary ?? accentColor);
}

export function buildAntTheme(input: AntThemeInput): ThemeConfig {
  const { variant, isDarkMode, isCompactMode, accentColor, uiScale, fontFamily } = input;
  const primaryColor = resolvePrimaryColor(variant, accentColor);
  const algorithms: Array<typeof theme.darkAlgorithm> = [isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (isCompactMode) algorithms.push(theme.compactAlgorithm);
  // Dark links read in a pale tint of the primary — see link-tokens.
  if (isDarkMode) algorithms.push(darkLinkAlgorithm(primaryColor));
  return {
    algorithm: algorithms.length === 1 ? algorithms[0] : algorithms,
    token: {
      ...variant.antdTokens,
      // Accent color is user-controlled only on variants that opt in.
      // Tinted / high-contrast variants pin their own primary so the
      // palette stays internally consistent.
      ...(variant.honorsAccentColor ? { colorPrimary: accentColor } : {}),
      // UI scale rides on the seed `fontSize` token. AntD derives
      // controlHeight, paddings, line-heights, and icon sizes from
      // this value via its algorithm, so a single multiplier rescales
      // the entire chrome without per-component overrides. Editor
      // surfaces read `editor.fontSize` directly and are unaffected.
      fontSize: Math.round(14 * uiScale),
      // Chrome font from the appearance preset takes priority over
      // the variant's default fontFamily. Editor font is independent.
      fontFamily,
    },
    components: {
      // Overlay menus (every menu in the app is a Dropdown — create
      // menus, `⋯` menus, context menus, submenus) render at the
      // sidebar trees' 12px density: stock antd menu rows read
      // oversized next to the compact rails. Row ≈ 26px.
      Dropdown: {
        fontSize: Math.round(12 * uiScale),
        paddingBlock: 3,
        controlPaddingHorizontal: 10,
      },
      // Segmented controls select in the accent: the stock thumb is a
      // barely-lifted fill that reads near-invisible on the dark
      // grounds and faint on the light ones. A wash of the accent
      // under the accent-colored label — the selected-tag look, not
      // a solid button.
      Segmented: {
        itemSelectedBg: `color-mix(in srgb, ${primaryColor} 18%, transparent)`,
        itemSelectedColor: primaryColor,
      },
    },
  };
}

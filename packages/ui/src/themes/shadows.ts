/**
 * Overlay shadows are off in every variant, both modes. antd derives
 * EVERY elevation shadow — the box-shadow aliases (dropdowns,
 * selects), the Popover/Tooltip `filter: dropShadowPopover`, and the
 * drawer / card / tabs-overflow shadows — from the single internal
 * `colorShadow` base (`#000` under the light algorithm, a WHITE
 * rgba(255,255,255,0.2) under the dark one, which haloed every
 * overlay against the dark chrome). Elevation here reads from the
 * surfaces themselves — `colorBgElevated` in dark, hairline borders
 * and the layout gutter in light — so the cast shadow adds nothing
 * but noise.
 *
 * Overriding the base repaints them all: antd's alias derivation
 * reads `colorShadow` before computing each shadow and spreads
 * overrides last, so `transparent` zeroes every derived shadow. The
 * token is real but missing from antd's public `AliasToken`, hence
 * the augmentation.
 */

import type { ThemeConfig } from 'antd';

declare module 'antd/es/theme/interface/alias' {
  interface AliasToken {
    /** Base color antd derives every elevation shadow from. */
    colorShadow: string;
  }
}

export const NO_SHADOW_TOKENS: NonNullable<ThemeConfig['token']> = {
  colorShadow: 'transparent',
};

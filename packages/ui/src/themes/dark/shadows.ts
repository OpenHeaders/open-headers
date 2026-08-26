/**
 * Overlay shadows for the dark variants. antd 6's dark algorithm bases
 * EVERY elevation shadow on `colorShadow: rgba(255,255,255,0.2)` — the
 * box-shadow aliases (dropdowns, selects), the Popover/Tooltip
 * `filter: dropShadowPopover`, and the drawer / card / tabs-overflow
 * shadows — so overlays cast a faint WHITE halo against the dark
 * chrome. Elevation here comes from the lighter `colorBgElevated`
 * surface itself; the glow adds nothing but noise.
 *
 * Overriding the single base repaints them all: antd's alias
 * derivation reads `colorShadow` before computing each shadow and
 * spreads overrides last, so `#000` reproduces the light algorithm's
 * black-based values exactly — invisible on dark backgrounds,
 * conventional depth over lighter content. The token is real but
 * missing from antd's public `AliasToken`, hence the augmentation.
 */

import type { ThemeConfig } from 'antd';

declare module 'antd/es/theme/interface/alias' {
  interface AliasToken {
    /** Base color antd derives every elevation shadow from. */
    colorShadow: string;
  }
}

export const DARK_SHADOW_TOKENS: NonNullable<ThemeConfig['token']> = {
  colorShadow: '#000',
};

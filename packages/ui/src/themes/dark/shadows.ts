/**
 * Overlay shadows for the dark variants. antd 6's dark algorithm bases
 * every elevation shadow on `colorShadow: rgba(255,255,255,0.2)`, so
 * popovers, tooltips, and dropdowns cast a faint WHITE halo against
 * the dark chrome. Elevation here comes from the lighter
 * `colorBgElevated` surface itself; the glow adds nothing but noise —
 * so the three public shadow aliases are pinned to the light
 * algorithm's black-based values, which read invisibly on dark
 * backgrounds and keep conventional depth over lighter content.
 */

import type { ThemeConfig } from 'antd';

export const DARK_SHADOW_TOKENS: NonNullable<ThemeConfig['token']> = {
  boxShadow:
    '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  boxShadowSecondary:
    '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  boxShadowTertiary:
    '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
};

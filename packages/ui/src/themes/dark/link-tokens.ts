/**
 * The dark themes' link colour — a white-mixed tint of the primary,
 * set AFTER the dark algorithm. Seeding `colorLink` does not do: the
 * algorithm runs the seed through its dark palette and hands back a
 * duller, darker colour with a hover darker still. Links on a dark
 * ground want the opposite — the reference client's pale periwinkle,
 * lighter on hover — so this mapping step overrides the three link
 * tokens from the primary directly, and every consumer of
 * `token.colorLink` (link buttons, typography links, the popovers'
 * inline links) reads the tint.
 */

import type { theme } from 'antd';

type Algorithm = typeof theme.darkAlgorithm;

/** `#rrggbb` mixed toward white by `ratio` (0 = the colour, 1 = white). */
export function mixWithWhite(hex: string, ratio: number): string {
  const channel = (at: number): string => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16);
    return Math.round(value + (255 - value) * ratio)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export const DARK_LINK_TINT = 0.45;
export const DARK_LINK_HOVER_TINT = 0.6;
export const DARK_LINK_ACTIVE_TINT = 0.3;

/** The mapping step — appended to the dark algorithm chain, never first. */
export function darkLinkAlgorithm(primaryHex: string): Algorithm {
  return (_seed, map) => {
    if (map === undefined) throw new Error('darkLinkAlgorithm runs after the dark algorithm, never first');
    return {
      ...map,
      colorLink: mixWithWhite(primaryHex, DARK_LINK_TINT),
      colorLinkHover: mixWithWhite(primaryHex, DARK_LINK_HOVER_TINT),
      colorLinkActive: mixWithWhite(primaryHex, DARK_LINK_ACTIVE_TINT),
    };
  };
}

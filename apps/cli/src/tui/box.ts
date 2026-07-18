/**
 * Box drawing — pane and detail frames as arrays of exact-width styled
 * rows, ready for horizontal concatenation by the screen composers.
 * Focus renders per §5.1: accent border + bold title on color tiers,
 * `[bracketed]` title on the `none` tier. All measuring is ANSI-aware
 * (visibleWidth), never string length.
 */

import type { ColorTier, GlyphSet } from './capability';
import { truncateToWidth, visibleWidth } from './screen';
import { bold, paint } from './style';

/** Clip to `width` display cells and pad with spaces to exactly `width`. */
export function padToWidth(text: string, width: number, ellipsis = '…'): string {
  const clipped = truncateToWidth(text, width, ellipsis);
  return clipped + ' '.repeat(Math.max(0, width - visibleWidth(clipped)));
}

export interface BoxOptions {
  readonly width: number;
  readonly height: number;
  readonly glyphs: GlyphSet;
  readonly tier: ColorTier;
  /** Pre-styled title segment; measured, truncated when the box is narrow. */
  readonly title?: string;
  /** Label embedded in the bottom border (`└── esc close ──┘`, overlays). */
  readonly bottomLabel?: string;
  readonly focused?: boolean;
}

/**
 * Render a box: top border with embedded title, content lines padded
 * to the inner width, bottom border. Returns exactly `height` rows of
 * exactly `width` cells; surplus content lines are dropped.
 */
export function makeBox(lines: readonly string[], options: BoxOptions): string[] {
  const { width, height, glyphs, tier } = options;
  const focused = options.focused === true;
  const border = (text: string): string => (focused ? paint(text, 'accent', tier) : text);
  const b = glyphs.borders;
  const ellipsis = glyphs.ellipsis;

  const rows: string[] = [];
  const rawTitle = options.title ?? '';
  let top: string;
  if (rawTitle === '' || width < 6) {
    top = border(b.topLeft + b.horizontal.repeat(Math.max(0, width - 2)) + b.topRight);
  } else {
    const label = tier === 'none' && focused ? `[${rawTitle}]` : rawTitle;
    const clipped = truncateToWidth(label, Math.max(1, width - 4), ellipsis);
    const styled = focused && tier !== 'none' ? bold(paint(clipped, 'accent', tier), tier) : clipped;
    const fill = Math.max(0, width - 4 - visibleWidth(clipped));
    top = `${border(b.topLeft)} ${styled} ${border(b.horizontal.repeat(fill))}${border(b.topRight)}`;
  }
  rows.push(top);

  const innerHeight = Math.max(0, height - 2);
  const innerWidth = Math.max(0, width - 2);
  for (let i = 0; i < innerHeight; i += 1) {
    const content = padToWidth(lines[i] ?? '', innerWidth, ellipsis);
    rows.push(border(b.vertical) + content + border(b.vertical));
  }
  const rawBottom = options.bottomLabel ?? '';
  if (rawBottom === '' || width < 6) {
    rows.push(border(b.bottomLeft + b.horizontal.repeat(Math.max(0, width - 2)) + b.bottomRight));
  } else {
    const clipped = truncateToWidth(rawBottom, Math.max(1, width - 4), ellipsis);
    const fill = Math.max(0, width - 4 - visibleWidth(clipped));
    const left = Math.floor(fill / 2);
    rows.push(
      `${border(b.bottomLeft + b.horizontal.repeat(left))} ${clipped} ${border(b.horizontal.repeat(fill - left) + b.bottomRight)}`,
    );
  }
  return rows.slice(0, height);
}

/** Center each line inside `width` cells (empty states, park screen). */
export function centerLine(text: string, width: number, ellipsis = '…'): string {
  const clipped = truncateToWidth(text, width, ellipsis);
  const pad = Math.max(0, Math.floor((width - visibleWidth(clipped)) / 2));
  return padToWidth(' '.repeat(pad) + clipped, width, ellipsis);
}

/**
 * Screen chrome — the header context strip riding the outer frame's
 * top border, the frame bottom border, the footer verb legend, and the
 * single-pane digit tab row. Legends are measured with visibleWidth
 * and drop lowest-priority entries first when the terminal is narrow
 * (TUI_DESIGN.md §6.3) — never assumed widths, never wrapped.
 */

import { padToWidth } from './box';
import type { ColorTier, GlyphSet } from './capability';
import { truncateToWidth, visibleWidth } from './screen';
import { bold, paint } from './style';

export interface ChromeContext {
  readonly width: number;
  readonly glyphs: GlyphSet;
  readonly tier: ColorTier;
}

/** Top border with embedded header segments: `┌ a ─ b ─ c ───────┐`. */
export function composeHeaderLine(segments: readonly string[], ctx: ChromeContext): string {
  const { width, glyphs } = ctx;
  const b = glyphs.borders;
  if (width < 4) return b.horizontal.repeat(Math.max(0, width));
  const joined = segments.filter((segment) => segment !== '').join(` ${b.horizontal} `);
  const clipped = truncateToWidth(joined, Math.max(0, width - 5), glyphs.ellipsis);
  const fill = Math.max(0, width - 4 - visibleWidth(clipped));
  return `${b.topLeft} ${clipped} ${b.horizontal.repeat(fill)}${b.topRight}`;
}

export function composeBottomBorder(ctx: ChromeContext): string {
  const b = ctx.glyphs.borders;
  return b.bottomLeft + b.horizontal.repeat(Math.max(0, ctx.width - 2)) + b.bottomRight;
}

export interface LegendEntry {
  /** Key cap — glyph-table or literal key text, rendered verbatim. */
  readonly cap: string;
  /** Catalog-translated verb. */
  readonly label: string;
}

/**
 * Footer legend: ` cap label · cap label …`, ordered by priority —
 * entries that no longer fit are dropped from the end.
 */
export function composeFooterLegend(entries: readonly LegendEntry[], ctx: ChromeContext): string {
  const separator = ` ${ctx.glyphs.separator} `;
  let line = '';
  for (const entry of entries) {
    const piece = `${entry.cap} ${entry.label}`;
    const candidate = line === '' ? ` ${piece}` : `${line}${separator}${piece}`;
    if (visibleWidth(candidate) > ctx.width) break;
    line = candidate;
  }
  return padToWidth(line, ctx.width, ctx.glyphs.ellipsis);
}

export interface TabEntry {
  readonly digit: number;
  readonly title: string;
  readonly focused: boolean;
}

/** Single-pane mode: the digit row acting as tabs (design §4.1). */
export function composeTabRow(tabs: readonly TabEntry[], ctx: ChromeContext): string {
  const parts = tabs.map((tab) => {
    const label = `${tab.digit} ${tab.title}`;
    if (!tab.focused) return label;
    return ctx.tier === 'none' ? `[${label}]` : bold(paint(label, 'accent', ctx.tier), ctx.tier);
  });
  return padToWidth(` ${parts.join('   ')}`, ctx.width, ctx.glyphs.ellipsis);
}

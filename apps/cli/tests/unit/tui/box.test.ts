/**
 * Box drawing — exact-width rows, title embedding, focus rendering
 * (accent border on color tiers, [brackets] on none), padding.
 */

import { describe, expect, it } from 'vitest';
import { centerLine, makeBox, padToWidth } from '../../../src/tui/box';
import { ASCII_GLYPHS, UNICODE_GLYPHS } from '../../../src/tui/capability';
import { visibleWidth } from '../../../src/tui/screen';

describe('box', () => {
  it('every row is exactly the requested width', () => {
    const rows = makeBox(['a', 'long content that overflows the narrow box'], {
      width: 20,
      height: 5,
      glyphs: UNICODE_GLYPHS,
      tier: 'none',
      title: '1 Workspaces',
    });
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(visibleWidth(row)).toBe(20);
  });

  it('embeds the title after the corner: ┌ title ───┐', () => {
    const [top] = makeBox([], { width: 20, height: 3, glyphs: UNICODE_GLYPHS, tier: 'none', title: '3 Rules' });
    expect(top).toBe('┌ 3 Rules ─────────┐');
  });

  it('focused: [bracketed] title on the none tier, accent border on color tiers', () => {
    const [plainTop] = makeBox([], {
      width: 22,
      height: 3,
      glyphs: UNICODE_GLYPHS,
      tier: 'none',
      title: '2 Environments',
      focused: true,
    });
    expect(plainTop).toContain('[2 Environments]');
    const [colorTop] = makeBox([], {
      width: 22,
      height: 3,
      glyphs: UNICODE_GLYPHS,
      tier: '16',
      title: '2 Environments',
      focused: true,
    });
    expect(colorTop).toContain('\x1b[36m');
    expect(colorTop).toContain('\x1b[1m');
    expect(visibleWidth(colorTop)).toBe(22);
  });

  it('ASCII glyphs draw +--+ borders', () => {
    const rows = makeBox(['x'], { width: 6, height: 3, glyphs: ASCII_GLYPHS, tier: 'none' });
    expect(rows[0]).toBe('+----+');
    expect(rows[1]).toBe('|x   |');
    expect(rows[2]).toBe('+----+');
  });

  it('padToWidth clips and pads to exact cells; centerLine centers', () => {
    expect(padToWidth('abc', 6)).toBe('abc   ');
    expect(visibleWidth(padToWidth('abcdefgh', 6))).toBe(6);
    expect(centerLine('ab', 6)).toBe('  ab  ');
  });
});

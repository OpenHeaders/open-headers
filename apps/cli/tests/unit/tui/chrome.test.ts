/**
 * Screen chrome — header segments on the top border, measured footer
 * legend with tail-drop, digit tab row.
 */

import { describe, expect, it } from 'vitest';
import { UNICODE_GLYPHS } from '../../../src/tui/capability';
import { composeBottomBorder, composeFooterLegend, composeHeaderLine, composeTabRow } from '../../../src/tui/chrome';
import { visibleWidth } from '../../../src/tui/screen';

const CTX = { width: 40, glyphs: UNICODE_GLYPHS, tier: 'none' as const };

describe('chrome', () => {
  it('joins header segments with ─ and fills to the corner', () => {
    const line = composeHeaderLine(['OpenHeaders', 'team-a'], CTX);
    expect(line.startsWith('┌ OpenHeaders ─ team-a ─')).toBe(true);
    expect(line.endsWith('─┐')).toBe(true);
    expect(visibleWidth(line)).toBe(40);
  });

  it('truncates overlong headers instead of wrapping', () => {
    const line = composeHeaderLine(['OpenHeaders', 'a-very-long-workspace-name', 'env: staging'], {
      ...CTX,
      width: 30,
    });
    expect(visibleWidth(line)).toBe(30);
    expect(line.endsWith('┐')).toBe(true);
    expect(line).toContain('…');
  });

  it('footer legend keeps whole entries and drops the tail when narrow', () => {
    const entries = [
      { cap: '↑↓', label: 'move' },
      { cap: '⏎', label: 'open' },
      { cap: 'q', label: 'quit' },
    ];
    const wide = composeFooterLegend(entries, CTX);
    expect(wide.trim()).toBe('↑↓ move · ⏎ open · q quit');
    const narrow = composeFooterLegend(entries, { ...CTX, width: 18 });
    expect(narrow.trim()).toBe('↑↓ move · ⏎ open');
    expect(visibleWidth(narrow)).toBe(18);
  });

  it('tab row brackets the focused pane on the none tier', () => {
    const row = composeTabRow(
      [
        { title: 'Workspaces', focused: false },
        { title: 'Rules', focused: true },
      ],
      CTX,
    );
    expect(row).toContain('Workspaces');
    expect(row).toContain('[Rules]');
  });

  it('bottom border spans the width', () => {
    expect(composeBottomBorder({ ...CTX, width: 6 })).toBe('└────┘');
  });
});

/**
 * Dashboard geometry — full mode tiling, the single-pane collapse
 * below 80 columns / short interiors, chrome-only floor, status-line
 * reservation, and the detail box.
 */

import { describe, expect, it } from 'vitest';
import {
  computeDashboardLayout,
  computeDetailLayout,
  computeHelpLayout,
  computePaletteLayout,
  HELP_BODY_LINES,
  paneBodyHeight,
} from '../../../src/tui/layout';

const REQUEST = { statusLine: false, focused: 'rules' as const, workspaceCount: 2 };

describe('layout', () => {
  it('full mode tiles left column + rules over the whole interior at 80x24', () => {
    const layout = computeDashboardLayout({ columns: 80, rows: 24 }, REQUEST);
    expect(layout.mode).toBe('full');
    const ws = layout.panes.workspaces;
    const envs = layout.panes.environments;
    const rules = layout.panes.rules;
    if (ws === undefined || envs === undefined || rules === undefined) throw new Error('missing pane rects');
    expect(ws.width).toBe(envs.width);
    expect(ws.width + rules.width).toBe(layout.contentWidth);
    // Workspaces hug their rows; environments take the left remainder.
    expect(ws.height).toBe(REQUEST.workspaceCount + 2);
    expect(ws.height + envs.height).toBe(rules.height);
    expect(rules.y).toBe(1);
    expect(layout.frameBottomRow).toBe(22);
    expect(layout.footerRow).toBe(23);
    expect(layout.statusRow).toBeNull();
  });

  it('a status line takes the interior bottom row and shrinks the panes', () => {
    const without = computeDashboardLayout({ columns: 80, rows: 24 }, REQUEST);
    const withStatus = computeDashboardLayout({ columns: 80, rows: 24 }, { ...REQUEST, statusLine: true });
    expect(withStatus.statusRow).toBe(21);
    const rules = withStatus.panes.rules;
    const rulesWithout = without.panes.rules;
    if (rules === undefined || rulesWithout === undefined) throw new Error('missing pane rects');
    expect(rules.height).toBe(rulesWithout.height - 1);
  });

  it('below 80 columns collapses to one pane with a tab row', () => {
    const layout = computeDashboardLayout({ columns: 60, rows: 24 }, REQUEST);
    expect(layout.mode).toBe('single');
    expect(layout.tabsRow).toBe(1);
    expect(layout.panes.workspaces).toBeUndefined();
    expect(layout.panes.rules?.width).toBe(layout.contentWidth);
  });

  it('short interiors collapse to single-pane before giving up entirely', () => {
    const short = computeDashboardLayout({ columns: 100, rows: 12 }, REQUEST);
    expect(short.mode).toBe('single');
    const tiny = computeDashboardLayout({ columns: 100, rows: 5 }, REQUEST);
    expect(tiny.mode).toBe('chrome-only');
    expect(tiny.panes.rules).toBeUndefined();
  });

  it('paneBodyHeight excludes the two border rows', () => {
    expect(paneBodyHeight({ x: 0, y: 0, width: 10, height: 6 })).toBe(4);
  });

  it('detail layout spans the interior; too-small terminals get no box', () => {
    const layout = computeDetailLayout({ columns: 80, rows: 24 });
    expect(layout.box).toEqual({ x: 1, y: 1, width: 78, height: 21 });
    expect(computeDetailLayout({ columns: 80, rows: 4 }).box).toBeNull();
  });

  it('help overlay centers the fixed-body box inside the interior', () => {
    const rect = computeHelpLayout({ columns: 80, rows: 24 });
    expect(rect).toEqual({ x: 11, y: 4, width: 58, height: HELP_BODY_LINES + 2 });
    expect(computeHelpLayout({ columns: 20, rows: 24 })).toBeNull();
    expect(computeHelpLayout({ columns: 80, rows: 4 })).toBeNull();
  });

  it('help overlay clamps to a short interior instead of overflowing it', () => {
    const rect = computeHelpLayout({ columns: 80, rows: 12 });
    expect(rect).not.toBeNull();
    expect(rect?.height).toBe(9);
    expect(rect?.y).toBe(1);
  });

  it('palette layout sizes to the match count and maps its rows', () => {
    const layout = computePaletteLayout({ columns: 80, rows: 24 }, 2);
    expect(layout).not.toBeNull();
    expect(layout?.rect).toEqual({ x: 11, y: 9, width: 58, height: 5 });
    expect(layout?.inputRow).toBe(10);
    expect(layout?.firstActionRow).toBe(11);
    expect(layout?.visibleActions).toBe(2);
    // Zero matches still reserves one body row for the empty line.
    expect(computePaletteLayout({ columns: 80, rows: 24 }, 0)?.rect.height).toBe(4);
    expect(computePaletteLayout({ columns: 24, rows: 24 }, 2)?.rect.width).toBe(22);
    expect(computePaletteLayout({ columns: 21, rows: 24 }, 2)).toBeNull();
  });
});

/**
 * The log's reading of the selection over row numbers
 * (`log-row-selection.ts`): the details row after a click and where an
 * arrow lands. And a row's graph cell as the list draws it
 * (`log-cell.ts`): the host's palette numbers as the theme's tokens,
 * the linear run under the pointer lit by its number, and how far
 * right the row's own cell draws.
 */

import type { WorkspaceTreeLogCellWire, WorkspaceTreeLogRunWire } from '@openheaders/core/bridge';
import { EMPTY_ROW_SELECTION, selectRowOnClick, selectRowOnly } from '@openheaders/ui/shared/selection';
import { GRAPH_LANE_COLORS } from '@openheaders/ui/workbench/components/panels/git/graph';
import { graphCellReach, logCellRow, logRowHighlight } from '@openheaders/ui/workbench/components/panels/git/log-cell';
import { rowClickOutcome, stepRowTarget } from '@openheaders/ui/workbench/components/panels/git/log-row-selection';
import { describe, expect, it } from 'vitest';

const PLAIN = { toggle: false, range: false };
const TOGGLE = { toggle: true, range: false };
const RANGE = { toggle: false, range: true };

describe('rowClickOutcome', () => {
  it('a plain click follows the clicked row alone', () => {
    const outcome = rowClickOutcome(selectRowOnly(1), 3, PLAIN);
    expect(outcome.next.ranges).toEqual([{ first: 3, last: 3 }]);
    expect(outcome.lead).toBe(3);
  });

  it('a range click follows the clicked row over the range', () => {
    const outcome = rowClickOutcome(selectRowOnly(1), 3, RANGE);
    expect(outcome.next.ranges).toEqual([{ first: 1, last: 3 }]);
    expect(outcome.lead).toBe(3);
  });

  it('a toggle in follows the toggled row', () => {
    const outcome = rowClickOutcome(selectRowOnly(1), 4, TOGGLE);
    expect(outcome.next.ranges).toEqual([
      { first: 1, last: 1 },
      { first: 4, last: 4 },
    ]);
    expect(outcome.lead).toBe(4);
  });

  it('a toggle out follows the first row still selected', () => {
    const wide = selectRowOnClick(selectRowOnly(6), 2, RANGE);
    const outcome = rowClickOutcome(wide, 2, TOGGLE);
    expect(outcome.next.ranges).toEqual([{ first: 3, last: 6 }]);
    expect(outcome.lead).toBe(3);
  });

  it('a toggle out of the last selected row follows none', () => {
    const outcome = rowClickOutcome(selectRowOnly(2), 2, TOGGLE);
    expect(outcome.next.ranges).toEqual([]);
    expect(outcome.lead).toBeNull();
  });

  it('a first click follows the clicked row', () => {
    expect(rowClickOutcome(EMPTY_ROW_SELECTION, 5, PLAIN).lead).toBe(5);
  });
});

describe('stepRowTarget', () => {
  it('moves one row from the cursor, held to the list’s ends', () => {
    expect(stepRowTarget(1_000_000, 10, 1)).toBe(11);
    expect(stepRowTarget(1_000_000, 10, -1)).toBe(9);
    expect(stepRowTarget(1_000_000, 0, -1)).toBe(0);
    expect(stepRowTarget(1_000_000, 999_999, 1)).toBe(999_999);
  });

  it('lands on the first row with no cursor, or one past the list', () => {
    expect(stepRowTarget(4, null, 1)).toBe(0);
    expect(stepRowTarget(4, null, -1)).toBe(0);
    expect(stepRowTarget(4, 4, 1)).toBe(0);
    expect(stepRowTarget(4, 900, -1)).toBe(0);
  });

  it('lands nowhere on an empty list', () => {
    expect(stepRowTarget(0, null, 1)).toBeNull();
    expect(stepRowTarget(0, 3, -1)).toBeNull();
  });
});

describe('logCellRow', () => {
  const cell: WorkspaceTreeLogCellWire = {
    lane: 1,
    color: 3,
    laneCount: 3,
    edges: [
      { from: 1, to: 1, color: 3, span: 'top', child: 40, parent: 41, collapsed: false, run: 7 },
      { from: 1, to: 1, color: 3, span: 'bottom', child: 41, parent: 44, collapsed: true, run: 8 },
      { from: 0, to: 0, color: 0, span: 'pass', child: 39, parent: 43, collapsed: false },
      { from: 2, to: 1, color: 5, span: 'pass', child: -1, parent: 90, collapsed: false, run: 7 },
    ],
  };

  it('draws the host’s palette numbers as the theme’s tokens', () => {
    const row = logCellRow(cell, null);
    expect(row).toMatchObject({ lane: 1, color: GRAPH_LANE_COLORS[3] });
    expect(row.edges.map((edge) => edge.color)).toEqual([
      GRAPH_LANE_COLORS[3],
      GRAPH_LANE_COLORS[3],
      GRAPH_LANE_COLORS[0],
      GRAPH_LANE_COLORS[5],
    ]);
  });

  it('keeps every edge’s place, its half of the row and whether it passes over hidden commits', () => {
    expect(logCellRow(cell, null).edges.map(({ from, to, span, collapsed }) => [from, to, span, collapsed])).toEqual([
      [1, 1, 'top', false],
      [1, 1, 'bottom', true],
      [0, 0, 'pass', false],
      [2, 1, 'pass', false],
    ]);
  });

  it('lights the edges that carry the run under the pointer, and none with no run there', () => {
    expect(logCellRow(cell, 7).edges.map((edge) => edge.lit)).toEqual([true, false, false, true]);
    expect(logCellRow(cell, 8).edges.map((edge) => edge.lit)).toEqual([false, true, false, false]);
    expect(logCellRow(cell, 9).edges.map((edge) => edge.lit)).toEqual([false, false, false, false]);
    expect(logCellRow(cell, null).edges.map((edge) => edge.lit)).toEqual([false, false, false, false]);
  });
});

describe('graphCellReach — how far right a row’s own cell draws', () => {
  type Edge = [from: number, to: number, span: 'top' | 'bottom' | 'pass', collapsed?: boolean];
  const reach = (lane: number, ...edges: Edge[]): number =>
    graphCellReach({
      lane,
      color: GRAPH_LANE_COLORS[0],
      edges: edges.map(([from, to, span, collapsed = false]) => ({
        from,
        to,
        span,
        collapsed,
        color: GRAPH_LANE_COLORS[0],
        lit: false,
      })),
    });

  it('is the dot’s lane on a row with nothing right of it', () => {
    expect(reach(0)).toBe(0);
    expect(reach(0, [0, 0, 'top'], [0, 0, 'bottom'])).toBe(0);
    // The dot alone holds its lane: no line of the row runs down it.
    expect(reach(2)).toBe(2);
    expect(reach(2, [0, 0, 'pass'])).toBe(2);
  });

  it('is the lane a line runs straight down, right of the dot', () => {
    expect(reach(0, [0, 0, 'top'], [0, 0, 'bottom'], [1, 1, 'pass'])).toBe(1);
    expect(reach(0, [1, 1, 'pass'], [3, 3, 'pass'])).toBe(3);
  });

  it('is half a lane short of the lane a line only slants to — out of the dot, into it, or past the row', () => {
    expect(reach(0, [0, 0, 'top'], [0, 0, 'bottom'], [0, 1, 'bottom'])).toBe(0.5);
    expect(reach(0, [0, 0, 'top'], [1, 0, 'top'], [0, 0, 'bottom'])).toBe(0.5);
    expect(reach(0, [2, 1, 'pass'])).toBe(1.5);
    // A line that slants over several lanes still ends half a lane short of the farthest.
    expect(reach(0, [3, 0, 'top'])).toBe(2.5);
    // A straight line farther right than a slanted one decides.
    expect(reach(0, [0, 1, 'bottom'], [1, 1, 'pass'])).toBe(1);
  });

  it('takes a folded line out of the dot for a stub on the dot’s lane — a folded line past the row still slants', () => {
    expect(reach(0, [0, 2, 'bottom', true])).toBe(0);
    expect(reach(0, [2, 0, 'top', true])).toBe(0);
    expect(reach(0, [1, 2, 'pass', true])).toBe(1.5);
  });
});

describe('logRowHighlight', () => {
  const run: WorkspaceTreeLogRunWire = { run: 7, first: 'a'.repeat(40), top: 40, bottom: 52, hidden: 6, folded: false };

  it('lights the run’s two ends as ends — the top one even though it carries the run’s number', () => {
    expect(logRowHighlight(40, 7, run)).toBe('end');
    expect(logRowHighlight(52, 8, run)).toBe('end');
    expect(logRowHighlight(52, undefined, run)).toBe('end');
  });

  it('lights a row that carries the run’s number as one between them', () => {
    expect(logRowHighlight(44, 7, run)).toBe('interior');
  });

  it('leaves a row of another lane dark, between the ends or not', () => {
    expect(logRowHighlight(45, 8, run)).toBeNull();
    expect(logRowHighlight(45, undefined, run)).toBeNull();
    expect(logRowHighlight(60, 9, run)).toBeNull();
  });

  it('lights nothing with no run under the pointer', () => {
    expect(logRowHighlight(40, 7, null)).toBeNull();
  });
});

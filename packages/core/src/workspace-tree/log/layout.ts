/**
 * The log graph laid out over a whole list — without holding it. One
 * sweep down the list keeps what cannot be had again cheaply: the lanes
 * as they stood every so many rows (a checkpoint), the colour each
 * commit wears, and the widest row. The cells of any stretch of rows
 * are then made on demand, by sweeping from the checkpoint above it —
 * a row deep in a history costs the same as one at its top.
 *
 * The sweep is taken a stretch at a time (`advanceLogLayout`), so a
 * host lays out a long history between its other work.
 */

import { type LaneState, type LogGraphInput, type LogGraphRow, openLaneState, sweepLogRow } from './lane-sweep';

/** Rows between two checkpoints — the most a stretch of cells sweeps before its first row. */
export const LOG_LAYOUT_CHECKPOINT_ROWS = 1000;

export interface LogLayout {
  /** Rows between two checkpoints. */
  readonly every: number;
  /** Rows laid out so far; the layout is whole once this is the list's count. */
  swept: number;
  /** The sweep, left at row `swept`. */
  state: LaneState;
  /** The lanes as they stood above row `i * every`. */
  checkpoints: LaneState[];
  /** The colour each laid-out commit wears. */
  colors: Uint8Array;
  /** The most lanes any laid-out row occupies. */
  widest: number;
}

export function beginLogLayout(count: number, every: number = LOG_LAYOUT_CHECKPOINT_ROWS): LogLayout {
  return { every, swept: 0, state: openLaneState(), checkpoints: [], colors: new Uint8Array(count), widest: 0 };
}

/** Lay out up to `rows` more rows; true once the layout is whole. */
export function advanceLogLayout(input: LogGraphInput, layout: LogLayout, rows: number): boolean {
  const { count } = input.skeleton;
  const end = Math.min(count, layout.swept + rows);
  for (let row = layout.swept; row < end; row += 1) {
    if (row % layout.every === 0) {
      layout.checkpoints.push({ lanes: layout.state.lanes, nextColor: layout.state.nextColor });
    }
    const cell = sweepLogRow(input, layout.state, row, false);
    layout.colors[row] = cell.color;
    if (cell.laneCount > layout.widest) layout.widest = cell.laneCount;
  }
  layout.swept = end;
  return end === count;
}

/** The whole list laid out in one go. */
export function layoutLog(input: LogGraphInput, every: number = LOG_LAYOUT_CHECKPOINT_ROWS): LogLayout {
  const layout = beginLogLayout(input.skeleton.count, every);
  advanceLogLayout(input, layout, input.skeleton.count);
  return layout;
}

/** The cells of rows `[from, from + count)` — as many of them as are laid out. */
export function logGraphRows(input: LogGraphInput, layout: LogLayout, from: number, count: number): LogGraphRow[] {
  const end = Math.min(from + count, layout.swept);
  if (from < 0 || from >= end) return [];
  const above = Math.floor(from / layout.every);
  const checkpoint = layout.checkpoints[above];
  const state: LaneState = { lanes: checkpoint.lanes, nextColor: checkpoint.nextColor };
  const cells: LogGraphRow[] = [];
  for (let row = above * layout.every; row < end; row += 1) {
    const cell = sweepLogRow(input, state, row, row >= from);
    if (row >= from) cells.push(cell);
  }
  return cells;
}

/** Every row's cell, in list order — for a list short enough to hold whole. */
export function computeLogGraph(input: LogGraphInput): LogGraphRow[] {
  const state = openLaneState();
  const cells: LogGraphRow[] = [];
  for (let row = 0; row < input.skeleton.count; row += 1) cells.push(sweepLogRow(input, state, row, true));
  return cells;
}

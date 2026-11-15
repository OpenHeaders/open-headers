/**
 * The log graph's lane sweep — one row at a time, top down, over a
 * state the caller holds: the lanes running under the row above, each
 * expecting a commit. A commit lands on the leftmost lane expecting it
 * (or opens one — a branch head entering the list); sibling lanes
 * expecting the same commit converge into its dot; the dot forks down
 * to a lane per parent — the first parent inherits the commit's lane,
 * another parent joins a lane already expecting it or opens one beside
 * the dot.
 *
 * Colour is by BRANCH HEAD: every lane that opens takes the next
 * palette entry, and that colour travels down the head's first-parent
 * chain. Where chains meet, the commit belongs to the head that owns
 * it — the checked-out commit's lane first, then the lane that opened
 * first — so the trunk keeps one colour through the whole log and a
 * merged branch's colour ends on its own last commit. A travelled lane
 * that reaches another branch's head starts that branch's colour there;
 * the edge into the head keeps the colour it came in with. A colour is
 * a palette NUMBER — what it looks like is the view's.
 *
 * A list that shows only some of a log's commits hands in the colour
 * each one wears in the whole log (`known`), so a commit keeps its
 * colour whatever else is hidden.
 *
 * The state after a row is a value: a lane is never changed once made
 * and the list of lanes is replaced, not edited — so a sweep can be
 * left at any row and taken up again from what it held there.
 */

import type { LogSkeleton } from './skeleton';

/** How many colours the palette holds; a lane's colour is its allocation number modulo this. */
export const LOG_LANE_COLOR_COUNT = 8;

/** In `known`: this commit's colour in the whole log is not known. */
export const LOG_COLOR_UNKNOWN = 255;

/** The rank the checked-out commit's lane carries — it owns every commit it meets. */
const HEAD_RANK = -1;

export interface LogLane {
  /** The commit the lane expects next. */
  readonly row: number;
  /** The commit the lane descends from; -1 for a head entering the list. */
  readonly child: number;
  readonly color: number;
  /** Ownership precedence where chains meet: lower wins. */
  readonly rank: number;
  /** The lane stands for a pointer that passes over hidden commits. */
  readonly collapsed: boolean;
  /** The lane has not landed yet — its colour was allocated for the commit it expects. */
  readonly fresh: boolean;
}

/** What a sweep holds between two rows. */
export interface LaneState {
  lanes: readonly LogLane[];
  /** Colours allocated so far. */
  nextColor: number;
}

export interface LogGraphInput {
  skeleton: LogSkeleton;
  /** The checked-out commit; -1 when the list has none to name. */
  headRow: number;
  /** Per row: 1 where a branch (local or remote) points — a travelled lane reaching one restarts its colour there. */
  branchHeads?: Uint8Array;
  /** Per row: the colour the commit wears in the whole log, or `LOG_COLOR_UNKNOWN`. */
  known?: Uint8Array;
}

/** One graph edge inside a row's cell, in lane coordinates. */
export interface LogGraphEdge {
  from: number;
  to: number;
  color: number;
  /** Which half of the row the edge spans: `top` converges into the dot, `bottom` forks out of it, `pass` crosses the row. */
  span: 'top' | 'bottom' | 'pass';
  /** The newer commit the edge descends from; -1 on a lane no commit opened. */
  child: number;
  /** The older commit the edge reaches. */
  parent: number;
  /** The edge passes over hidden commits — drawn as stubs, not a line. */
  collapsed: boolean;
}

/** One row's cell. */
export interface LogGraphRow {
  /** The commit dot's lane. */
  lane: number;
  color: number;
  /** Empty when the sweep was not asked for them. */
  edges: LogGraphEdge[];
  /** Lanes occupied while the row renders. */
  laneCount: number;
}

export function openLaneState(): LaneState {
  return { lanes: [], nextColor: 0 };
}

/**
 * Sweep `row` — the row under the one `state` was left at — and leave
 * `state` at it. The cell's edges are made only when asked for: a pass
 * that wants the colours and the widths alone skips them.
 */
export function sweepLogRow(input: LogGraphInput, state: LaneState, row: number, withEdges: boolean): LogGraphRow {
  const { headRow, branchHeads, known } = input;
  const { starts, parents, skips } = input.skeleton;
  const knownColor = (commit: number): number =>
    known !== undefined && commit < known.length ? known[commit] : LOG_COLOR_UNKNOWN;
  const skipped = (pointer: number): boolean => skips !== undefined && skips[pointer] === 1;
  const allocate = (): number => {
    const color = state.nextColor % LOG_LANE_COLOR_COUNT;
    state.nextColor += 1;
    return color;
  };
  const open = (commit: number, child: number, collapsed: boolean): LogLane => {
    const rank = commit === headRow ? HEAD_RANK : state.nextColor;
    const allocated = allocate();
    const wears = knownColor(commit);
    return { row: commit, child, color: wears === LOG_COLOR_UNKNOWN ? allocated : wears, rank, collapsed, fresh: true };
  };

  let active = state.lanes;
  const matches: number[] = [];
  for (let i = 0; i < active.length; i += 1) {
    if (active[i].row === row) matches.push(i);
  }
  if (matches.length === 0) {
    active = [...active, open(row, -1, false)];
    matches.push(active.length - 1);
  }
  const lane = matches[0];
  let owner = lane;
  for (const m of matches) {
    if (active[m].rank < active[owner].rank) owner = m;
  }
  const { rank } = active[owner];
  // A branch head a travelled lane reaches starts its branch's colour
  // on its own dot (a lane opened for it already wears a fresh colour);
  // the owner keeps its precedence below.
  const wears = knownColor(row);
  let color = active[owner].color;
  if (wears !== LOG_COLOR_UNKNOWN) color = wears;
  else if (!active[owner].fresh && branchHeads !== undefined && branchHeads[row] === 1) color = allocate();

  // The lanes under the row: converging lanes close into the dot's
  // lane, which the first parent inherits; other parents fork right of it.
  const first = starts[row];
  const end = starts[row + 1];
  const next: LogLane[] = [];
  // Lanes that pass the row, as pairs: where each stood above, where it stands below.
  const passing: number[] = [];
  let dot = -1;
  for (let i = 0; i < active.length; i += 1) {
    if (i === lane) {
      if (end > first) {
        dot = next.length;
        next.push({ row: parents[first], child: row, color, rank, collapsed: skipped(first), fresh: false });
      }
      continue;
    }
    if (active[i].row === row) continue;
    passing.push(i, next.length);
    next.push(active[i]);
  }
  const forks: number[] = dot >= 0 ? [dot] : [];
  for (let pointer = first + 1; pointer < end; pointer += 1) {
    const parent = parents[pointer];
    const existing = next.findIndex((held) => held.row === parent);
    if (existing >= 0) {
      forks.push(existing);
      continue;
    }
    const at = dot >= 0 ? dot + 1 : next.length;
    next.splice(at, 0, open(parent, row, skipped(pointer)));
    // The lane put in shifts every place recorded at or after it.
    for (let i = 1; i < passing.length; i += 2) {
      if (passing[i] >= at) passing[i] += 1;
    }
    for (let i = 0; i < forks.length; i += 1) {
      if (forks[i] >= at) forks[i] += 1;
    }
    forks.push(at);
  }

  const edges: LogGraphEdge[] = [];
  if (withEdges) {
    for (const m of matches) {
      const { child, collapsed } = active[m];
      if (child === -1) continue;
      edges.push({ from: m, to: lane, color: active[m].color, span: 'top', child, parent: row, collapsed });
    }
    for (const fork of forks) {
      const { row: parent, collapsed } = next[fork];
      edges.push({ from: lane, to: fork, color: next[fork].color, span: 'bottom', child: row, parent, collapsed });
    }
    for (let i = 0; i < passing.length; i += 2) {
      const held = next[passing[i + 1]];
      edges.push({
        from: passing[i],
        to: passing[i + 1],
        color: held.color,
        span: 'pass',
        child: held.child,
        parent: held.row,
        collapsed: held.collapsed,
      });
    }
  }

  const laneCount = Math.max(active.length, next.length);
  state.lanes = next;
  return { lane, color, edges, laneCount };
}

/**
 * Commit-graph lane layout for the Git tool window's log list — the
 * IDE-log multi-lane rail. Pure: consumes `(sha, parents)` pairs in log
 * order (newest first) and answers per-row render data — the dot's
 * lane, the half-row edges around it, and the pass-through edges of
 * unrelated lanes — so the list can draw each row as an isolated SVG
 * cell with no cross-row measurement.
 *
 * Standard top-down sweep: a cursor of active lanes, each expecting a
 * sha. A commit lands on the leftmost lane expecting it (or opens a new
 * lane — a branch tip entering the window); sibling lanes expecting the
 * same sha converge into the dot; the dot forks downward to one lane
 * per parent — the first parent inherits the commit's lane and color,
 * extra parents either join an existing lane already expecting them or
 * open a fresh lane beside the dot. Colors travel with lanes, cycling a
 * fixed palette (theme-independent mid-saturation hues, readable on
 * light and dark).
 */

/** One graph edge inside a row's cell, in lane coordinates. */
export interface GraphEdge {
  /** Lane at the edge's starting horizontal position. */
  from: number;
  /** Lane at the edge's ending horizontal position. */
  to: number;
  color: string;
  /** Which half of the row the edge spans: `top` converges into the
   *  dot, `bottom` forks out of it, `pass` crosses the full row. */
  span: 'top' | 'bottom' | 'pass';
}

/** Render data for one log row. */
export interface GraphRow {
  /** The commit dot's lane. */
  lane: number;
  color: string;
  edges: GraphEdge[];
  /** Lanes occupied while this row renders — the cell's width driver. */
  laneCount: number;
}

/** Mid-saturation hues legible on both themes; index = allocation order. */
export const GRAPH_LANE_COLORS = [
  '#4e9a51',
  '#9c7ced',
  '#4a88c7',
  '#d0813c',
  '#3fa9a1',
  '#c46bb0',
  '#b0a03c',
  '#7e8a97',
] as const;

interface ActiveLane {
  sha: string;
  color: string;
}

/**
 * Lay out the graph for `entries` in log order (newest first). Rows are
 * answered in the same order. A truncated log (the tail cut by the
 * fetch limit) simply leaves lanes running off the last row's bottom.
 */
export function computeLogGraph(entries: ReadonlyArray<{ sha: string; parents: readonly string[] }>): GraphRow[] {
  const rows: GraphRow[] = [];
  let active: ActiveLane[] = [];
  let nextColor = 0;
  const allocColor = (): string => {
    const color = GRAPH_LANE_COLORS[nextColor % GRAPH_LANE_COLORS.length];
    nextColor += 1;
    return color;
  };

  for (const entry of entries) {
    const matches: number[] = [];
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].sha === entry.sha) matches.push(i);
    }
    if (matches.length === 0) {
      active.push({ sha: entry.sha, color: allocColor() });
      matches.push(active.length - 1);
    }
    const lane = matches[0];
    const color = active[lane].color;

    // The next cursor: converging lanes collapse into the dot's lane,
    // which the first parent inherits; extra parents fork right of it.
    const next: ActiveLane[] = [];
    const nextIndexByOld = new Map<number, number>();
    let dotNextIndex: number | null = null;
    for (let i = 0; i < active.length; i += 1) {
      if (i === lane) {
        if (entry.parents.length > 0) {
          dotNextIndex = next.length;
          next.push({ sha: entry.parents[0], color });
        }
        continue;
      }
      if (active[i].sha === entry.sha) continue;
      nextIndexByOld.set(i, next.length);
      next.push(active[i]);
    }
    const forkLanes: number[] = dotNextIndex !== null ? [dotNextIndex] : [];
    for (const parent of entry.parents.slice(1)) {
      const existing = next.findIndex((l) => l.sha === parent);
      if (existing >= 0) {
        forkLanes.push(existing);
        continue;
      }
      const insertAt = dotNextIndex !== null ? dotNextIndex + 1 : next.length;
      next.splice(insertAt, 0, { sha: parent, color: allocColor() });
      // Insertion shifts every recorded index at/after the slot.
      for (const [old, idx] of nextIndexByOld) {
        if (idx >= insertAt) nextIndexByOld.set(old, idx + 1);
      }
      for (let f = 0; f < forkLanes.length; f += 1) {
        if (forkLanes[f] >= insertAt) forkLanes[f] += 1;
      }
      forkLanes.push(insertAt);
    }

    const edges: GraphEdge[] = [];
    for (const m of matches) {
      edges.push({ from: m, to: lane, color: active[m].color, span: 'top' });
    }
    for (const f of forkLanes) {
      edges.push({ from: lane, to: f, color: next[f].color, span: 'bottom' });
    }
    for (const [old, idx] of nextIndexByOld) {
      edges.push({ from: old, to: idx, color: next[idx].color, span: 'pass' });
    }

    rows.push({
      lane,
      color,
      edges,
      laneCount: Math.max(active.length, next.length),
    });
    active = next;
  }
  return rows;
}

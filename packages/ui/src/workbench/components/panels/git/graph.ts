/**
 * Commit-graph lane layout for the Git tool window's log list — the
 * log-window multi-lane rail. Pure: consumes `(sha, parents)` pairs in log
 * order (newest first) and answers per-row render data — the dot's
 * lane, the half-row edges around it, and the pass-through edges of
 * unrelated lanes — so the list can draw each row as an isolated SVG
 * cell with no cross-row measurement.
 *
 * Standard top-down sweep: a cursor of active lanes, each expecting a
 * sha. A commit lands on the leftmost lane expecting it (or opens a new
 * lane — a branch head entering the window); sibling lanes expecting
 * the same sha converge into the dot; the dot forks downward to one
 * lane per parent — the first parent inherits the commit's lane, extra
 * parents either join an existing lane already expecting them or open
 * a fresh lane beside the dot.
 *
 * Colour is by BRANCH HEAD (the reference's reading): every lane that
 * opens — a branch head entering the window, a merge's side parent —
 * takes the next palette entry, and that colour travels down the
 * head's first-parent chain. Where chains meet, the commit belongs to
 * the head that owns it: the checked-out branch first, then the head
 * that entered the window first (the newest), so the trunk keeps one
 * colour through the whole log and a merged branch's colour ends on
 * its own last commit — its edge still arrives in its own colour. The
 * palette is eight per-theme tokens the stylesheet defines.
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

/** The lane palette — per-theme tokens (`--oh-git-lane-N`); index = allocation order. */
export const GRAPH_LANE_COLORS = [
  'var(--oh-git-lane-0)',
  'var(--oh-git-lane-1)',
  'var(--oh-git-lane-2)',
  'var(--oh-git-lane-3)',
  'var(--oh-git-lane-4)',
  'var(--oh-git-lane-5)',
  'var(--oh-git-lane-6)',
  'var(--oh-git-lane-7)',
] as const;

/** The rank the checked-out branch's lane carries — it owns every commit it meets. */
const HEAD_RANK = -1;

interface ActiveLane {
  sha: string;
  color: string;
  /** Ownership precedence where chains meet: lower wins. */
  rank: number;
}

/**
 * Lay out the graph for `entries` in log order (newest first). Rows are
 * answered in the same order. A truncated log (the tail cut by the
 * fetch limit) simply leaves lanes running off the last row's bottom.
 * `headSha` names the checked-out commit — the lane opening on it owns
 * the shared history below every fork.
 */
export function computeLogGraph(
  entries: ReadonlyArray<{ sha: string; parents: readonly string[] }>,
  headSha: string | null = null,
): GraphRow[] {
  const rows: GraphRow[] = [];
  let active: ActiveLane[] = [];
  let nextColor = 0;
  const openLane = (sha: string): ActiveLane => {
    const color = GRAPH_LANE_COLORS[nextColor % GRAPH_LANE_COLORS.length];
    const rank = sha === headSha ? HEAD_RANK : nextColor;
    nextColor += 1;
    return { sha, color, rank };
  };

  for (const entry of entries) {
    const matches: number[] = [];
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].sha === entry.sha) matches.push(i);
    }
    if (matches.length === 0) {
      active.push(openLane(entry.sha));
      matches.push(active.length - 1);
    }
    const lane = matches[0];
    const owner = matches.reduce((best, m) => (active[m].rank < active[best].rank ? m : best), lane);
    const { color, rank } = active[owner];

    // The next cursor: converging lanes collapse into the dot's lane,
    // which the first parent inherits; extra parents fork right of it.
    const next: ActiveLane[] = [];
    const nextIndexByOld = new Map<number, number>();
    let dotNextIndex: number | null = null;
    for (let i = 0; i < active.length; i += 1) {
      if (i === lane) {
        if (entry.parents.length > 0) {
          dotNextIndex = next.length;
          next.push({ sha: entry.parents[0], color, rank });
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
      next.splice(insertAt, 0, openLane(parent));
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

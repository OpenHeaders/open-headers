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
 * its own last commit — its edge still arrives in its own colour. A
 * lane that reaches another branch's head on its own chain starts that
 * branch's colour there (the unpushed run above origin's head reads as
 * its own segment; the edge into the head keeps the colour it came in
 * with). The palette is eight per-theme tokens the stylesheet defines.
 *
 * Every edge names the two commits it joins, so a view can light the
 * edges of a fragment, and an edge the view collapsed (a hidden linear
 * run between two ends) is flagged — the cell draws it as the stubs.
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
  /** The newer commit the edge descends from. */
  child: string;
  /** The older commit the edge reaches. */
  parent: string;
  /** The edge stands for a collapsed run — drawn as stubs, not a line. */
  collapsed: boolean;
}

/** The key a view names an edge by — the child and the parent it joins. */
export const edgeKey = (child: string, parent: string): string => `${child}>${parent}`;

export interface LogGraphOptions {
  /** The checked-out commit — the lane opening on it owns the shared history below every fork. */
  headSha?: string | null;
  /** Edges (by `edgeKey`) that skip a collapsed run. */
  collapsedEdges?: ReadonlySet<string>;
  /** Commits a branch (local or remote) points at — a lane reaching one restarts its colour there. */
  branchHeads?: ReadonlySet<string>;
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
  /** The commit the lane expects next. */
  sha: string;
  /** The commit the lane descends from — null for a head entering the window. */
  child: string | null;
  color: string;
  /** Ownership precedence where chains meet: lower wins. */
  rank: number;
  collapsed: boolean;
  /** The lane has not landed yet — its colour was allocated for the commit it expects. */
  fresh: boolean;
}

/**
 * Lay out the graph for `entries` in log order (newest first). Rows are
 * answered in the same order. A truncated log (the tail cut by the
 * fetch limit) simply leaves lanes running off the last row's bottom.
 * A head entering the window draws no edge above its dot.
 */
export function computeLogGraph(
  entries: ReadonlyArray<{ sha: string; parents: readonly string[] }>,
  options: LogGraphOptions = {},
): GraphRow[] {
  const headSha = options.headSha ?? null;
  const collapsedEdges = options.collapsedEdges ?? new Set<string>();
  const branchHeads = options.branchHeads ?? new Set<string>();
  const rows: GraphRow[] = [];
  let active: ActiveLane[] = [];
  let nextColor = 0;
  const allocColor = (): string => {
    const color = GRAPH_LANE_COLORS[nextColor % GRAPH_LANE_COLORS.length];
    nextColor += 1;
    return color;
  };
  const openLane = (sha: string, child: string | null): ActiveLane => {
    const rank = sha === headSha ? HEAD_RANK : nextColor;
    const color = allocColor();
    return {
      sha,
      child,
      color,
      rank,
      fresh: true,
      collapsed: child !== null && collapsedEdges.has(edgeKey(child, sha)),
    };
  };

  for (const entry of entries) {
    const matches: number[] = [];
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].sha === entry.sha) matches.push(i);
    }
    if (matches.length === 0) {
      active.push(openLane(entry.sha, null));
      matches.push(active.length - 1);
    }
    const lane = matches[0];
    const owner = matches.reduce((best, m) => (active[m].rank < active[best].rank ? m : best), lane);
    const { rank } = active[owner];
    // A branch head a travelled lane reaches starts its branch's colour
    // on its own dot (a lane opened for it already wears a fresh colour);
    // the owner keeps its precedence below.
    const reachedHead = !active[owner].fresh && branchHeads.has(entry.sha);
    const color = reachedHead ? allocColor() : active[owner].color;

    // The next cursor: converging lanes collapse into the dot's lane,
    // which the first parent inherits; extra parents fork right of it.
    const next: ActiveLane[] = [];
    const nextIndexByOld = new Map<number, number>();
    let dotNextIndex: number | null = null;
    for (let i = 0; i < active.length; i += 1) {
      if (i === lane) {
        if (entry.parents.length > 0) {
          dotNextIndex = next.length;
          const parent = entry.parents[0];
          next.push({
            sha: parent,
            child: entry.sha,
            color,
            rank,
            fresh: false,
            collapsed: collapsedEdges.has(edgeKey(entry.sha, parent)),
          });
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
      next.splice(insertAt, 0, openLane(parent, entry.sha));
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
      const { child, collapsed } = active[m];
      if (child === null) continue;
      edges.push({ from: m, to: lane, color: active[m].color, span: 'top', child, parent: entry.sha, collapsed });
    }
    for (const f of forkLanes) {
      const { sha: parent, collapsed } = next[f];
      edges.push({ from: lane, to: f, color: next[f].color, span: 'bottom', child: entry.sha, parent, collapsed });
    }
    for (const [old, idx] of nextIndexByOld) {
      const { sha: parent, child, collapsed } = next[idx];
      edges.push({ from: old, to: idx, color: next[idx].color, span: 'pass', child: child ?? '', parent, collapsed });
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

/**
 * Log toolbar filter model — the log-window filter row's state shapes
 * (User / Date / Paths chips, Graph Options) and their pure
 * translations: tab state → the `log` verb's wire filters. The text
 * field's matcher is core's (`makeLogTextMatcher`), shared with the
 * host. Pure data; the view store carries these per log tab.
 */

/** `User:` chip — `me` resolves HOST-SIDE to the commit identity; else the authors, any of whom matches. */
export type GitLogAuthorFilter = { kind: 'me' } | { kind: 'users'; values: readonly string[] };

/** `Date:` chip — a rolling preset or an explicit inclusive range. */
export type GitLogDateFilter =
  | { kind: 'preset'; preset: '24h' | '7d' }
  | { kind: 'range'; since: string | null; until: string | null };

export type GitLogSort = 'date' | 'topo';

/**
 * The slice of one log tab's state the HOST's walk takes: User, Date
 * and Paths name the commits listed, the sort their order. (No Merges
 * and First Parent ride the same ask as flags of their own; the text
 * filter is the search's.)
 */
export interface GitLogRowFilterState {
  author: GitLogAuthorFilter | null;
  date: GitLogDateFilter | null;
  /** Repo-relative tree paths, a directory's with its closing slash kept; empty = no path scope. */
  paths: readonly string[];
  sort: GitLogSort;
}

/** The `log` verb's optional filter fields, wire shape. */
export interface GitLogWireFilters {
  author?: string;
  authors?: string[];
  authorMe?: boolean;
  since?: string;
  until?: string;
  paths?: string[];
  topoOrder?: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

/** Compose the verb's filter fields from tab state. Presets roll
 *  against `now`; an explicit `until` date widens to its last second
 *  (the chip's range is inclusive). */
export function buildLogWireFilters(state: GitLogRowFilterState, now: Date): GitLogWireFilters {
  const out: GitLogWireFilters = {};
  if (state.author !== null) {
    // One author travels by the field every host reads; several by `authors`.
    if (state.author.kind === 'me') out.authorMe = true;
    else if (state.author.values.length === 1) out.author = state.author.values[0];
    else if (state.author.values.length > 1) out.authors = [...state.author.values];
  }
  if (state.date !== null) {
    if (state.date.kind === 'preset') {
      const window = state.date.preset === '24h' ? 24 * HOUR_MS : 7 * 24 * HOUR_MS;
      out.since = new Date(now.getTime() - window).toISOString();
    } else {
      if (state.date.since !== null) out.since = state.date.since;
      if (state.date.until !== null) out.until = `${state.date.until}T23:59:59`;
    }
  }
  if (state.paths.length > 0) out.paths = state.paths.map(barePath);
  if (state.sort === 'topo') out.topoOrder = true;
  return out;
}

/** A path as git takes it: a directory's closing slash is the view's own mark. */
function barePath(path: string): string {
  return path.replace(/\/+$/, '');
}

/** A path as a chip or a tab names it: its last segment — a directory keeps its slash when asked. */
export function pathLabel(path: string, slash = true): string {
  const name = barePath(path).split('/').pop() ?? '';
  return slash && path.endsWith('/') ? `${name}/` : name;
}

/**
 * The Paths chip's reading — `assets/ + 4`; null with no path. A path
 * picked in the tree by what it belongs to reads by that name.
 */
export function pathsChipText(paths: readonly string[], names: Readonly<Record<string, string>> = {}): string | null {
  if (paths.length === 0) return null;
  const first = names[paths[0]] ?? pathLabel(paths[0]);
  return paths.length === 1 ? first : `${first} + ${paths.length - 1}`;
}

/**
 * True when User, Date or Paths is on: a walk names the commits the
 * list holds, so the list sifts — it is filtered, and none of its
 * linear runs folds. The sort order alone hides nothing, so it never
 * counts.
 */
export function hasRowFilters(state: GitLogRowFilterState): boolean {
  return state.author !== null || state.date !== null || state.paths.length > 0;
}

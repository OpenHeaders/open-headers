/**
 * Log toolbar filter model — the IDE-log filter row's state shapes
 * (User / Date / Paths chips, Graph Options, the text field's regex +
 * match-case toggles) and their pure translations: tab state → the
 * `log` verb's wire filters, and the client-side text matcher the
 * loaded window is sifted with. Pure data; the view store carries
 * these per log tab.
 */

/** `User:` chip — `me` resolves HOST-SIDE to the commit identity. */
export type GitLogAuthorFilter = { kind: 'me' } | { kind: 'user'; value: string };

/** `Date:` chip — a rolling preset or an explicit inclusive range. */
export type GitLogDateFilter =
  | { kind: 'preset'; preset: '24h' | '7d' }
  | { kind: 'range'; since: string | null; until: string | null };

export type GitLogSort = 'date' | 'topo';

/** The row-filter slice of one log tab's state (text filter aside). */
export interface GitLogRowFilterState {
  author: GitLogAuthorFilter | null;
  date: GitLogDateFilter | null;
  /** Repo-relative tree paths; empty = no path scope. */
  paths: readonly string[];
  sort: GitLogSort;
  firstParent: boolean;
  noMerges: boolean;
}

/** The `log` verb's optional filter fields, wire shape. */
export interface GitLogWireFilters {
  author?: string;
  authorMe?: boolean;
  since?: string;
  until?: string;
  paths?: string[];
  noMerges?: boolean;
  firstParent?: boolean;
  topoOrder?: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

/** Compose the verb's filter fields from tab state. Presets roll
 *  against `now`; an explicit `until` date widens to its last second
 *  (the chip's range is inclusive). */
export function buildLogWireFilters(state: GitLogRowFilterState, now: Date): GitLogWireFilters {
  const out: GitLogWireFilters = {};
  if (state.author !== null) {
    if (state.author.kind === 'me') out.authorMe = true;
    else out.author = state.author.value;
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
  if (state.paths.length > 0) out.paths = [...state.paths];
  if (state.noMerges) out.noMerges = true;
  if (state.firstParent) out.firstParent = true;
  if (state.sort === 'topo') out.topoOrder = true;
  return out;
}

/**
 * True when any filter HIDES rows (author/date/paths/no-merges/
 * first-parent) — the graph-suppression and reset-filters feed. Sort
 * order alone keeps the walk contiguous, so it never counts.
 */
export function hasRowFilters(state: GitLogRowFilterState): boolean {
  return state.author !== null || state.date !== null || state.paths.length > 0 || state.noMerges || state.firstParent;
}

export interface GitLogTextFields {
  subject: string;
  authorName: string;
  sha: string;
}

/** The text field's client-side matcher over the loaded window. */
export type GitLogTextMatcher =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'match'; test: (entry: GitLogTextFields) => boolean };

export function makeTextMatcher(filter: string, regex: boolean, matchCase: boolean): GitLogTextMatcher {
  const needle = filter.trim();
  if (needle === '') return { kind: 'none' };
  if (regex) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(needle, matchCase ? '' : 'i');
    } catch {
      return { kind: 'invalid' };
    }
    return {
      kind: 'match',
      test: (entry) => pattern.test(entry.subject) || pattern.test(entry.authorName) || pattern.test(entry.sha),
    };
  }
  const lowered = needle.toLowerCase();
  return {
    kind: 'match',
    test: (entry) => {
      if (matchCase) {
        return entry.subject.includes(needle) || entry.authorName.includes(needle) || entry.sha.startsWith(lowered);
      }
      return (
        entry.subject.toLowerCase().includes(lowered) ||
        entry.authorName.toLowerCase().includes(lowered) ||
        entry.sha.startsWith(lowered)
      );
    },
  };
}

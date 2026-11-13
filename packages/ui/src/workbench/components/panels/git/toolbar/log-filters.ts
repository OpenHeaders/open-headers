/**
 * Log toolbar filter model — the log-window filter row's state shapes
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

/**
 * The slice of one log tab's state the HOST's walk takes (the text
 * filter and No Merges aside — both sift the window the view holds).
 */
export interface GitLogRowFilterState {
  author: GitLogAuthorFilter | null;
  date: GitLogDateFilter | null;
  /** Repo-relative tree paths; empty = no path scope. */
  paths: readonly string[];
  sort: GitLogSort;
  firstParent: boolean;
}

/** The `log` verb's optional filter fields, wire shape. */
export interface GitLogWireFilters {
  author?: string;
  authorMe?: boolean;
  since?: string;
  until?: string;
  paths?: string[];
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
  if (state.firstParent) out.firstParent = true;
  if (state.sort === 'topo') out.topoOrder = true;
  return out;
}

/**
 * True when the HOST hides rows (author/date/paths/first-parent): the
 * commits it leaves out never reach the window, so no graph can be
 * drawn over what is left. Sort order alone keeps the walk contiguous,
 * so it never counts; No Merges is the view's own sift (below) and
 * keeps its graph.
 */
export function hasRowFilters(state: GitLogRowFilterState): boolean {
  return state.author !== null || state.date !== null || state.paths.length > 0 || state.firstParent;
}

/** A merge commit — what Graph Options › No Merges leaves out of the list. */
export function isMergeCommit(entry: { parents: readonly string[] }): boolean {
  return entry.parents.length > 1;
}

export interface GitLogTextFields {
  subject: string;
  authorName: string;
  sha: string;
}

/** A stretch of a text the filter matched: `[start, end)`. */
export type TextRange = readonly [number, number];

/** The text field's client-side matcher over the loaded window. */
export type GitLogTextMatcher =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | {
      kind: 'match';
      test: (entry: GitLogTextFields) => boolean;
      /** Every stretch of `text` the filter matches, in order — what a row paints. */
      ranges: (text: string) => TextRange[];
    };

/** Every non-empty match of a global pattern in `text`. */
function patternRanges(pattern: RegExp, text: string): TextRange[] {
  const ranges: TextRange[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match[0].length > 0) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/** A literal text as a pattern that matches it and nothing else. */
function literalPattern(needle: string, matchCase: boolean): RegExp {
  return new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
}

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
    const everywhere = new RegExp(needle, matchCase ? 'g' : 'gi');
    return {
      kind: 'match',
      test: (entry) => pattern.test(entry.subject) || pattern.test(entry.authorName) || pattern.test(entry.sha),
      ranges: (text) => patternRanges(everywhere, text),
    };
  }
  const lowered = needle.toLowerCase();
  const literal = literalPattern(needle, matchCase);
  return {
    kind: 'match',
    ranges: (text) => patternRanges(literal, text),
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

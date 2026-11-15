/**
 * What a log asks to be listed — its scope, its order, what it sifts
 * out and which linear runs it folds. The ask is the list's NAME: two
 * callers that ask the same are answered from one list, and nobody
 * opens, holds or closes anything.
 */

import type { CommitLogFilters } from '../../git';

/** The linear runs a list folds. A run is named by the hash of the first commit it hides. */
export interface LogFolds {
  /** Every run is folded — and `runs` names the ones opened again. Otherwise `runs` names the folded ones. */
  all: boolean;
  runs: readonly string[];
}

export interface LogAsk {
  /** The refs whose histories are listed together, HEAD a possible member; null for every ref. */
  scope: readonly string[] | null;
  /** Sort › Topologically, in place of the date order. */
  topological: boolean;
  firstParent: boolean;
  noMerges: boolean;
  /** User, Date and Paths as the plumbing takes them — git names the commits they leave; null when none is asked. */
  walk: Pick<CommitLogFilters, 'author' | 'authors' | 'since' | 'until' | 'paths'> | null;
  folds: LogFolds;
}

export const NO_FOLDS: LogFolds = { all: false, runs: [] };

/** The list hides commits by a rule of its own — its graph is the contraction's, and no run folds. */
export function isSifted(ask: LogAsk): boolean {
  return ask.firstParent || ask.noMerges || ask.walk !== null;
}

const sorted = (names: readonly string[]): string[] => [...new Set(names)].sort();

/** The ask as one string — equal for two asks that list the same. */
export function logAskName(ask: LogAsk): string {
  const { walk } = ask;
  return JSON.stringify([
    ask.scope === null ? null : sorted(ask.scope),
    ask.topological,
    ask.firstParent,
    ask.noMerges,
    walk === null
      ? null
      : [
          sorted([...(walk.author !== undefined ? [walk.author] : []), ...(walk.authors ?? [])]),
          walk.since ?? null,
          walk.until ?? null,
          sorted(walk.paths ?? []),
        ],
    // A sifted list folds nothing: what it is asked to fold names no other list.
    isSifted(ask) ? null : [ask.folds.all, sorted(ask.folds.runs)],
  ]);
}

/**
 * log-folds — the linear runs a log tab folds: part of the tab's view
 * state, and part of what it asks the host to list (`log-rows-ask.ts`).
 *
 * A run is named by the hash of the first commit it hides — a run's
 * number dies with its list, a commit does not. So the folds are kept
 * when the tab's scope or a filter changes: a name the new list has no
 * run for folds nothing there, a list that sifts folds nothing at all,
 * and both leave the names standing for the list that comes back. Pure.
 */

/** The linear runs a tab folds, each named by the hash of the first commit it hides. */
export interface LogFolds {
  /** Every run is folded (Collapse Linear Branches) — and `runs` names the ones opened again. */
  all: boolean;
  runs: readonly string[];
}

export const NO_LOG_FOLDS: LogFolds = { all: false, runs: [] };

/** Collapse Linear Branches: every run folded, none opened again. */
export const ALL_LOG_FOLDS: LogFolds = { all: true, runs: [] };

/** The folds after a press on a run's dot: a folded run opens, an open one folds. */
export function toggleLogFold(folds: LogFolds, first: string, folded: boolean): LogFolds {
  const runs = folds.runs.filter((sha) => sha !== first);
  // Under `all` the named runs are the OPEN ones: a press names a run to open it, and takes its name out to fold it.
  const named = folded === folds.all;
  return { all: folds.all, runs: named ? [...runs, first] : runs };
}

/** Collapse Linear Branches has a run left to fold — as far as the folds say: not every one is folded already. */
export function canFoldAll(folds: LogFolds): boolean {
  return !folds.all || folds.runs.length > 0;
}

/** Expand Linear Branches has a run to open: one is named folded, or every one is. */
export function canUnfoldAll(folds: LogFolds): boolean {
  return folds.all || folds.runs.length > 0;
}

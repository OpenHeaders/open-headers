/**
 * Commit tool window — pure model over the `changes` verb's rows: the
 * three display groups (Changes / Unversioned Files / Ignored Files),
 * the checked-set algebra (tracked rows default checked, unversioned
 * default unchecked — the IDE convention), and the "N modified"
 * counter parts. No React, no bridge.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';

export interface ChangeGroups {
  /** Tracked changes vs HEAD — checked by default. */
  changes: WorkspaceTreeWorkingChangeWire[];
  /** Porcelain `??` — unchecked by default. */
  unversioned: WorkspaceTreeWorkingChangeWire[];
  /** Porcelain `!!` — read-only rows (never checkable; `git add` respects `.gitignore`). */
  ignored: WorkspaceTreeWorkingChangeWire[];
}

export function splitChangeGroups(rows: readonly WorkspaceTreeWorkingChangeWire[]): ChangeGroups {
  const groups: ChangeGroups = { changes: [], unversioned: [], ignored: [] };
  for (const row of rows) {
    if (row.ignored) groups.ignored.push(row);
    else if (row.unversioned) groups.unversioned.push(row);
    else groups.changes.push(row);
  }
  return groups;
}

/**
 * The checked set is stored as EXCEPTIONS so rows appearing between
 * refetches keep the IDE defaults: a tracked row is checked unless the
 * user unchecked it; an unversioned row is unchecked unless the user
 * checked it. Vanished paths in the exception sets are harmless — the
 * resolver only ever consults rows that exist.
 */
export interface CheckedState {
  uncheckedTracked: ReadonlySet<string>;
  checkedUnversioned: ReadonlySet<string>;
}

export const EMPTY_CHECKED_STATE: CheckedState = {
  uncheckedTracked: new Set<string>(),
  checkedUnversioned: new Set<string>(),
};

export function isRowChecked(row: WorkspaceTreeWorkingChangeWire, state: CheckedState): boolean {
  if (row.ignored) return false;
  if (row.unversioned) return state.checkedUnversioned.has(row.path);
  return !state.uncheckedTracked.has(row.path);
}

/** Every checked path across both checkable groups — the commit verb's `paths`. */
export function checkedPaths(rows: readonly WorkspaceTreeWorkingChangeWire[], state: CheckedState): string[] {
  return rows.filter((row) => isRowChecked(row, state)).map((row) => row.path);
}

/** Flip a set of paths (a file row, a directory's descendants, or a whole group) to `checked`. */
export function setPathsChecked(
  rows: readonly WorkspaceTreeWorkingChangeWire[],
  state: CheckedState,
  paths: readonly string[],
  checked: boolean,
): CheckedState {
  const target = new Set(paths);
  const uncheckedTracked = new Set(state.uncheckedTracked);
  const checkedUnversioned = new Set(state.checkedUnversioned);
  for (const row of rows) {
    if (!target.has(row.path) || row.ignored) continue;
    if (row.unversioned) {
      if (checked) checkedUnversioned.add(row.path);
      else checkedUnversioned.delete(row.path);
    } else {
      if (checked) uncheckedTracked.delete(row.path);
      else uncheckedTracked.add(row.path);
    }
  }
  return { uncheckedTracked, checkedUnversioned };
}

/**
 * The Commit File… gesture: a checked state where ONLY the given path
 * is checked — every tracked row lands in the unchecked exceptions,
 * the target joins the checked set for its own group.
 */
export function checkedOnly(rows: readonly WorkspaceTreeWorkingChangeWire[], path: string): CheckedState {
  const uncheckedTracked = new Set<string>();
  const checkedUnversioned = new Set<string>();
  for (const row of rows) {
    if (row.ignored) continue;
    if (row.path === path) {
      if (row.unversioned) checkedUnversioned.add(row.path);
    } else if (!row.unversioned) {
      uncheckedTracked.add(row.path);
    }
  }
  return { uncheckedTracked, checkedUnversioned };
}

export type CheckAggregate = 'none' | 'some' | 'all';

/** Tri-state for a directory node / group header checkbox. */
export function aggregateChecked(
  rows: readonly WorkspaceTreeWorkingChangeWire[],
  state: CheckedState,
  paths: readonly string[],
): CheckAggregate {
  const target = new Set(paths);
  let checked = 0;
  let total = 0;
  for (const row of rows) {
    if (!target.has(row.path) || row.ignored) continue;
    total += 1;
    if (isRowChecked(row, state)) checked += 1;
  }
  if (total === 0 || checked === 0) return 'none';
  return checked === total ? 'all' : 'some';
}

/**
 * Counter parts for the Amend row's right edge — "2 modified",
 * "1 added, 1 deleted". Tracked letters fold as the IDE does: A added,
 * D deleted, everything else (M/T/R/C) modified; unversioned rows
 * count separately. Order: modified, added, deleted, unversioned.
 */
export interface ChangeCounter {
  modified: number;
  added: number;
  deleted: number;
  unversioned: number;
}

export function countChanges(rows: readonly WorkspaceTreeWorkingChangeWire[]): ChangeCounter {
  const counter: ChangeCounter = { modified: 0, added: 0, deleted: 0, unversioned: 0 };
  for (const row of rows) {
    if (row.ignored) continue;
    if (row.unversioned) counter.unversioned += 1;
    else if (row.status === 'A') counter.added += 1;
    else if (row.status === 'D') counter.deleted += 1;
    else counter.modified += 1;
  }
  return counter;
}

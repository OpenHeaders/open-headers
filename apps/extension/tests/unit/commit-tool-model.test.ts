/**
 * Pure-model suite for the Commit tool window (S22): the porcelain
 * group split, the exception-set checked algebra (tracked default
 * checked, unversioned default unchecked), the tri-state aggregates,
 * and the counter parts.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import {
  aggregateChecked,
  checkedPaths,
  countChanges,
  EMPTY_CHECKED_STATE,
  isRowChecked,
  setPathsChecked,
  splitChangeGroups,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import { describe, expect, it } from 'vitest';

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

const ROWS: WorkspaceTreeWorkingChangeWire[] = [
  row({ path: 'rules/a.yaml', status: 'M' }),
  row({ path: 'rules/b.yaml', status: 'A' }),
  row({ path: 'workspace.yaml', status: 'D' }),
  row({ path: 'notes/new.yaml', status: '?', unversioned: true }),
  row({ path: 'secret.log', status: '!', ignored: true }),
];

describe('splitChangeGroups', () => {
  it('splits tracked / unversioned / ignored', () => {
    const groups = splitChangeGroups(ROWS);
    expect(groups.changes.map((r) => r.path)).toEqual(['rules/a.yaml', 'rules/b.yaml', 'workspace.yaml']);
    expect(groups.unversioned.map((r) => r.path)).toEqual(['notes/new.yaml']);
    expect(groups.ignored.map((r) => r.path)).toEqual(['secret.log']);
  });
});

describe('checked-set algebra', () => {
  it('defaults: tracked checked, unversioned unchecked, ignored never', () => {
    expect(isRowChecked(ROWS[0], EMPTY_CHECKED_STATE)).toBe(true);
    expect(isRowChecked(ROWS[3], EMPTY_CHECKED_STATE)).toBe(false);
    expect(isRowChecked(ROWS[4], EMPTY_CHECKED_STATE)).toBe(false);
    expect(checkedPaths(ROWS, EMPTY_CHECKED_STATE)).toEqual(['rules/a.yaml', 'rules/b.yaml', 'workspace.yaml']);
  });

  it('unchecking a tracked path and checking an unversioned one are exceptions', () => {
    let state = setPathsChecked(ROWS, EMPTY_CHECKED_STATE, ['rules/a.yaml'], false);
    state = setPathsChecked(ROWS, state, ['notes/new.yaml'], true);
    expect(checkedPaths(ROWS, state)).toEqual(['rules/b.yaml', 'workspace.yaml', 'notes/new.yaml']);
    // Re-checking clears the exception.
    state = setPathsChecked(ROWS, state, ['rules/a.yaml'], true);
    expect(isRowChecked(ROWS[0], state)).toBe(true);
  });

  it('a rows-wide flip targets only the given paths and skips ignored', () => {
    const all = ROWS.map((r) => r.path);
    const state = setPathsChecked(ROWS, EMPTY_CHECKED_STATE, all, true);
    expect(checkedPaths(ROWS, state)).toEqual(['rules/a.yaml', 'rules/b.yaml', 'workspace.yaml', 'notes/new.yaml']);
    const none = setPathsChecked(ROWS, state, all, false);
    expect(checkedPaths(ROWS, none)).toEqual([]);
  });

  it('rows appearing between refetches keep the defaults', () => {
    const state = setPathsChecked(ROWS, EMPTY_CHECKED_STATE, ['rules/a.yaml'], false);
    const grown = [...ROWS, row({ path: 'rules/c.yaml', status: 'M' })];
    expect(isRowChecked(grown[5], state)).toBe(true);
    expect(checkedPaths(grown, state)).toEqual(['rules/b.yaml', 'workspace.yaml', 'rules/c.yaml']);
  });
});

describe('aggregateChecked', () => {
  it('answers all / some / none over a path subset', () => {
    expect(aggregateChecked(ROWS, EMPTY_CHECKED_STATE, ['rules/a.yaml', 'rules/b.yaml'])).toBe('all');
    const state = setPathsChecked(ROWS, EMPTY_CHECKED_STATE, ['rules/a.yaml'], false);
    expect(aggregateChecked(ROWS, state, ['rules/a.yaml', 'rules/b.yaml'])).toBe('some');
    expect(aggregateChecked(ROWS, state, ['rules/a.yaml'])).toBe('none');
    // The mixed Changes+Unversioned whole-list aggregate is 'some' at rest.
    expect(
      aggregateChecked(
        ROWS,
        EMPTY_CHECKED_STATE,
        ROWS.map((r) => r.path),
      ),
    ).toBe('some');
    expect(aggregateChecked(ROWS, EMPTY_CHECKED_STATE, [])).toBe('none');
  });
});

describe('countChanges', () => {
  it('folds tracked letters into modified/added/deleted and counts unversioned apart', () => {
    expect(countChanges(ROWS)).toEqual({ modified: 1, added: 1, deleted: 1, unversioned: 1 });
    expect(countChanges([row({ path: 'r.yaml', status: 'R' }), row({ path: 't.yaml', status: 'T' })])).toEqual({
      modified: 2,
      added: 0,
      deleted: 0,
      unversioned: 0,
    });
    // Ignored rows never count.
    expect(countChanges([row({ path: 'i.log', status: '!', ignored: true })])).toEqual({
      modified: 0,
      added: 0,
      deleted: 0,
      unversioned: 0,
    });
  });
});

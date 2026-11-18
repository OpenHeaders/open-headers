// @vitest-environment jsdom
/**
 * Git › Folder, the files not taken in — mounted pin: the title counts
 * every file, the list is a row a cause — what a manifest's row holds
 * back is counted beside it, and the files skipped in a directory that
 * holds no container are one row at the directory.
 */

import type { WorkspaceTreeIssueWire } from '@openheaders/core/bridge';
import GitIssueList from '@openheaders/ui/workbench/settings/components/git/git-issue-list';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const NOT_CONTAINED = 'rule inside no collection or folder of the workspace — skipped';
const OUTSIDE = 'rule in no collection or folder — skipped';

function rowsOf(issues: WorkspaceTreeIssueWire[]): string[] {
  render(<GitIssueList issues={issues} />);
  return [...screen.getByTestId('git-pane-issues-alert').querySelectorAll('li')].map((row) => row.textContent ?? '');
}

describe('Git › Folder — the files not taken in', () => {
  it('counts the leaves of a collection that does not read at its manifest row', () => {
    const rows = rowsOf([
      { path: 'rules/payments-colbbbbb/_collection.yaml', message: 'Invalid type' },
      { path: 'rules/loose-rule-rrrrrrr0/rule.yaml', message: OUTSIDE, uncontainedIn: 'rules' },
      ...['one-aaaaaaa1', 'two-aaaaaaa2', 'three-aaaaaaa3'].map((leaf) => ({
        path: `rules/payments-colbbbbb/${leaf}/rule.yaml`,
        message: NOT_CONTAINED,
        uncontainedIn: 'rules/payments-colbbbbb',
      })),
    ]);
    expect(rows).toEqual([
      'rules/payments-colbbbbb/_collection.yaml — Invalid type — and 3 files inside it',
      `rules/loose-rule-rrrrrrr0/rule.yaml — ${OUTSIDE}`,
    ]);
    expect(screen.getByTestId('git-pane-issues-alert').textContent).toContain(
      '5 files were not taken in and are left untouched',
    );
  });

  it('names the directory once for the files skipped in it', () => {
    const rows = rowsOf(
      ['one-aaaaaaa1', 'two-aaaaaaa2'].map((leaf) => ({
        path: `rules/by-hand/${leaf}/rule.yaml`,
        message: OUTSIDE,
        uncontainedIn: 'rules/by-hand',
      })),
    );
    expect(rows).toEqual(['rules/by-hand/ — 2 files in no collection or folder']);
  });

  it('lists a row each where a host names no directory', () => {
    const rows = rowsOf([
      { path: 'rules/by-hand/one-aaaaaaa1/rule.yaml', message: OUTSIDE },
      { path: 'rules/by-hand/two-aaaaaaa2/rule.yaml', message: OUTSIDE },
    ]);
    expect(rows).toEqual([
      `rules/by-hand/one-aaaaaaa1/rule.yaml — ${OUTSIDE}`,
      `rules/by-hand/two-aaaaaaa2/rule.yaml — ${OUTSIDE}`,
    ]);
  });
});

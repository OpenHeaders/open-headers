// @vitest-environment jsdom
/**
 * `CommitFilesView` — what a pane lists for the commit it shows, never
 * an empty pane. A merge lists no files in the log's entry: the view
 * asks the host once for its change against each parent and lists a
 * group per parent that has files, named by the parent, with a line
 * when the merge settled nothing itself and a group of its own when it
 * did; a file's diff reads against its group's parent. A plain commit
 * is never asked about; one that changes nothing says so; a host that
 * cannot answer leaves the entry's own files.
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

import CommitFilesView from '@openheaders/ui/workbench/components/panels/git/CommitFilesView';
import { commitFileGroups } from '@openheaders/ui/workbench/components/panels/git/commit-file-groups';
import { groupMemberKey } from '@openheaders/ui/workbench/components/panels/git/grouped-file-tree';
import { resetCommitParentChanges } from '@openheaders/ui/workbench/components/panels/git/use-commit-parent-changes';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const MERGE = 'c'.repeat(40);
const FIRST = `62f2fd14${'a'.repeat(32)}`;
const SECOND = `f9384613${'b'.repeat(32)}`;
const REQUEST = 'requests/git-pass-e2egcol1/health-probe-e2egreq2/request.yaml';

const CLEAN_MERGE = {
  ok: true,
  parents: [
    { sha: FIRST, subject: 'bump the probe header value', files: [{ path: REQUEST, status: 'M' }] },
    { sha: SECOND, subject: 'fix: health check timeout', files: [] },
  ],
  merged: [],
};

// jsdom lacks the CSS.escape the tree's keyboard scroll uses, and scrollIntoView.
beforeAll(() => {
  const scope = globalThis as unknown as { CSS?: { escape(v: string): string } };
  if (typeof scope.CSS === 'undefined' || typeof scope.CSS.escape !== 'function') {
    scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

beforeEach(() => {
  resetCommitParentChanges();
  mockCall.mockReset();
  mockCall.mockResolvedValue(CLEAN_MERGE);
});

afterEach(cleanup);

const headings = (): Array<string | null> =>
  screen.queryAllByTestId('git-tool-file-group-row').map((row) => row.getAttribute('title'));
const byKey = (key: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('[data-row-key]')].find(
    (row) => row.getAttribute('data-row-key') === key,
  );
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

type Open = (path: string, entity?: WorkspaceTreeEntityRefWire, base?: string) => void;

function view(
  commit: { sha: string; parents: string[] } | undefined,
  files: ReadonlyArray<{ path: string; status: string }> = [],
) {
  const onOpenFile = vi.fn<Open>();
  render(
    <CommitFilesView
      files={files}
      {...(commit !== undefined ? { commit } : {})}
      workspaceId="ws00001"
      sha={commit?.sha ?? MERGE}
      loadingPath={null}
      onOpenFile={onOpenFile}
      selectedPath={null}
      onSelectFile={() => undefined}
    />,
  );
  return { onOpenFile };
}

describe('CommitFilesView', () => {
  it('lists a merge by parent — the groups that have files, named by the parent — and says it settled nothing', async () => {
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    expect(screen.getByTestId('git-tool-files-reading')).toBeTruthy();
    await waitFor(() => expect(headings()).toEqual(['Changes to 62f2fd14 bump the probe header value']));
    expect(screen.getByTestId('git-tool-file-groups-note').textContent).toBe('No merged conflicts');
    expect(screen.getByTestId('git-tool-file-group-row').textContent).toContain('1 file');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.commitParentChanges', {
      workspaceId: 'ws00001',
      sha: MERGE,
    });
  });

  it('opens a file against its group’s parent', async () => {
    const { onOpenFile } = view({ sha: MERGE, parents: [FIRST, SECOND] });
    await waitFor(() => expect(headings()).toHaveLength(1));
    fireEvent.doubleClick(byKey(groupMemberKey(FIRST, REQUEST)));
    expect(onOpenFile).toHaveBeenLastCalledWith(REQUEST, undefined, FIRST);
  });

  it('lists what the merge settled itself ahead of the parents, with no line', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      parents: [
        { sha: FIRST, subject: 'main: its change', files: [{ path: 'both.md', status: 'M' }] },
        {
          sha: SECOND,
          subject: 'feature: its change',
          files: [
            { path: 'both.md', status: 'M' },
            { path: 'side.md', status: 'M' },
          ],
        },
      ],
      merged: [{ path: 'both.md', status: 'M' }],
    });
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    await waitFor(() =>
      expect(headings()).toEqual([
        'Merged with conflicts',
        'Changes to 62f2fd14 main: its change',
        'Changes to f9384613 feature: its change',
      ]),
    );
    expect(screen.queryByTestId('git-tool-file-groups-note')).toBeNull();
  });

  it('a merge that differs from no parent still says so — never an empty pane', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      parents: [
        { sha: FIRST, subject: 'a', files: [] },
        { sha: SECOND, subject: 'b', files: [] },
      ],
      merged: [],
    });
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    await waitFor(() =>
      expect(screen.getByTestId('git-tool-file-groups-note').textContent).toBe('No merged conflicts'),
    );
    expect(headings()).toEqual([]);
  });

  it('keeps an answer: the same merge shown again lists on its first paint, unasked', async () => {
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    await waitFor(() => expect(headings()).toHaveLength(1));
    cleanup();
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    expect(headings()).toHaveLength(1);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('never asks about a plain commit, and lists its own files', () => {
    view({ sha: FIRST, parents: [SECOND] }, [{ path: REQUEST, status: 'M' }]);
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('git-tool-file').map((row) => row.getAttribute('data-path'))).toEqual([REQUEST]);
    expect(headings()).toEqual([]);
  });

  it('a commit, or a set of them, that changes no file says so', () => {
    view({ sha: FIRST, parents: [SECOND] });
    expect(screen.getByTestId('git-tool-files-none').textContent).toBe('No files changed');
    cleanup();
    view(undefined);
    expect(screen.getByTestId('git-tool-files-none').textContent).toBe('No files changed');
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('a host that cannot answer leaves the entry’s own listing', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'unknown-commit' });
    view({ sha: MERGE, parents: [FIRST, SECOND] });
    await waitFor(() => expect(screen.getByTestId('git-tool-files-none')).toBeTruthy());
    expect(headings()).toEqual([]);
  });
});

describe('commitFileGroups', () => {
  it('leaves out a parent the commit does not differ from, and reads each group against its parent', () => {
    expect(commitFileGroups(CLEAN_MERGE)).toEqual([
      {
        kind: 'parent',
        id: FIRST,
        base: FIRST,
        subject: 'bump the probe header value',
        files: [{ path: REQUEST, status: 'M' }],
      },
    ]);
  });
});

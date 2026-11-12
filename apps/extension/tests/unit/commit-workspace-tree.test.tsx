// @vitest-environment jsdom
/**
 * The Commit tree over the live workspace (`CommitWorkspaceTree`): a
 * tracked file the workspace holds no entity for — its entity deleted
 * in the workbench, the change not yet committed — is listed by its
 * path first, then named from HEAD. Pins that the host is asked once,
 * at HEAD's sha, for exactly the tracked files inside an entity tree it
 * could not name — never an unversioned file, never one of the user's
 * own — that the answer lists the file under its collection in the
 * Changes group alone, and that an unborn branch asks nothing.
 */

import type { WorkspaceTreeEntityRefWire, WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

import CommitWorkspaceTree from '@openheaders/ui/workbench/components/panels/git/commit/CommitWorkspaceTree';
import {
  EMPTY_CHECKED_STATE,
  splitChangeGroups,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import { resetFormerFiles } from '@openheaders/ui/workbench/components/panels/git/use-former-files';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

const HEAD = 'c'.repeat(40);
const CANCEL = 'requests/orders-col00001/cancel-order-req00009/request.yaml';
const STRAY = 'requests/orders-col00001/draft-req00007/request.yaml';
const NOTES = 'notes/a.md';

const ORDERS: WorkspaceTreeEntityRefWire = { kind: 'collection', tree: 'requests', uid: 'col00001', name: 'Orders' };
const CANCEL_ORDER: WorkspaceTreeEntityRefWire = {
  kind: 'request',
  tree: 'requests',
  uid: 'req00009',
  name: 'Cancel Order',
  method: 'DELETE',
};

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

const GROUPS = splitChangeGroups([
  row({ path: CANCEL, status: 'D' }),
  row({ path: NOTES }),
  row({ path: STRAY, status: '?', unversioned: true }),
]);

beforeEach(() => {
  resetFormerFiles();
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true, entities: [{ path: CANCEL, entity: CANCEL_ORDER, containers: [ORDERS] }] });
});

afterEach(cleanup);

const sectionsIn = (group: string): Array<string | null> =>
  [...screen.getByTestId(`commit-tool-named-${group}`).querySelectorAll('.rules-sidebar-section')].map((header) =>
    header.getAttribute('data-testid'),
  );
const labelsIn = (group: string): string[] =>
  [...screen.getByTestId(`commit-tool-named-${group}`).querySelectorAll('.rules-sidebar-item-label')].map(
    (label) => label.textContent ?? '',
  );

function tree(headSha: string | null) {
  return (
    <AntApp>
      <CommitWorkspaceTree
        workspaceId="ws00001"
        headSha={headSha}
        groups={GROUPS}
        checked={EMPTY_CHECKED_STATE}
        onSetChecked={() => undefined}
        onOpenFile={() => undefined}
        groupByDirectory
        showIgnored={false}
        rowMenu={() => null}
      />
    </AntApp>
  );
}

describe('the Commit tree over a workspace that no longer holds a changed file’s entity', () => {
  it('lists the file by its path, asks HEAD for the tracked files it could not name, then lists it as HEAD names it — under Changes alone', async () => {
    render(tree(HEAD));
    expect(sectionsIn('changes')).toEqual(['commit-tool-section-changes-files']);
    await waitFor(() =>
      expect(sectionsIn('changes')).toEqual([
        'commit-tool-section-changes-requests',
        'commit-tool-section-changes-files',
      ]),
    );
    expect(labelsIn('changes')).toEqual(['Orders', 'Cancel Order', 'notes', 'a.md']);
    expect(sectionsIn('unversioned')).toEqual(['commit-tool-section-unversioned-files']);
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.entitiesAtCommit', {
      workspaceId: 'ws00001',
      sha: HEAD,
      paths: [CANCEL],
    });
    // The row stays the one file it stands for.
    const [cancel] = screen.getAllByTestId('commit-tool-file');
    expect(cancel.getAttribute('data-path')).toBe(CANCEL);
    expect(cancel.textContent).toContain('DEL');
  });

  it('an unborn branch has no commit to name a file from — nothing is asked', () => {
    render(tree(null));
    expect(sectionsIn('changes')).toEqual(['commit-tool-section-changes-files']);
    expect(mockCall).not.toHaveBeenCalled();
  });
});

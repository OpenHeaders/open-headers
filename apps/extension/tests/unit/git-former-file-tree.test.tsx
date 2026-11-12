// @vitest-environment jsdom
/**
 * A commit's files the workspace holds no entity for — deleted since,
 * or living on another branch — named from the commit itself. Pins the
 * tree over the live workspace (`WorkspaceFileTree`, through
 * `FileTreeView`): it lists such a file by its path first, asks the
 * host once for exactly the files it could not name (never the user's
 * own), then lists them under the collection and the entity the commit
 * names; an answer is kept, a union asks per commit, a host that
 * refuses leaves the files where they were, and a former entity has no
 * editor to jump to.
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

import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import { resetFormerFiles } from '@openheaders/ui/workbench/components/panels/git/use-former-files';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const SHA = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
const DIR = 'requests/orders-col00001/cancel-order-req00009';
const MANIFEST = `${DIR}/request.yaml`;
const BODY = `${DIR}/body.json`;
const NOTES = 'notes/a.md';

const ORDERS: WorkspaceTreeEntityRefWire = { kind: 'collection', tree: 'requests', uid: 'col00001', name: 'Orders' };
const CANCEL: WorkspaceTreeEntityRefWire = {
  kind: 'request',
  tree: 'requests',
  uid: 'req00009',
  name: 'Cancel Order',
  method: 'DELETE',
};

const FILES = [
  { path: MANIFEST, status: 'D' },
  { path: BODY, status: 'D' },
  { path: NOTES, status: 'M' },
];

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
  resetFormerFiles();
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true, entities: [{ path: MANIFEST, entity: CANCEL, containers: [ORDERS] }] });
});

afterEach(cleanup);

const labels = (): string[] =>
  [...document.querySelectorAll('.rules-sidebar-item-label')].map((label) => label.textContent ?? '');
const sections = (): Array<string | null> =>
  [...document.querySelectorAll('.rules-sidebar-section')].map((header) => header.getAttribute('data-testid'));
const byKey = (key: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('[data-row-key]')].find(
    (row) => row.getAttribute('data-row-key') === key,
  );
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

function tree(files: ReadonlyArray<{ path: string; status: string; sha?: string }>, sha = SHA) {
  const onSelectFile = vi.fn<(path: string | null, entity?: WorkspaceTreeEntityRefWire) => void>();
  const view = (
    <FileTreeView
      files={files}
      workspaceId="ws00001"
      sha={sha}
      loadingPath={null}
      onOpenFile={() => undefined}
      selectedPath={null}
      onSelectFile={onSelectFile}
      groupByWorkspace
    />
  );
  return { view, onSelectFile };
}

describe('a named file tree over a commit of entities the workspace no longer holds', () => {
  it('lists the files by path, asks the host for those it could not name — never the user’s own — then lists them as the commit names them', async () => {
    render(tree(FILES).view);
    expect(sections()).toEqual(['git-tool-file-section-files']);
    await waitFor(() => expect(sections()).toEqual(['git-tool-file-section-requests', 'git-tool-file-section-files']));
    expect(labels()).toEqual(['Orders', 'Cancel Order', 'Details', 'Body', 'notes', 'a.md']);
    expect(byKey('requests:req00009').textContent).toContain('DEL');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.entitiesAtCommit', {
      workspaceId: 'ws00001',
      sha: SHA,
      paths: [BODY, MANIFEST],
    });
  });

  it('keeps an answer — the same commit shown again is named on its first paint and asks nothing', async () => {
    const first = render(tree(FILES).view);
    await waitFor(() => expect(labels()).toContain('Cancel Order'));
    first.unmount();
    render(tree([...FILES]).view);
    expect(labels()).toContain('Cancel Order');
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('a set of commits asks each commit about the files it changed', async () => {
    const other = 'requests/orders-col00001/refund-req00008/request.yaml';
    render(
      tree([
        { path: MANIFEST, status: 'D', sha: SHA },
        { path: other, status: 'D', sha: OLDER },
      ]).view,
    );
    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2));
    expect(mockCall.mock.calls.map(([, request]) => [request.sha, request.paths])).toEqual([
      [SHA, [MANIFEST]],
      [OLDER, [other]],
    ]);
  });

  it('a host that refuses leaves the files listed by their path', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'not-bound' });
    render(tree(FILES).view);
    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1));
    expect(sections()).toEqual(['git-tool-file-section-files']);
    expect(labels()).toContain('request.yaml');
  });

  it('a former entity’s row reports its file and no entity — there is no editor to jump to', async () => {
    const { view, onSelectFile } = tree(FILES);
    render(view);
    await waitFor(() => expect(labels()).toContain('Cancel Order'));
    fireEvent.click(byKey(BODY));
    expect(onSelectFile).toHaveBeenLastCalledWith(BODY, undefined);
    fireEvent.click(byKey('requests:req00009'));
    expect(onSelectFile).toHaveBeenLastCalledWith(null, undefined);
    expect(screen.getAllByTestId('git-tool-file').map((row) => row.getAttribute('data-path'))).toEqual([
      MANIFEST,
      BODY,
      NOTES,
    ]);
  });
});

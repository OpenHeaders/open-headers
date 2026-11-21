// @vitest-environment jsdom
/**
 * The Commit window serves ONE workspace at a time, the one the
 * workbench shows: what it holds of a workspace — the files unchecked,
 * Amend and the draft Amend set aside — never reaches the next one
 * shown. A file unchecked in one workspace stays checked in another
 * that changed a file of the same path; a workspace shown again starts
 * with its defaults; a draft Amend set aside goes back to its own
 * workspace when another is shown.
 */

import type { WorkspaceTreeGitStatusWire, WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall, mirror } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mirror: {
    liveActiveWorkspaceId: (): string | null => 'ws-active',
    subscribeMirror: (): (() => void) => () => undefined,
  },
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

vi.mock('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror')>();
  return { ...actual, getActiveExtensionWorkspaceSyncMirror: () => mirror };
});

// The diff and merge dialogs load the code editor, which jsdom cannot.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/merge-editor', () => ({ MergeConflictModal: () => null }));

import { __resetBackgroundTasksForTests } from '@openheaders/ui/shared/background-tasks';
import CommitToolPanel from '@openheaders/ui/workbench/components/panels/git/commit/CommitToolPanel';
import {
  getCommitViewPrefs,
  patchCommitViewPrefs,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-view-prefs';
import { setFilesViewMode } from '@openheaders/ui/workbench/components/panels/git/files-view-mode';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { resetWorkspaceGitStoreForTests } from '@openheaders/ui/workbench/stores/git-status-store';

const HEAD_SHA = 'a'.repeat(40);

const STATUS: WorkspaceTreeGitStatusWire = {
  bound: true,
  git: { available: true, version: '2.54.0' },
  repo: true,
  branch: 'main',
  headSha: HEAD_SHA,
  branches: ['main'],
  tags: [],
  dirtyFiles: 2,
  userIndexBusy: false,
  suggestedMessage: '',
  cadence: 'off',
  bypassHooks: false,
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  autoPushOnCommit: false,
  forcePush: null,
  shallow: false,
};

function row(path: string): WorkspaceTreeWorkingChangeWire {
  return { path, status: 'M', unversioned: false, ignored: false };
}

/** What each bound workspace's folder holds changed — `workspace.yaml` is in every one. */
let changes: Record<string, WorkspaceTreeWorkingChangeWire[]>;

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  if (typeof Element.prototype.scrollIntoView !== 'function') Element.prototype.scrollIntoView = () => undefined;
  registerCapability('workspaceGit', () => true);
});

afterAll(() => {
  unregisterCapability('workspaceGit');
});

beforeEach(() => {
  resetWorkspaceGitStoreForTests();
  __resetBackgroundTasksForTests();
  changes = {};
  mockCall.mockReset();
  mockCall.mockImplementation(async (verb: string, payload?: { workspaceId?: string }) => {
    const workspaceId = payload?.workspaceId ?? '';
    switch (verb) {
      case 'oh.workspaceTree.list':
        return {
          bindings: Object.keys(changes).map((id) => ({ workspaceId: id, rootDir: `/repos/${id}`, issues: [] })),
        };
      case 'oh.workspaceTree.gitStatus':
        return workspaceId in changes ? STATUS : { bound: false };
      case 'oh.workspaceTree.listRefs':
        return { ok: true, refs: [], current: 'main' };
      case 'oh.workspaceTree.changes':
        return { ok: true, changes: changes[workspaceId] ?? [] };
      case 'oh.workspaceTree.log':
        return {
          ok: true,
          entries: [
            {
              sha: HEAD_SHA,
              subject: `head of ${workspaceId}`,
              authorName: 'John Doe',
              authorEmail: 'john.doe@openheaders.io',
            },
          ],
        };
      default:
        throw new Error(`no answer for ${verb}`);
    }
  });
});

afterEach(cleanup);

/** The Commit window under the workspace the workbench shows; `show` shows another. */
function mount(shown: string): { show: (next: string) => void } {
  const tree = (workspaceId: string) => (
    <AntApp>
      <EditingScopeWorkspaceProvider workspaceId={workspaceId}>
        <CommitToolPanel info={{ title: 'Commit', summary: 'Commit changes' }} onHide={() => undefined} />
      </EditingScopeWorkspaceProvider>
    </AntApp>
  );
  const view = render(tree(shown));
  return { show: (next) => view.rerender(tree(next)) };
}

const fileRow = (path: string): Element | undefined =>
  [...document.querySelectorAll('[data-testid="commit-tool-file"]')].find(
    (line) => line.getAttribute('data-path') === path,
  );
const drawn = (path: string): Promise<void> => waitFor(() => expect(fileRow(path)).toBeDefined());
const box = (path: string): HTMLInputElement =>
  fileRow(path)?.querySelector('input[type="checkbox"]') as HTMLInputElement;
const amend = (): HTMLInputElement => screen.getByTestId('commit-tool-amend') as HTMLInputElement;

/** Two bound workspaces, each with `workspace.yaml` changed and one file of its own. */
function twoWorkspaces(first: string, second: string): void {
  changes = {
    [first]: [row('workspace.yaml'), row('first-only.yaml')],
    [second]: [row('workspace.yaml'), row('second-only.yaml')],
  };
  setFilesViewMode(first, 'files');
  setFilesViewMode(second, 'files');
}

describe('CommitToolPanel — one workspace at a time', () => {
  it('a file unchecked in one workspace stays checked in the next one shown', async () => {
    twoWorkspaces('ws-checks-1', 'ws-checks-2');
    const { show } = mount('ws-checks-1');
    await drawn('first-only.yaml');
    fireEvent.click(box('workspace.yaml'));
    expect(box('workspace.yaml').checked).toBe(false);

    show('ws-checks-2');
    await drawn('second-only.yaml');
    expect(fileRow('first-only.yaml')).toBeUndefined();
    expect(box('workspace.yaml').checked).toBe(true);
  });

  it('a workspace shown again starts with its defaults', async () => {
    twoWorkspaces('ws-again-1', 'ws-again-2');
    const { show } = mount('ws-again-1');
    await drawn('first-only.yaml');
    fireEvent.click(box('workspace.yaml'));

    show('ws-again-2');
    await drawn('second-only.yaml');
    show('ws-again-1');
    await drawn('first-only.yaml');
    expect(box('workspace.yaml').checked).toBe(true);
  });

  it('a draft Amend set aside goes back to its workspace, and Amend does not follow to the next', async () => {
    twoWorkspaces('ws-amend-1', 'ws-amend-2');
    patchCommitViewPrefs('ws-amend-1', { draft: 'a draft of my own' });
    const { show } = mount('ws-amend-1');
    await drawn('first-only.yaml');
    fireEvent.click(amend());
    await waitFor(() => expect(getCommitViewPrefs('ws-amend-1').draft).toBe('head of ws-amend-1'));

    show('ws-amend-2');
    await drawn('second-only.yaml');
    expect(getCommitViewPrefs('ws-amend-1').draft).toBe('a draft of my own');
    expect(amend().checked).toBe(false);
    expect(getCommitViewPrefs('ws-amend-2').draft).toBe('');
  });
});

// @vitest-environment jsdom
/**
 * A git operation started outside the app — a rebase, a merge, a
 * cherry-pick, a revert, a bisect — and its face. The status frame names
 * it (`gitOperationOf`); while it stands the branch widget wears the
 * warning and says which, in the branch it stands in; the branch
 * actions' one verb for it asks first, then sends git's own abort and
 * says how it went — Cancel sends nothing, a refusal is said in git's
 * words.
 */

import type { WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall, snapshot } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  snapshot: { current: null as unknown },
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

// The code editors stay out of jsdom: the hook reaches them only through its dialogs.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/merge-editor', () => ({ MergeConflictModal: () => null }));

// The widget reads the one git status store; the pin hands it a frame.
vi.mock('@openheaders/ui/workbench/stores/git-status-store', () => ({
  useWorkspaceGitSnapshot: () => snapshot.current,
}));

import {
  type GitBranchActions,
  useGitBranchActions,
} from '@openheaders/ui/workbench/components/panels/git/branch-actions/use-git-branch-actions';
import GitBranchWidget from '@openheaders/ui/workbench/components/panels/git/branch-widget/GitBranchWidget';
import { gitOperationOf } from '@openheaders/ui/workbench/components/panels/git/git-operation';

function status(overrides: Partial<WorkspaceTreeGitStatusWire> = {}): WorkspaceTreeGitStatusWire {
  return {
    bound: true,
    git: { available: true, version: '2.54.0' },
    repo: true,
    branch: 'main',
    headSha: 'b55ab33c'.padEnd(40, '0'),
    branches: ['main'],
    tags: [],
    dirtyFiles: 1,
    userIndexBusy: false,
    suggestedMessage: '',
    cadence: 'off',
    bypassHooks: false,
    upstream: null,
    ahead: null,
    behind: null,
    autoPushOnCommit: false,
    forcePush: null,
    shallow: false,
    ...overrides,
  };
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

/** The store's snapshot around a frame. */
const around = (frame: WorkspaceTreeGitStatusWire) => ({
  bound: true,
  rootDir: '/repo/ws',
  status: frame,
  refs: [],
  current: frame.branch,
});

beforeEach(() => {
  mockCall.mockReset();
  snapshot.current = around(status());
});

afterEach(cleanup);

describe('gitOperationOf', () => {
  it('reads the frame’s operation; null at rest, unbound, and from a host that does not say', () => {
    expect(gitOperationOf(status({ operation: 'cherry-pick' }))).toBe('cherry-pick');
    expect(gitOperationOf(status({ operation: null }))).toBeNull();
    expect(gitOperationOf(status())).toBeNull();
    expect(gitOperationOf(status({ bound: false, operation: 'merge' }))).toBeNull();
    expect(gitOperationOf(null)).toBeNull();
  });
});

describe('GitBranchWidget — an operation in progress', () => {
  const widget = (frame: WorkspaceTreeGitStatusWire): void => {
    snapshot.current = around(frame);
    render(
      <AntApp>
        <GitBranchWidget workspaceId="ws-1" onOpenCommit={() => undefined} />
      </AntApp>,
    );
  };

  it('at rest reads the branch alone', () => {
    widget(status());
    expect(screen.getByTestId('git-branch-widget-name').textContent).toBe('main');
    expect(screen.queryByTestId('git-branch-widget-operation')).toBeNull();
  });

  it('says which operation stands, in the branch it stands in, under the warning', () => {
    widget(status({ operation: 'cherry-pick' }));
    expect(screen.getByTestId('git-branch-widget-name').textContent).toBe('Cherry-picking in main');
    expect(screen.getByTestId('git-branch-widget-operation').getAttribute('data-operation')).toBe('cherry-pick');
    expect(screen.getByTestId('git-branch-widget').getAttribute('aria-label')).toBe(
      'Git branch: Cherry-picking in main',
    );
  });

  it('a rebase stands on a detached head and reads so', () => {
    widget(status({ operation: 'rebase', branch: null }));
    expect(screen.getByTestId('git-branch-widget-name').textContent).toBe('Rebasing in HEAD · b55ab33c');
  });
});

describe('useGitBranchActions — the way out of an operation', () => {
  function mount(): GitBranchActions {
    let actions: GitBranchActions | null = null;
    const Probe: React.FC = () => {
      actions = useGitBranchActions({ workspaceId: 'ws-1', currentRef: 'main', refs: [] });
      return <>{actions.dialogs}</>;
    };
    render(
      <AntApp>
        <Probe />
      </AntApp>,
    );
    if (actions === null) throw new Error('the hook did not mount');
    return actions;
  }

  const BODY =
    'The branch and its files go back to where they were when it started. What was resolved since is discarded.';

  it('asks first under the verb’s own name, then sends the abort and says the branch is back', async () => {
    mockCall.mockResolvedValue({ ok: true, operation: 'cherry-pick' });
    const actions = mount();
    act(() => actions.abortOperation('cherry-pick'));
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());
    expect(mockCall).not.toHaveBeenCalled();
    const ok = screen.getByTestId('git-abort-operation-ok');
    expect(ok.textContent).toBe('Abort Cherry-Pick');

    fireEvent.click(ok);
    await waitFor(() => expect(screen.getByText('The branch is back where it started')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([['oh.workspaceTree.abortOperation', { workspaceId: 'ws-1' }]]);
  });

  it('Cancel sends nothing', async () => {
    const actions = mount();
    act(() => actions.abortOperation('merge'));
    await waitFor(() => expect(screen.getByTestId('git-abort-operation-ok').textContent).toBe('Abort Merge'));
    // antd keeps a closed dialog's node — what was sent is the proof.
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('a refusal is said in git’s own words', async () => {
    mockCall.mockResolvedValue({
      ok: false,
      reason: 'abort-failed',
      operation: 'rebase',
      detail: 'fatal: Unable to create index.lock',
    });
    const actions = mount();
    act(() => actions.abortOperation('rebase'));
    await waitFor(() => expect(screen.getByTestId('git-abort-operation-ok').textContent).toBe('Abort Rebase'));
    fireEvent.click(screen.getByTestId('git-abort-operation-ok'));
    await waitFor(() => expect(screen.getByText('Could not abort: fatal: Unable to create index.lock')).toBeTruthy());
  });
});

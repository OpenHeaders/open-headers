// @vitest-environment jsdom
/**
 * The top bar's branch popup and its remotes: a remote's folder takes
 * the rail's own menu on a right-click — Edit Remote, Remove Remote —
 * and is the menu's target while it is open; each verb closes the popup
 * first and names the remote. A grouping of branch names has no menu.
 */

import type { WorkspaceTreeGitStatusWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { GitBranchActions } from '@openheaders/ui/workbench/components/panels/git/branch-actions/use-git-branch-actions';
import GitBranchPopup from '@openheaders/ui/workbench/components/panels/git/branch-widget/GitBranchPopup';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(cleanup);

const STATUS: WorkspaceTreeGitStatusWire = {
  bound: true,
  git: { available: true, version: '2.54.0' },
  repo: true,
  branch: 'main',
  headSha: 'a'.repeat(40),
  branches: ['main', 'feature/login'],
  tags: [],
  dirtyFiles: 0,
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

const REFS: WorkspaceTreeRefWire[] = [
  { name: 'main', kind: 'local', sha: 'a'.repeat(40) },
  { name: 'feature/login', kind: 'local', sha: 'b'.repeat(40) },
  { name: 'origin/main', kind: 'remote', sha: 'a'.repeat(40) },
  { name: 'origin/feature/login', kind: 'remote', sha: 'b'.repeat(40) },
];

function actions(): GitBranchActions {
  return {
    checkout: vi.fn(),
    checkoutRemote: vi.fn(),
    checkoutRevision: vi.fn(),
    newBranchFrom: vi.fn(),
    newTagAt: vi.fn(),
    mergeIntoCurrent: vi.fn(),
    updateBranch: vi.fn(),
    deleteBranch: vi.fn(),
    abortOperation: vi.fn(),
    fetch: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    manageRemotes: vi.fn(),
    editRemote: vi.fn(),
    removeRemote: vi.fn(),
    busy: { switching: false, merge: false, update: false, fetch: false, pull: false, push: false, working: false },
    dialogs: null,
  };
}

function mount(): { verbs: GitBranchActions; onClose: () => void } {
  const verbs = actions();
  const onClose = vi.fn();
  render(
    <AntApp>
      <GitBranchPopup
        workspaceId="ws-popup-remotes"
        status={STATUS}
        refs={REFS}
        currentRef="main"
        actions={verbs}
        onOpenCompare={() => undefined}
        onOpenCommit={() => undefined}
        onClose={onClose}
      />
    </AntApp>,
  );
  const section = (kind: string): Element =>
    document.querySelector(
      `[data-testid="git-branch-popup-section"][data-kind="${kind}"] [data-testid="git-branch-popup-section-header"]`,
    ) as Element;
  // Local is open by default (no Recent section); Remote and its folders are not.
  fireEvent.click(section('remote'));
  return { verbs, onClose };
}

const folder = (key: string): Element =>
  [...document.querySelectorAll('[data-testid="git-branch-popup-folder"]')].find(
    (row) => row.getAttribute('data-key') === key,
  ) as Element;
const remoteRow = (): Element =>
  document.querySelector('[data-testid="git-branch-popup-folder"][data-remote="origin"]') as Element;

describe('GitBranchPopup — a remote’s folder', () => {
  it('right-click opens the remote’s edits; the row is the menu’s target; Edit Remote closes the popup and names it', async () => {
    const { verbs, onClose } = mount();
    expect(remoteRow().classList.contains('menu-target')).toBe(false);
    fireEvent.contextMenu(remoteRow());
    const edit = await screen.findByTestId('git-tool-ref-menu-edit-remote');
    expect(screen.getByTestId('git-tool-ref-menu-remove-remote')).not.toBeNull();
    expect(remoteRow().classList.contains('menu-target')).toBe(true);
    fireEvent.click(edit);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(verbs.editRemote).toHaveBeenCalledWith('origin');
    expect(verbs.removeRemote).not.toHaveBeenCalled();
  });

  it('Remove Remote closes the popup and names the remote', async () => {
    const { verbs, onClose } = mount();
    fireEvent.contextMenu(remoteRow());
    fireEvent.click(await screen.findByTestId('git-tool-ref-menu-remove-remote'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(verbs.removeRemote).toHaveBeenCalledWith('origin');
  });

  it('a grouping of branch names is no remote: no menu, the plain folder', () => {
    mount();
    fireEvent.click(remoteRow());
    for (const key of ['local:feature', 'remote:origin/feature']) {
      const grouping = folder(key);
      expect(grouping, key).toBeDefined();
      expect(grouping.getAttribute('data-remote')).toBeNull();
      expect(grouping.closest('.ant-dropdown-trigger')).toBeNull();
    }
  });
});

describe('GitBranchPopup — its gear', () => {
  it('wears the corner mark of a button with a menu behind it; Fetch beside it does not', () => {
    mount();
    const gear = screen.getByTestId('git-branch-popup-settings');
    expect(gear.getAttribute('aria-haspopup')).toBe('menu');
    expect(gear.contains(screen.getByTestId('git-branch-popup-settings-menu-mark'))).toBe(true);
    expect(screen.getByTestId('git-branch-popup-fetch').getAttribute('aria-haspopup')).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * Git › Log section — mounted pin: without a repository the section is
 * the Folder-page pointer; with one, the rows read the window's own
 * per-workspace stores (log view + console prefs), a flip patches the
 * store the open window subscribes to, and the row's reset returns the
 * default.
 */

import type { WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';
import {
  getGitConsolePrefs,
  patchGitConsolePrefs,
} from '@openheaders/ui/workbench/components/panels/git/git-console-view-state';
import {
  getGitLogViewPrefs,
  patchGitLogViewPrefs,
} from '@openheaders/ui/workbench/components/panels/git/git-log-view-prefs';
import GitLogSection from '@openheaders/ui/workbench/settings/components/git/git-log-section';
import type { WorkspaceGit } from '@openheaders/ui/workbench/settings/components/git/use-workspace-git';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// antd's Select measures through rc-resize-observer — jsdom has none.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const WS = 'ws-log-page';

const STATUS: WorkspaceTreeGitStatusWire = {
  bound: true,
  git: { available: true, version: '2.45.0' },
  repo: true,
  branch: 'main',
} as WorkspaceTreeGitStatusWire;

function gitOf(gitStatus: WorkspaceTreeGitStatusWire | null): WorkspaceGit {
  return {
    call: vi.fn() as unknown as WorkspaceGit['call'],
    workspaceId: WS,
    binding: null,
    gitStatus,
    refresh: vi.fn(async () => undefined),
    refreshGitStatus: vi.fn(async () => undefined),
  };
}

describe('Git › Log section', () => {
  it('points at the Folder page while the workspace has no repository', () => {
    render(<GitLogSection git={gitOf(null)} />);
    expect(screen.getByTestId('git-pane-needs-repo')).toBeTruthy();
    expect(screen.queryByTestId('git-log-pane-tag-names')).toBeNull();
  });

  it('reads the stores, a flip patches them, and reset restores the default', () => {
    patchGitLogViewPrefs(WS, { showTagNames: true, showCommitTimestamp: false });
    patchGitConsolePrefs(WS, { shortenPaths: true });
    render(<GitLogSection git={gitOf(STATUS)} />);
    const tagNames = screen.getByTestId('git-log-pane-tag-names');
    expect(tagNames.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(tagNames);
    expect(getGitLogViewPrefs(WS).showTagNames).toBe(false);
    expect(tagNames.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByTestId('git-log-pane-shorten-paths'));
    expect(getGitConsolePrefs(WS).shortenPaths).toBe(false);

    // S46: Compact References View is on by default and rides the same store.
    const compact = screen.getByTestId('git-log-pane-compact-references');
    expect(compact.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(compact);
    expect(getGitLogViewPrefs(WS).compactReferences).toBe(false);

    // S46: the Columns prefs ride the same store — the hash column is off by default.
    const hash = screen.getByTestId('git-log-pane-hash-column');
    expect(hash.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(hash);
    expect(getGitLogViewPrefs(WS).showHashColumn).toBe(true);
    expect(screen.getByTestId('git-log-pane-author-column').getAttribute('aria-checked')).toBe('true');

    // S41: the current-branch band rides the same store.
    const band = screen.getByTestId('git-log-pane-current-branch');
    expect(band.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(band);
    expect(getGitLogViewPrefs(WS).highlightCurrentBranch).toBe(false);

    // The modified row grows a reset; it returns the store's default.
    const row = tagNames.closest('.settings-field-row') as HTMLElement;
    // The row's antd reset button — the (i) trigger is a bare button, the switch a role=switch button.
    const reset = row.querySelector('button.ant-btn');
    expect(reset).not.toBeNull();
    fireEvent.click(reset as HTMLButtonElement);
    expect(getGitLogViewPrefs(WS).showTagNames).toBe(true);
  });
});

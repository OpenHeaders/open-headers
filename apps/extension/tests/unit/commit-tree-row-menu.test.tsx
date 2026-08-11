// @vitest-environment jsdom
/**
 * Commit tree row context menus — mounted pin: right-click on a file
 * row opens the antd Dropdown (the S23 live regression surface). Runs
 * against the real CommitChangesTree + menu builders, with the tri-arm
 * menu contract: tracked rows get the changelist variant, unversioned
 * rows the gitignore submenu, ignored rows the Stop Ignoring variant.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import CommitChangesTree from '@openheaders/ui/workbench/components/panels/git/commit/CommitChangesTree';
import { EMPTY_CHECKED_STATE, splitChangeGroups } from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import {
  buildCommitRowMenu,
  buildIgnoredRowMenu,
  type CommitRowMenuHandlers,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-row-menu';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// antd's Dropdown measures via rc-resize-observer — jsdom has none;
// jsdom also lacks the CSS.escape the tree's selection scroll uses.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver; CSS?: { escape(v: string): string } };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (typeof scope.CSS === 'undefined' || typeof scope.CSS.escape !== 'function') {
    scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

afterEach(cleanup);

const t: Translate = (key: string) => key;

function handlers(): CommitRowMenuHandlers {
  return {
    onCommitFile: vi.fn(),
    onShowDiff: vi.fn(),
    onRefresh: vi.fn(),
    onPush: vi.fn(),
    onPull: vi.fn(),
    onFetch: vi.fn(),
    onCompareWithBranch: vi.fn(),
    onBranches: vi.fn(),
    onNewBranch: vi.fn(),
    onIgnorePath: vi.fn(),
    onUnignorePath: vi.fn(),
  };
}

function row(overrides: Partial<WorkspaceTreeWorkingChangeWire> & { path: string }): WorkspaceTreeWorkingChangeWire {
  return { status: 'M', unversioned: false, ignored: false, ...overrides };
}

function renderTree(rows: WorkspaceTreeWorkingChangeWire[], h: CommitRowMenuHandlers): void {
  render(
    <AntApp>
      <CommitChangesTree
        groups={splitChangeGroups(rows)}
        checked={EMPTY_CHECKED_STATE}
        onSetChecked={() => undefined}
        onOpenFile={() => undefined}
        groupByDirectory
        showIgnored
        rowMenu={(r) => (r.ignored ? buildIgnoredRowMenu(r, t, h) : buildCommitRowMenu(r, t, h))}
      />
    </AntApp>,
  );
}

describe('commit tree row context menu', () => {
  it('right-click on a tracked row opens the menu with live verbs', async () => {
    const h = handlers();
    renderTree([row({ path: 'workspace.yaml' })], h);
    const fileRow = document.querySelector('[data-testid="commit-tool-file"]');
    expect(fileRow).not.toBeNull();
    fireEvent.contextMenu(fileRow as Element);
    const item = await screen.findByText('workbench.commitTool.menu.showDiff');
    expect(item).toBeTruthy();
  });

  it('every row state carries a menu — nested tracked, root tracked, and unversioned alike', async () => {
    const h = handlers();
    renderTree(
      [
        row({ path: 'rules/block-r01/rule.yaml' }),
        row({ path: 'workspace.yaml', status: 'D' }),
        row({ path: 'notes/new.yaml', status: '?', unversioned: true }),
      ],
      h,
    );
    const rows = [...document.querySelectorAll('[data-testid="commit-tool-file"]')];
    expect(rows).toHaveLength(3);
    for (const fileRow of rows) {
      fireEvent.contextMenu(fileRow);
      // Every variant carries Commit File… at the top.
      const items = await screen.findAllByText('workbench.commitTool.menu.commitFile');
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it('right-click on an ignored row opens the Stop Ignoring variant, gated on removable', async () => {
    const h = handlers();
    renderTree(
      [
        row({
          path: 'notes/scratch.yaml',
          status: '!',
          ignored: true,
          ignoreSource: { kind: 'gitignore', source: '.gitignore', pattern: '/notes/scratch.yaml', removable: true },
        }),
      ],
      h,
    );
    const fileRow = document.querySelector('[data-testid="commit-tool-file"]');
    expect(fileRow).not.toBeNull();
    fireEvent.contextMenu(fileRow as Element);
    const item = await screen.findByText('workbench.commitTool.menu.stopIgnoring');
    fireEvent.click(item);
    expect(h.onUnignorePath).toHaveBeenCalledWith('notes/scratch.yaml', 'gitignore');
  });
});

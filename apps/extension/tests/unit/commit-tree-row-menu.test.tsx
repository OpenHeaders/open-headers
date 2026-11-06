// @vitest-environment jsdom
/**
 * Commit tree row context menus — mounted pin: right-click on a file
 * row opens the antd Dropdown (the S23 live regression surface). Runs
 * against the real CommitChangesTree + menu builders, with the tri-arm
 * menu contract: tracked rows get the changelist variant, unversioned
 * rows the gitignore submenu, ignored rows the Stop Ignoring variant.
 * Directory nodes and group headers carry the menu too (the S29 live
 * find): the commit verb reads Commit Directory… / Commit… and checks
 * exactly the subtree's paths.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import CommitChangesTree from '@openheaders/ui/workbench/components/panels/git/commit/CommitChangesTree';
import {
  EMPTY_CHECKED_STATE,
  splitChangeGroups,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-model';
import {
  buildCommitRowMenu,
  buildIgnoredRowMenu,
  type CommitRowMenuHandlers,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-row-menu';
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
  const scope = globalThis as unknown as {
    ResizeObserver?: typeof ResizeObserver;
    CSS?: { escape(v: string): string };
  };
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
    onCommitPaths: vi.fn(),
    onShowDiff: vi.fn(),
    onRefresh: vi.fn(),
    onPush: vi.fn(),
    onPull: vi.fn(),
    onFetch: vi.fn(),
    onCompareWithBranch: vi.fn(),
    onBranches: vi.fn(),
    onNewBranch: vi.fn(),
    onManageRemotes: vi.fn(),
    onIgnorePaths: vi.fn(),
    onAddToVcs: vi.fn(),
    onRollbackPaths: vi.fn(),
    onDeletePaths: vi.fn(),
    onUnignorePath: vi.fn(),
  };
}

/** Whether antd renders the last visible menu item carrying `label` disabled. */
async function menuItemDisabled(label: string): Promise<boolean> {
  const item = (await screen.findAllByText(label)).at(-1) as Element;
  return item.closest('li')?.classList.contains('ant-dropdown-menu-item-disabled') === true;
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
        rowMenu={(target) =>
          target.kind === 'file' && target.row.ignored
            ? buildIgnoredRowMenu(target.row, t, h)
            : buildCommitRowMenu(target, t, h)
        }
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

  it('a multi-row selection reads Commit Files… over the union; Show Diff stays out; all-unversioned takes that variant', async () => {
    const h = handlers();
    renderTree(
      [
        row({ path: 'workspace.yaml' }),
        row({ path: 'rules/a.yaml' }),
        row({ path: 'notes/new.yaml', status: '?', unversioned: true }),
        row({ path: 'notes/draft.yaml', status: '?', unversioned: true }),
      ],
      h,
    );
    const rows = [...document.querySelectorAll('[data-testid="commit-tool-file"]')];
    expect(rows).toHaveLength(4);
    const byPath = (path: string) => rows.find((el) => el.getAttribute('data-path') === path) as Element;
    // ⌘-click two tracked rows, right-click inside the selection.
    fireEvent.click(byPath('workspace.yaml'));
    fireEvent.click(byPath('rules/a.yaml'), { metaKey: true });
    expect(document.querySelectorAll('[data-testid="commit-tool-file"].selected')).toHaveLength(2);
    fireEvent.contextMenu(byPath('rules/a.yaml'));
    const commitFiles = await screen.findAllByText('workbench.commitTool.menu.commitFiles');
    fireEvent.click(commitFiles[0]);
    expect(h.onCommitPaths).toHaveBeenCalledWith(['workspace.yaml', 'rules/a.yaml']);
    // Right-click outside the selection collapses it onto that row.
    fireEvent.contextMenu(byPath('notes/new.yaml'));
    expect(document.querySelectorAll('[data-testid="commit-tool-file"].selected')).toHaveLength(1);
    // Shift-click ranges over both unversioned rows: the gitignore
    // variant, and Add to .gitignore ▸ covers the whole selection.
    fireEvent.click(byPath('notes/new.yaml'));
    fireEvent.click(byPath('notes/draft.yaml'), { shiftKey: true });
    fireEvent.contextMenu(byPath('notes/draft.yaml'));
    // antd keeps a closed dropdown's popup in the DOM — the newest one is this menu's.
    const addIgnore = (await screen.findAllByText('workbench.commitTool.menu.addToGitignore')).at(-1) as Element;
    fireEvent.mouseEnter(addIgnore);
    const exclude = await screen.findByText('workbench.commitTool.menu.excludeFile');
    fireEvent.click(exclude);
    expect(h.onIgnorePaths).toHaveBeenCalledWith(['notes/new.yaml', 'notes/draft.yaml'], 'exclude');
  });

  it('Add to VCS and Delete… ride the selection: both over an unversioned union, Add to VCS grey on a tracked row', async () => {
    const h = handlers();
    renderTree(
      [
        row({ path: 'workspace.yaml' }),
        row({ path: 'notes/new.yaml', status: '?', unversioned: true }),
        row({ path: 'notes/draft.yaml', status: '?', unversioned: true }),
      ],
      h,
    );
    const rows = [...document.querySelectorAll('[data-testid="commit-tool-file"]')];
    const byPath = (path: string) => rows.find((el) => el.getAttribute('data-path') === path) as Element;
    fireEvent.click(byPath('notes/new.yaml'));
    fireEvent.click(byPath('notes/draft.yaml'), { shiftKey: true });
    fireEvent.contextMenu(byPath('notes/draft.yaml'));
    fireEvent.click((await screen.findAllByText('workbench.commitTool.menu.addToVcs')).at(-1) as Element);
    expect(h.onAddToVcs).toHaveBeenCalledWith(['notes/new.yaml', 'notes/draft.yaml']);
    fireEvent.contextMenu(byPath('notes/draft.yaml'));
    fireEvent.click((await screen.findAllByText('workbench.commitTool.menu.delete')).at(-1) as Element);
    expect(h.onDeletePaths).toHaveBeenCalledWith(['notes/new.yaml', 'notes/draft.yaml']);
    // A tracked row: Delete… lives, Add to VCS is visible-disabled.
    fireEvent.contextMenu(byPath('workspace.yaml'));
    const addVcs = (await screen.findAllByText('workbench.commitTool.menu.addToVcs')).at(-1) as Element;
    expect(addVcs.closest('li')?.classList.contains('ant-dropdown-menu-item-disabled')).toBe(true);
    fireEvent.click((await screen.findAllByText('workbench.commitTool.menu.delete')).at(-1) as Element);
    expect(h.onDeletePaths).toHaveBeenLastCalledWith(['workspace.yaml']);
  });

  it('Rollback… lives over added rows only — one, a union of added rows — and stays grey on a modified, unversioned or mixed target', async () => {
    const h = handlers();
    renderTree(
      [
        row({ path: 'workspace.yaml' }),
        row({ path: 'notes/a.md', status: 'A' }),
        row({ path: 'notes/b.md', status: 'A' }),
        row({ path: 'scratch.md', status: '?', unversioned: true }),
      ],
      h,
    );
    const rows = [...document.querySelectorAll('[data-testid="commit-tool-file"]')];
    const byPath = (path: string) => rows.find((el) => el.getAttribute('data-path') === path) as Element;
    fireEvent.contextMenu(byPath('notes/a.md'));
    expect(await menuItemDisabled('workbench.commitTool.rollback')).toBe(false);
    fireEvent.click((await screen.findAllByText('workbench.commitTool.rollback')).at(-1) as Element);
    expect(h.onRollbackPaths).toHaveBeenCalledWith(['notes/a.md']);

    fireEvent.click(byPath('notes/a.md'));
    fireEvent.click(byPath('notes/b.md'), { shiftKey: true });
    fireEvent.contextMenu(byPath('notes/b.md'));
    fireEvent.click((await screen.findAllByText('workbench.commitTool.rollback')).at(-1) as Element);
    expect(h.onRollbackPaths).toHaveBeenLastCalledWith(['notes/a.md', 'notes/b.md']);

    fireEvent.contextMenu(byPath('workspace.yaml'));
    expect(await menuItemDisabled('workbench.commitTool.rollback')).toBe(true);
    fireEvent.contextMenu(byPath('scratch.md'));
    expect(await menuItemDisabled('workbench.commitTool.rollback')).toBe(true);
    fireEvent.click(byPath('workspace.yaml'));
    fireEvent.click(byPath('notes/a.md'), { metaKey: true });
    fireEvent.contextMenu(byPath('notes/a.md'));
    expect(await menuItemDisabled('workbench.commitTool.rollback')).toBe(true);
  });

  it('a directory node carries the menu — Commit Directory… checks exactly its subtree', async () => {
    const h = handlers();
    renderTree([row({ path: 'rules/block-r01/rule.yaml' }), row({ path: 'rules/block-r02/rule.yaml' })], h);
    const dirRow = document.querySelector('[data-testid="commit-tool-dir"][data-key="rules"]');
    expect(dirRow).not.toBeNull();
    fireEvent.contextMenu(dirRow as Element);
    const item = await screen.findByText('workbench.commitTool.menu.commitDirectory');
    fireEvent.click(item);
    expect(h.onCommitPaths).toHaveBeenCalledWith(['rules/block-r01/rule.yaml', 'rules/block-r02/rule.yaml']);
    // Show Diff is one file's read — visible-disabled off a file.
    const diff = screen.getAllByText('workbench.commitTool.menu.showDiff')[0];
    expect(diff.closest('.ant-dropdown-menu-item-disabled')).not.toBeNull();
  });

  it('a group header carries the menu — Commit… checks the whole group', async () => {
    const h = handlers();
    renderTree([row({ path: 'workspace.yaml' }), row({ path: 'notes/new.yaml', status: '?', unversioned: true })], h);
    const header = document.querySelector('[data-testid="commit-tool-group-unversioned"]');
    expect(header).not.toBeNull();
    fireEvent.contextMenu(header as Element);
    const item = await screen.findByText('workbench.commitTool.menu.commit');
    fireEvent.click(item);
    expect(h.onCommitPaths).toHaveBeenCalledWith(['notes/new.yaml']);
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

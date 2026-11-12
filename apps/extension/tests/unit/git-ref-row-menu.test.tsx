// @vitest-environment jsdom
/**
 * Ref rail row context menu + the log's changed-file row menu —
 * builder contracts (which verbs are live per row kind and current
 * branch) and the mounted pin that a right-click on a RefTree row
 * opens the antd Dropdown with Checkout dispatching the row's name.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import { buildFileRowMenu } from '@openheaders/ui/workbench/components/panels/git/file-row-menu';
import RefTree from '@openheaders/ui/workbench/components/panels/git/rail/RefTree';
import {
  buildRefRowMenu,
  buildRemoteGroupMenu,
  type RefRowMenuHandlers,
} from '@openheaders/ui/workbench/components/panels/git/rail/ref-row-menu';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp, type MenuProps } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

const t: Translate = (key: string) => key;

function handlers(): RefRowMenuHandlers {
  return {
    onCheckout: vi.fn(),
    onCheckoutRemote: vi.fn(),
    onNewBranchFrom: vi.fn(),
    onCompareWithCurrent: vi.fn(),
    onMergeIntoCurrent: vi.fn(),
    onUpdate: vi.fn(),
    onPullCurrent: vi.fn(),
    onPushCurrent: vi.fn(),
    onDelete: vi.fn(),
  };
}

type Item = { key?: string | number | null; disabled?: boolean } | null;

function keysOf(menu: MenuProps): string[] {
  return (menu.items ?? [])
    .filter((item): item is Item & { key: string } => item !== null && typeof item.key === 'string')
    .map((item) => item.key);
}

function disabledKeys(menu: MenuProps): string[] {
  return (menu.items ?? [])
    .filter((item): item is Item & { key: string } => item !== null && typeof item.key === 'string')
    .filter((item) => (item as { disabled?: boolean }).disabled === true)
    .map((item) => item.key);
}

function clickKey(menu: MenuProps, key: string): void {
  const item = (menu.items ?? []).find((entry) => entry !== null && entry.key === key) as { onClick?: () => void };
  item.onClick?.();
}

describe('buildRefRowMenu anatomy (the reference popup, plan-adapted)', () => {
  const ctx = { current: 'main', historyRewritten: false };

  it('a non-current local branch: checkout, fork, compare, merge, update and delete live; diff / push / rename visible-disabled', () => {
    const menu = buildRefRowMenu({ name: 'feature', kind: 'local' }, ctx, t, handlers());
    expect(keysOf(menu)).toEqual([
      'checkout',
      'new-branch',
      'compare',
      'diff-working-tree',
      'merge',
      'update',
      'push',
      'rename',
      'delete',
    ]);
    expect(disabledKeys(menu).sort()).toEqual(['diff-working-tree', 'push', 'rename']);
  });

  it('no rebase or worktree entries anywhere — the engine never rewrites history', () => {
    for (const row of [
      { name: 'feature', kind: 'local' as const },
      { name: 'main', kind: 'local' as const },
      { name: 'origin/feature', kind: 'remote' as const },
      { name: 'v1', kind: 'tag' as const },
    ]) {
      const keys = keysOf(buildRefRowMenu(row, ctx, t, handlers()));
      expect(keys.some((key) => key.includes('rebase') || key.includes('worktree'))).toBe(false);
    }
  });

  it('the checked-out branch: new branch, update (the pull) and push live; no checkout, merge or delete', () => {
    const h = handlers();
    const menu = buildRefRowMenu({ name: 'main', kind: 'local' }, ctx, t, h);
    expect(keysOf(menu)).toEqual(['new-branch', 'diff-working-tree', 'update', 'push', 'rename']);
    expect(disabledKeys(menu).sort()).toEqual(['diff-working-tree', 'rename']);
    clickKey(menu, 'update');
    expect(h.onPullCurrent).toHaveBeenCalledTimes(1);
    expect(h.onUpdate).not.toHaveBeenCalled();
    clickKey(menu, 'push');
    expect(h.onPushCurrent).toHaveBeenCalledTimes(1);
  });

  it('a remote-tracking ref checks out through the tracking path, forks, compares and merges; delete is disabled', () => {
    const h = handlers();
    const menu = buildRefRowMenu({ name: 'origin/feature', kind: 'remote' }, ctx, t, h);
    expect(keysOf(menu)).toEqual(['checkout', 'new-branch', 'compare', 'diff-working-tree', 'merge', 'delete']);
    expect(disabledKeys(menu).sort()).toEqual(['delete', 'diff-working-tree']);
    clickKey(menu, 'checkout');
    expect(h.onCheckoutRemote).toHaveBeenCalledWith('origin/feature');
    expect(h.onCheckout).not.toHaveBeenCalled();
  });

  it('a tag only forks and compares', () => {
    const menu = buildRefRowMenu({ name: 'v1', kind: 'tag' }, ctx, t, handlers());
    expect(disabledKeys(menu).sort()).toEqual(['checkout', 'delete', 'diff-working-tree', 'merge']);
  });

  it('merge holds while a remote history rewrite is pending and on a detached HEAD', () => {
    const rewritten = buildRefRowMenu(
      { name: 'feature', kind: 'local' },
      { current: 'main', historyRewritten: true },
      t,
      handlers(),
    );
    expect(disabledKeys(rewritten)).toContain('merge');
    const detached = buildRefRowMenu(
      { name: 'feature', kind: 'local' },
      { current: null, historyRewritten: false },
      t,
      handlers(),
    );
    expect(disabledKeys(detached)).toContain('merge');
    expect(disabledKeys(detached)).not.toContain('checkout');
  });

  it('a live verb dispatches the row name', () => {
    const h = handlers();
    const menu = buildRefRowMenu({ name: 'feature', kind: 'local' }, ctx, t, h);
    clickKey(menu, 'merge');
    expect(h.onMergeIntoCurrent).toHaveBeenCalledWith('feature');
    clickKey(menu, 'update');
    expect(h.onUpdate).toHaveBeenCalledWith('feature');
    clickKey(menu, 'delete');
    expect(h.onDelete).toHaveBeenCalledWith('feature');
  });
});

describe('buildFileRowMenu', () => {
  it('Show Diff and Show History are live; the placeholder entries are visible-disabled', () => {
    const onShowDiff = vi.fn();
    const onShowHistory = vi.fn();
    const menu = buildFileRowMenu(t, { onShowDiff, onShowHistory });
    expect(disabledKeys(menu).sort()).toEqual(['current-revision', 'jump-to-source']);
    const history = (menu.items ?? []).find((item) => item !== null && item.key === 'show-history') as {
      onClick?: () => void;
    };
    history.onClick?.();
    expect(onShowHistory).toHaveBeenCalledTimes(1);
  });

  it('a row with no file of its own holds the two file verbs and keeps Jump to Source', () => {
    const onJumpToSource = vi.fn();
    const menu = buildFileRowMenu(t, { onJumpToSource });
    expect(disabledKeys(menu).sort()).toEqual(['current-revision', 'show-diff', 'show-history']);
    const jump = (menu.items ?? []).find((item) => item !== null && item.key === 'jump-to-source') as {
      onClick?: () => void;
    };
    jump.onClick?.();
    expect(onJumpToSource).toHaveBeenCalledTimes(1);
  });
});

const refs: WorkspaceTreeRefWire[] = [
  { name: 'main', kind: 'local', sha: 'a'.repeat(40) },
  { name: 'feature', kind: 'local', sha: 'b'.repeat(40) },
];

describe('RefTree row context menu (mounted)', () => {
  it('right-click selects the row and opens the menu; Checkout dispatches the branch', async () => {
    const h = handlers();
    const onLeafContextMenu = vi.fn();
    render(
      <AntApp>
        <RefTree
          refs={refs}
          currentRef="main"
          unbornBranch={null}
          detachedSha={null}
          selected={null}
          favorites={new Set()}
          groupByDirectory
          showTags
          onLeafClick={() => undefined}
          onHeadClick={() => undefined}
          onLeafContextMenu={onLeafContextMenu}
          rowMenu={(node) => buildRefRowMenu(node, { current: 'main', historyRewritten: false }, t, h)}
        />
      </AntApp>,
    );
    const row = document.querySelector('[data-testid="git-tool-ref-row"][data-ref="feature"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);
    expect(onLeafContextMenu).toHaveBeenCalledWith({ name: 'feature', kind: 'local' });
    const checkout = await screen.findByTestId('git-tool-ref-menu-checkout');
    fireEvent.click(checkout);
    expect(h.onCheckout).toHaveBeenCalledWith('feature');
  });
});

describe('Remote group header menu (S41)', () => {
  it('buildRemoteGroupMenu carries one live verb that opens the Git Remotes dialog', () => {
    const onManageRemotes = vi.fn();
    const menu = buildRemoteGroupMenu(t, onManageRemotes);
    expect(keysOf(menu)).toEqual(['manage-remotes']);
    expect(disabledKeys(menu)).toEqual([]);
    const item = (menu.items ?? [])[0] as { onClick?: () => void };
    item.onClick?.();
    expect(onManageRemotes).toHaveBeenCalledTimes(1);
  });

  it('right-click on the Remote group header opens it; the Local header stays plain', async () => {
    const h = handlers();
    const onManageRemotes = vi.fn();
    render(
      <AntApp>
        <RefTree
          refs={[...refs, { name: 'origin/main', kind: 'remote', sha: 'c'.repeat(40) }]}
          currentRef="main"
          unbornBranch={null}
          detachedSha={null}
          selected={null}
          favorites={new Set()}
          groupByDirectory
          showTags
          onLeafClick={() => undefined}
          onHeadClick={() => undefined}
          onLeafContextMenu={() => undefined}
          rowMenu={(node) => buildRefRowMenu(node, { current: 'main', historyRewritten: false }, t, h)}
          groupMenu={(kind) => (kind === 'remote' ? buildRemoteGroupMenu(t, onManageRemotes) : null)}
        />
      </AntApp>,
    );
    const remoteHeader = document.querySelector(
      '[data-testid="git-tool-ref-group"][data-kind="remote"] [data-testid="git-tool-ref-group-header"]',
    );
    expect(remoteHeader).not.toBeNull();
    fireEvent.contextMenu(remoteHeader as Element);
    fireEvent.click(await screen.findByTestId('git-tool-ref-menu-manage-remotes'));
    expect(onManageRemotes).toHaveBeenCalledTimes(1);
    const localHeader = document.querySelector(
      '[data-testid="git-tool-ref-group"][data-kind="local"] [data-testid="git-tool-ref-group-header"]',
    );
    expect(localHeader?.closest('.ant-dropdown-trigger')).toBeNull();
  });
});

describe('FileTreeView row context menu (mounted)', () => {
  it('right-click selects the file row and opens the menu; Show History dispatches the path', async () => {
    const onSelectFile = vi.fn();
    const onShowHistory = vi.fn();
    render(
      <AntApp>
        <FileTreeView
          files={[{ path: 'rules/r1.yaml', status: 'M' }]}
          loadingPath={null}
          onOpenFile={() => undefined}
          selectedPath={null}
          onSelectFile={onSelectFile}
          rowMenu={(path) =>
            buildFileRowMenu(t, { onShowDiff: () => undefined, onShowHistory: () => onShowHistory(path) })
          }
        />
      </AntApp>,
    );
    const row = document.querySelector('[data-testid="git-tool-file"][data-path="rules/r1.yaml"]');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);
    expect(onSelectFile).toHaveBeenCalledWith('rules/r1.yaml');
    const history = await screen.findByTestId('git-tool-file-menu-history');
    fireEvent.click(history);
    expect(onShowHistory).toHaveBeenCalledWith('rules/r1.yaml');
  });
});

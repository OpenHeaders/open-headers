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
    onNewBranchFrom: vi.fn(),
    onCompareWithCurrent: vi.fn(),
    onMergeIntoCurrent: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  };
}

type Item = { key?: string | number | null; disabled?: boolean } | null;

function disabledKeys(menu: MenuProps): string[] {
  return (menu.items ?? [])
    .filter((item): item is Item & { key: string } => item !== null && typeof item.key === 'string')
    .filter((item) => (item as { disabled?: boolean }).disabled === true)
    .map((item) => item.key);
}

const IDE_ONLY = ['checkout-rebase', 'diff-working-tree', 'rebase-onto', 'push', 'rename'];

describe('buildRefRowMenu enablement', () => {
  it('a non-current local branch carries every live verb', () => {
    const menu = buildRefRowMenu(
      { name: 'feature', kind: 'local' },
      { current: 'main', historyRewritten: false },
      t,
      handlers(),
    );
    expect(disabledKeys(menu).sort()).toEqual([...IDE_ONLY].sort());
  });

  it('the checked-out branch can be neither checked out, merged, compared, updated nor deleted', () => {
    const menu = buildRefRowMenu(
      { name: 'main', kind: 'local' },
      { current: 'main', historyRewritten: false },
      t,
      handlers(),
    );
    expect(disabledKeys(menu).sort()).toEqual([...IDE_ONLY, 'checkout', 'merge', 'compare', 'update', 'delete'].sort());
  });

  it('a remote-tracking ref merges and forks but never checks out, updates or deletes', () => {
    const menu = buildRefRowMenu(
      { name: 'origin/feature', kind: 'remote' },
      { current: 'main', historyRewritten: false },
      t,
      handlers(),
    );
    expect(disabledKeys(menu).sort()).toEqual([...IDE_ONLY, 'checkout', 'update', 'delete'].sort());
  });

  it('a tag only forks and compares', () => {
    const menu = buildRefRowMenu(
      { name: 'v1', kind: 'tag' },
      { current: 'main', historyRewritten: false },
      t,
      handlers(),
    );
    expect(disabledKeys(menu).sort()).toEqual([...IDE_ONLY, 'checkout', 'merge', 'update', 'delete'].sort());
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
    const menu = buildRefRowMenu(
      { name: 'feature', kind: 'local' },
      { current: 'main', historyRewritten: false },
      t,
      h,
    );
    const merge = (menu.items ?? []).find((item) => item !== null && item.key === 'merge') as {
      onClick?: () => void;
    };
    merge.onClick?.();
    expect(h.onMergeIntoCurrent).toHaveBeenCalledWith('feature');
  });
});

describe('buildFileRowMenu', () => {
  it('Show Diff and Show History are live; the IDE-only entries are visible-disabled', () => {
    const onShowDiff = vi.fn();
    const onShowHistory = vi.fn();
    const menu = buildFileRowMenu('rules/r1.yaml', t, { onShowDiff, onShowHistory });
    expect(disabledKeys(menu).sort()).toEqual(['current-revision', 'jump-to-source']);
    const history = (menu.items ?? []).find((item) => item !== null && item.key === 'show-history') as {
      onClick?: () => void;
    };
    history.onClick?.();
    expect(onShowHistory).toHaveBeenCalledWith('rules/r1.yaml');
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
          rowMenu={(path) => buildFileRowMenu(path, t, { onShowDiff: () => undefined, onShowHistory })}
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

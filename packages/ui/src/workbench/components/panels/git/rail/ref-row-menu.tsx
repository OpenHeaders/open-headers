/**
 * ref-row-menu — the ONE branch/tag row menu, shared by the Git
 * window's ref rail and the top bar's branch widget. The anatomy
 * follows the plan's §12 non-goals: no rebase, no
 * worktree, no tag checkout entries — the engine never rewrites
 * history, so they could never go live. Per row kind:
 *
 * - a local branch: Checkout, New Branch from…, Compare with Current,
 *   Show Diff with Working Tree, Merge into Current, Update (the
 *   non-current fast-forward), Push…, Rename…, Delete;
 * - the checked-out branch: New Branch from…, Show Diff with Working
 *   Tree, Update (= Update Project, the pull), Push…, Rename…;
 * - a remote-tracking ref: Checkout (its local branch, created
 *   tracking when absent), New Branch from…, Compare, Show Diff,
 *   Merge into Current, Delete;
 * - a tag: Checkout, New Branch from…, Compare, Show Diff, Merge,
 *   Delete.
 *
 * Verbs with machinery are live; the rest (Show Diff with Working
 * Tree, Rename…, a non-current Push…, remote/tag Delete, tag
 * Checkout/Merge) render visible-disabled. Merge holds while a remote
 * history rewrite is pending and on a detached HEAD. Pure over
 * (row, context, t, handlers).
 */

import {
  BranchesOutlined,
  DeleteOutlined,
  EditOutlined,
  ForkOutlined,
  PlusOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { MenuProps } from 'antd';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { PullIcon, PushIcon } from '@openheaders/ui/shared/icons';
import { menuLabel } from '../git-menu-label';

/** One selectable ref row — the menu's and the activity bar's target. */
export interface RefTreeSelection {
  name: string;
  kind: WorkspaceTreeRefWire['kind'];
}

export interface RefRowMenuContext {
  /** The checked-out branch; null on a detached or unborn HEAD. */
  current: string | null;
  /** A remote history rewrite is pending (§16) — merge holds until it resolves. */
  historyRewritten: boolean;
}

export interface RefRowMenuHandlers {
  onCheckout: (branch: string) => void;
  /** A remote-tracking row's checkout — its local branch, created tracking when absent. */
  onCheckoutRemote: (ref: string) => void;
  onNewBranchFrom: (ref: string) => void;
  onCompareWithCurrent: (ref: string) => void;
  onMergeIntoCurrent: (ref: string) => void;
  /** Fast-forward a NON-current local branch from its upstream. */
  onUpdate: (branch: string) => void;
  /** The current branch's update — the pull. */
  onPullCurrent: () => void;
  onPushCurrent: () => void;
  onDelete: (branch: string) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;
type MenuItem = MenuItems[number];

interface VerbItem {
  key: string;
  label: React.ReactNode;
}

/** A verb row: live with its handler, or visible-disabled. */
function live(item: VerbItem, enabled: boolean, onClick: () => void): MenuItem {
  return enabled ? { ...item, onClick } : { ...item, disabled: true };
}

export function buildRefRowMenu(
  row: RefTreeSelection,
  ctx: RefRowMenuContext,
  t: Translate,
  h: RefRowMenuHandlers,
): MenuProps {
  const isCurrent = row.kind === 'local' && row.name === ctx.current;
  const currentLabel = ctx.current ?? 'HEAD';
  const canMerge = row.kind !== 'tag' && ctx.current !== null && !ctx.historyRewritten;

  const newBranch: MenuItem = {
    key: 'new-branch',
    label: menuLabel(
      <PlusOutlined />,
      t('workbench.gitLog.refMenu.newBranchFrom', { name: row.name }),
      undefined,
      'git-tool-ref-menu-new-branch',
    ),
    onClick: () => h.onNewBranchFrom(row.name),
  };
  const diffWorkingTree: MenuItem = {
    key: 'diff-working-tree',
    label: menuLabel(null, t('workbench.gitLog.refMenu.showDiffWithWorkingTree')),
    disabled: true,
  };
  const rename: MenuItem = {
    key: 'rename',
    label: menuLabel(<EditOutlined />, t('workbench.gitLog.refMenu.rename'), 'F2'),
    disabled: true,
  };

  if (isCurrent) {
    const items: MenuItems = [
      newBranch,
      diffWorkingTree,
      { type: 'divider' },
      {
        key: 'update',
        label: menuLabel(
          <PullIcon />,
          t('workbench.gitLog.refMenu.update'),
          undefined,
          'git-tool-ref-menu-update',
        ),
        onClick: () => h.onPullCurrent(),
      },
      {
        key: 'push',
        label: menuLabel(<PushIcon />, t('workbench.gitLog.refMenu.push'), '⇧⌘K', 'git-tool-ref-menu-push'),
        onClick: () => h.onPushCurrent(),
      },
      { type: 'divider' },
      rename,
    ];
    return { items, selectable: false };
  }

  const checkoutItem = {
    key: 'checkout',
    label: menuLabel(<SwapOutlined />, t('workbench.gitLog.refMenu.checkout'), undefined, 'git-tool-ref-menu-checkout'),
  };
  const checkout: MenuItem =
    row.kind === 'local'
      ? live(checkoutItem, true, () => h.onCheckout(row.name))
      : row.kind === 'remote'
        ? live(checkoutItem, true, () => h.onCheckoutRemote(row.name))
        : live(checkoutItem, false, () => undefined);

  const compare: MenuItem = {
    key: 'compare',
    label: menuLabel(
      <BranchesOutlined />,
      t('workbench.gitLog.refMenu.compareWithCurrent'),
      undefined,
      'git-tool-ref-menu-compare',
    ),
    onClick: () => h.onCompareWithCurrent(row.name),
  };

  const merge: MenuItem = live(
    {
      key: 'merge',
      label: menuLabel(
        <ForkOutlined />,
        t('workbench.gitLog.refMenu.mergeIntoCurrent', { name: row.name, current: currentLabel }),
        undefined,
        'git-tool-ref-menu-merge',
      ),
    },
    canMerge,
    () => h.onMergeIntoCurrent(row.name),
  );

  const del: MenuItem = live(
    {
      key: 'delete',
      label: menuLabel(<DeleteOutlined />, t('workbench.gitLog.refMenu.delete'), undefined, 'git-tool-ref-menu-delete'),
    },
    row.kind === 'local',
    () => h.onDelete(row.name),
  );

  if (row.kind === 'local') {
    const items: MenuItems = [
      checkout,
      newBranch,
      { type: 'divider' },
      compare,
      diffWorkingTree,
      { type: 'divider' },
      merge,
      { type: 'divider' },
      {
        key: 'update',
        label: menuLabel(
          <PullIcon />,
          t('workbench.gitLog.refMenu.update'),
          undefined,
          'git-tool-ref-menu-update',
        ),
        onClick: () => h.onUpdate(row.name),
      },
      {
        key: 'push',
        label: menuLabel(<PushIcon />, t('workbench.gitLog.refMenu.push'), '⇧⌘K'),
        disabled: true,
      },
      { type: 'divider' },
      rename,
      del,
    ];
    return { items, selectable: false };
  }

  const items: MenuItems = [
    checkout,
    newBranch,
    { type: 'divider' },
    compare,
    diffWorkingTree,
    { type: 'divider' },
    merge,
    { type: 'divider' },
    del,
  ];
  return { items, selectable: false };
}

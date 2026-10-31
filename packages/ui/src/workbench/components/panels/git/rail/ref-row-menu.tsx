/**
 * ref-row-menu — the ref rail's right-click menu on a branch or tag
 * row (IDE reference: the log's Branches pane): Checkout, New Branch
 * from…, Checkout and Rebase onto, Compare with Current, Show Diff with
 * Working Tree, Rebase Current onto, Merge into Current, Update, Push…,
 * Rename…, Delete. Verbs with machinery are live (checkout = the
 * wrapped switch with the §6.2 dirty prompt; merge = the Phase 4
 * machinery on a local or remote-tracking ref; new branch / compare /
 * update / delete mirror the activity bar); IDE-only constructs render
 * visible-disabled. Enablement follows the IDE: the checked-out row
 * can be neither checked out, merged, updated nor deleted; a remote
 * row merges and forks but never checks out; a tag only forks and
 * compares. Pure over (row, context, t, handlers).
 */

import {
  BranchesOutlined,
  DeleteOutlined,
  EditOutlined,
  ForkOutlined,
  PlusOutlined,
  RiseOutlined,
  SwapOutlined,
  VerticalAlignBottomOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { menuLabel } from '../git-menu-label';
import type { RefTreeSelection } from './RefTree';

export interface RefRowMenuContext {
  /** The checked-out branch; null on a detached or unborn HEAD. */
  current: string | null;
  /** A remote history rewrite is pending (§16) — merge holds until it resolves. */
  historyRewritten: boolean;
}

export interface RefRowMenuHandlers {
  onCheckout: (branch: string) => void;
  onNewBranchFrom: (ref: string) => void;
  onCompareWithCurrent: (ref: string) => void;
  onMergeIntoCurrent: (ref: string) => void;
  onUpdate: (branch: string) => void;
  onDelete: (branch: string) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

export function buildRefRowMenu(
  row: RefTreeSelection,
  ctx: RefRowMenuContext,
  t: Translate,
  h: RefRowMenuHandlers,
): MenuProps {
  const isCurrent = row.kind === 'local' && row.name === ctx.current;
  const local = row.kind === 'local';
  const branchLike = row.kind !== 'tag';
  const currentLabel = ctx.current ?? 'HEAD';
  const canCheckout = local && !isCurrent;
  const canMerge = branchLike && !isCurrent && ctx.current !== null && !ctx.historyRewritten;
  const canUpdate = local && !isCurrent;
  const canDelete = local && !isCurrent;
  const canCompare = !isCurrent;
  const items: MenuItems = [
    {
      key: 'checkout',
      label: menuLabel(<SwapOutlined />, t('workbench.gitLog.refMenu.checkout'), undefined, 'git-tool-ref-menu-checkout'),
      disabled: !canCheckout,
      ...(canCheckout ? { onClick: () => h.onCheckout(row.name) } : {}),
    },
    {
      key: 'new-branch',
      label: menuLabel(
        <PlusOutlined />,
        t('workbench.gitLog.refMenu.newBranchFrom', { name: row.name }),
        undefined,
        'git-tool-ref-menu-new-branch',
      ),
      onClick: () => h.onNewBranchFrom(row.name),
    },
    {
      key: 'checkout-rebase',
      label: menuLabel(null, t('workbench.gitLog.refMenu.checkoutAndRebase', { current: currentLabel })),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'compare',
      label: menuLabel(
        <BranchesOutlined />,
        t('workbench.gitLog.refMenu.compareWithCurrent'),
        undefined,
        'git-tool-ref-menu-compare',
      ),
      disabled: !canCompare,
      ...(canCompare ? { onClick: () => h.onCompareWithCurrent(row.name) } : {}),
    },
    {
      key: 'diff-working-tree',
      label: menuLabel(null, t('workbench.gitLog.refMenu.showDiffWithWorkingTree')),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'rebase-onto',
      label: menuLabel(null, t('workbench.gitLog.refMenu.rebaseCurrentOnto', { name: row.name })),
      disabled: true,
    },
    {
      key: 'merge',
      label: menuLabel(
        <ForkOutlined />,
        t('workbench.gitLog.refMenu.mergeIntoCurrent', { name: row.name, current: currentLabel }),
        undefined,
        'git-tool-ref-menu-merge',
      ),
      disabled: !canMerge,
      ...(canMerge ? { onClick: () => h.onMergeIntoCurrent(row.name) } : {}),
    },
    { type: 'divider' },
    {
      key: 'update',
      label: menuLabel(
        <VerticalAlignBottomOutlined />,
        t('workbench.gitLog.refMenu.update'),
        undefined,
        'git-tool-ref-menu-update',
      ),
      disabled: !canUpdate,
      ...(canUpdate ? { onClick: () => h.onUpdate(row.name) } : {}),
    },
    { key: 'push', label: menuLabel(<RiseOutlined />, t('workbench.gitLog.refMenu.push')), disabled: true },
    { type: 'divider' },
    { key: 'rename', label: menuLabel(<EditOutlined />, t('workbench.gitLog.refMenu.rename')), disabled: true },
    {
      key: 'delete',
      label: menuLabel(<DeleteOutlined />, t('workbench.gitLog.refMenu.delete'), undefined, 'git-tool-ref-menu-delete'),
      disabled: !canDelete,
      ...(canDelete ? { onClick: () => h.onDelete(row.name) } : {}),
    },
  ];
  return { items, selectable: false };
}

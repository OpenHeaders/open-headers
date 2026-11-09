/**
 * log-row-menu — the log timeline's commit row right-click menu (the
 * reference design on this product's vocabulary). A right-click on an
 * unselected row selects it alone; on a selected row the menu covers
 * the set. Live rows: Copy Revision Number (every selected sha, one
 * per line), Create Patch… and Copy as Patch to Clipboard (the set as
 * one patch text — a file, or the clipboard), New Branch… and New Tag… (the dialogs anchored at the
 * commit), Checkout Revision (a detached HEAD at the commit, through
 * the dirty prompt), Go to Child / Parent Commit (within the loaded
 * window). Rows whose verb has no machinery yet render
 * visible-disabled: Cherry-Pick, Compare with Local, Revert Commit. The reference's history-rewriting rows (reset, undo,
 * fixup, squash, drop, rebase, edit message) are DROPPED — the engine
 * never rewrites history. Pure over (target, t, handlers).
 */

import { CopyOutlined, PlusOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { DiffIcon, RollbackIcon, TagIcon } from '@openheaders/ui/shared/icons';
import { menuLabel } from './git-menu-label';
import { CherryPickIcon } from './toolbar/icons';

export interface LogRowMenuTarget {
  /** The commits the menu covers, in list order (newest first) — one, or the selection the row sits in. */
  shas: readonly string[];
  /** The row's child commit in the loaded window; null at the edge or on a multi-selection. */
  child: string | null;
  /** The row's first parent in the loaded window; null at the edge or on a multi-selection. */
  parent: string | null;
}

export interface LogRowMenuHandlers {
  onCopyRevision: (shas: readonly string[]) => void;
  onCreatePatch: (shas: readonly string[]) => void;
  onCopyAsPatch: (shas: readonly string[]) => void;
  onNewBranchFrom: (sha: string) => void;
  onNewTagAt: (sha: string) => void;
  onCheckoutRevision: (sha: string) => void;
  onNavigate: (sha: string) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;
type MenuItem = MenuItems[number];

/** A verb row: live with its handler, or visible-disabled. */
function live(item: { key: string; label: React.ReactNode }, enabled: boolean, onClick: () => void): MenuItem {
  return enabled ? { ...item, onClick } : { ...item, disabled: true };
}

export function buildLogRowMenu(target: LogRowMenuTarget, t: Translate, h: LogRowMenuHandlers): MenuProps {
  const single = target.shas.length === 1 ? target.shas[0] : null;
  const items: MenuItems = [
    {
      key: 'copy-revision',
      label: menuLabel(
        <CopyOutlined />,
        t('workbench.gitLog.commitMenu.copyRevision'),
        '⌥⇧⌘C',
        'git-tool-commit-menu-copy-revision',
      ),
      onClick: () => h.onCopyRevision(target.shas),
    },
    {
      key: 'create-patch',
      label: menuLabel(
        <DiffIcon />,
        t('workbench.gitLog.commitMenu.createPatch'),
        undefined,
        'git-tool-commit-menu-create-patch',
      ),
      onClick: () => h.onCreatePatch(target.shas),
    },
    {
      key: 'copy-as-patch',
      label: menuLabel(
        null,
        t('workbench.gitLog.commitMenu.copyAsPatch'),
        undefined,
        'git-tool-commit-menu-copy-as-patch',
      ),
      onClick: () => h.onCopyAsPatch(target.shas),
    },
    { key: 'cherry-pick', label: menuLabel(<CherryPickIcon />, t('workbench.gitLog.cherryPick')), disabled: true },
    { type: 'divider' },
    live(
      {
        key: 'checkout-revision',
        label: menuLabel(
          null,
          t('workbench.gitLog.commitMenu.checkoutRevision'),
          undefined,
          'git-tool-commit-menu-checkout-revision',
        ),
      },
      single !== null,
      () => {
        if (single !== null) h.onCheckoutRevision(single);
      },
    ),
    { key: 'compare-with-local', label: menuLabel(null, t('workbench.gitLog.commitMenu.compareWithLocal')), disabled: true },
    { type: 'divider' },
    { key: 'revert', label: menuLabel(<RollbackIcon />, t('workbench.gitLog.commitMenu.revert')), disabled: true },
    { type: 'divider' },
    live(
      {
        key: 'new-branch',
        label: menuLabel(
          <PlusOutlined />,
          t('workbench.commitTool.menu.newBranch'),
          '⌥⌘N',
          'git-tool-commit-menu-new-branch',
        ),
      },
      single !== null,
      () => {
        if (single !== null) h.onNewBranchFrom(single);
      },
    ),
    live(
      {
        key: 'new-tag',
        label: menuLabel(<TagIcon />, t('workbench.commitTool.menu.newTag'), undefined, 'git-tool-commit-menu-new-tag'),
      },
      single !== null,
      () => {
        if (single !== null) h.onNewTagAt(single);
      },
    ),
    { type: 'divider' },
    live(
      {
        key: 'go-to-child',
        label: menuLabel(null, t('workbench.gitLog.commitMenu.goToChild'), '←', 'git-tool-commit-menu-go-to-child'),
      },
      target.child !== null,
      () => {
        if (target.child !== null) h.onNavigate(target.child);
      },
    ),
    live(
      {
        key: 'go-to-parent',
        label: menuLabel(null, t('workbench.gitLog.commitMenu.goToParent'), '→', 'git-tool-commit-menu-go-to-parent'),
      },
      target.parent !== null,
      () => {
        if (target.parent !== null) h.onNavigate(target.parent);
      },
    ),
  ];
  return { items, selectable: false };
}

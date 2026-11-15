/**
 * log-row-menu — the log timeline's commit row right-click menu (the
 * reference design on this product's vocabulary). A right-click on an
 * unselected row selects it alone; on a selected row the menu covers
 * the set. Live rows: Copy Revision Number (every selected sha, one
 * per line), Create Patch… and Copy as Patch to Clipboard (the set as
 * one patch text — a file, or the clipboard), Cherry-Pick and Revert
 * Commit (the set's own changes applied to, or undone on, the current
 * branch — each as a new commit), New Branch… and New Tag… (the
 * dialogs anchored at the commit), Checkout Revision (a detached HEAD
 * at the commit, through the dirty prompt), Go to Child / Parent
 * Commit (within the list). Cherry-Pick and Revert Commit hold
 * over a set that holds a merge or the first commit — neither has one
 * change to apply. A row whose verb has no machinery
 * yet renders visible-disabled: Compare with Local. The reference's
 * history-rewriting rows (reset, undo,
 * fixup, squash, drop, rebase, edit message) are DROPPED — the engine
 * never rewrites history. Pure over (target, t, handlers).
 *
 * A list names the places its walks go by what it selects by — a
 * commit's hash, or a row's number (`Place`). A set whose commits are
 * not read — or that is past what a verb takes — covers no commit yet:
 * every verb over the commits holds.
 */

import { CopyOutlined, PlusOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { DiffIcon, RollbackIcon, TagIcon } from '@openheaders/ui/shared/icons';
import { menuLabel } from './git-menu-label';
import { CherryPickIcon } from './toolbar/icons';

export interface LogRowMenuTarget<Place = string> {
  /**
   * The commits the menu covers, in list order (newest first) — one, or
   * the selection the row sits in; null while they are not read, or are
   * more than a verb takes.
   */
  shas: readonly string[] | null;
  /** Where the row's child commit is listed; null at the edge or on a multi-selection. */
  child: Place | null;
  /** Where the row's first parent is listed; null at the edge or on a multi-selection. */
  parent: Place | null;
  /** A pick or a revert takes every commit of the set — none is a merge or the first commit. */
  applies: boolean;
}

export interface LogRowMenuHandlers<Place = string> {
  onCopyRevision: (shas: readonly string[]) => void;
  onCreatePatch: (shas: readonly string[]) => void;
  onCopyAsPatch: (shas: readonly string[]) => void;
  onCherryPick: (shas: readonly string[]) => void;
  onRevert: (shas: readonly string[]) => void;
  onNewBranchFrom: (sha: string) => void;
  onNewTagAt: (sha: string) => void;
  onCheckoutRevision: (sha: string) => void;
  onNavigate: (place: Place) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;
type MenuItem = MenuItems[number];

/** A verb row: live with its handler, or visible-disabled. */
function live(item: { key: string; label: React.ReactNode }, enabled: boolean, onClick: () => void): MenuItem {
  return enabled ? { ...item, onClick } : { ...item, disabled: true };
}

export function buildLogRowMenu<Place = string>(
  target: LogRowMenuTarget<Place>,
  t: Translate,
  h: LogRowMenuHandlers<Place>,
): MenuProps {
  const { shas } = target;
  const single = shas !== null && shas.length === 1 ? shas[0] : null;
  const items: MenuItems = [
    live(
      {
        key: 'copy-revision',
        label: menuLabel(
          <CopyOutlined />,
          t('workbench.gitLog.commitMenu.copyRevision'),
          '⌥⇧⌘C',
          'git-tool-commit-menu-copy-revision',
        ),
      },
      shas !== null,
      () => {
        if (shas !== null) h.onCopyRevision(shas);
      },
    ),
    live(
      {
        key: 'create-patch',
        label: menuLabel(
          <DiffIcon />,
          t('workbench.gitLog.commitMenu.createPatch'),
          undefined,
          'git-tool-commit-menu-create-patch',
        ),
      },
      shas !== null,
      () => {
        if (shas !== null) h.onCreatePatch(shas);
      },
    ),
    live(
      {
        key: 'copy-as-patch',
        label: menuLabel(
          null,
          t('workbench.gitLog.commitMenu.copyAsPatch'),
          undefined,
          'git-tool-commit-menu-copy-as-patch',
        ),
      },
      shas !== null,
      () => {
        if (shas !== null) h.onCopyAsPatch(shas);
      },
    ),
    live(
      {
        key: 'cherry-pick',
        label: menuLabel(
          <CherryPickIcon />,
          t('workbench.gitLog.cherryPick'),
          undefined,
          'git-tool-commit-menu-cherry-pick',
        ),
      },
      shas !== null && target.applies,
      () => {
        if (shas !== null) h.onCherryPick(shas);
      },
    ),
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
    live(
      {
        key: 'revert',
        label: menuLabel(
          <RollbackIcon />,
          t('workbench.gitLog.commitMenu.revert'),
          undefined,
          'git-tool-commit-menu-revert',
        ),
      },
      shas !== null && target.applies,
      () => {
        if (shas !== null) h.onRevert(shas);
      },
    ),
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

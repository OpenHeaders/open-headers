/**
 * commit-row-menu — the Commit tree's right-click menu (IDE reference,
 * two variants): tracked rows carry the changelist/patch/shelve block,
 * unversioned rows carry Add to .gitignore instead. S22 posture — reads
 * and gestures with existing machinery are live (Commit File…, Show
 * Diff, Refresh, and the Git ▸ verbs Push/Pull/Fetch/Compare with
 * Branch or Tag/Branches…/New Branch…); IDE-only constructs
 * (changelists, shelf, Local History) and unbuilt write verbs render
 * visible-disabled. Shortcut hints mirror the IDE anatomy; bindings
 * ride the keymap plane later.
 */

import {
  BranchesOutlined,
  ClockCircleOutlined,
  DiffOutlined,
  EditOutlined,
  ForkOutlined,
  GithubOutlined,
  PlusOutlined,
  RiseOutlined,
  StopOutlined,
  SwapOutlined,
  SyncOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
} from '@ant-design/icons';
import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { MenuProps } from 'antd';
import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export interface CommitRowMenuHandlers {
  onCommitFile: (path: string) => void;
  onShowDiff: (path: string) => void;
  onRefresh: () => void;
  onPush: () => void;
  onPull: () => void;
  onFetch: () => void;
  onCompareWithBranch: () => void;
  onBranches: () => void;
  onNewBranch: () => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

/** Icon gutter + right-aligned inert shortcut hint (the IDE anatomy). */
function menuLabel(icon: React.ReactNode | null, text: string, hint?: string): React.ReactNode {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
      <span style={{ width: 16, flex: '0 0 auto', display: 'inline-flex', justifyContent: 'center' }}>{icon}</span>
      <span style={{ flex: '1 1 auto', fontSize: 13 }}>{text}</span>
      {hint !== undefined && <span style={{ flex: '0 0 auto', fontSize: 12, opacity: 0.55 }}>{hint}</span>}
    </span>
  );
}

/** The Add to .gitignore ▸ submenu — the write verb is a future slice. */
function gitignoreSubmenu(t: Translate, keyPrefix: string): MenuItems[number] {
  return {
    key: `${keyPrefix}gitignore`,
    label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.addToGitignore')),
    children: [
      {
        key: `${keyPrefix}gitignore-file`,
        label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.addToGitignore')),
        disabled: true,
      },
      {
        key: `${keyPrefix}gitignore-exclude`,
        label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.excludeFile')),
        disabled: true,
      },
    ],
  };
}

/** The Git ▸ submenu — verbs with existing machinery are live. */
function gitSubmenu(row: WorkspaceTreeWorkingChangeWire, t: Translate, h: CommitRowMenuHandlers): MenuItems[number] {
  const unversioned = row.unversioned === true;
  return {
    key: 'git',
    label: menuLabel(null, t('workbench.commitTool.menu.git')),
    children: [
      {
        key: 'git-commit-file',
        label: menuLabel(null, t('workbench.commitTool.menu.commitFile')),
        onClick: () => h.onCommitFile(row.path),
      },
      {
        key: 'git-add',
        label: menuLabel(<PlusOutlined />, t('workbench.commitTool.menu.add'), '⌥⌘A'),
        disabled: true,
      },
      ...(unversioned ? [gitignoreSubmenu(t, 'git-')] : []),
      { type: 'divider' },
      {
        key: 'git-show-diff',
        label: menuLabel(<SwapOutlined />, t('workbench.commitTool.menu.showDiff'), '⌘D'),
        disabled: unversioned,
        ...(unversioned ? {} : { onClick: () => h.onShowDiff(row.path) }),
      },
      {
        key: 'git-compare-revision',
        label: menuLabel(null, t('workbench.commitTool.menu.compareRevision')),
        disabled: true,
      },
      {
        key: 'git-compare-branch',
        label: menuLabel(null, t('workbench.commitTool.menu.compareBranch')),
        onClick: () => h.onCompareWithBranch(),
      },
      {
        key: 'git-show-history',
        label: menuLabel(<ClockCircleOutlined />, t('workbench.commitTool.menu.showHistory')),
        disabled: true,
      },
      {
        key: 'git-show-current-revision',
        label: menuLabel(null, t('workbench.commitTool.menu.showCurrentRevision')),
        disabled: true,
      },
      {
        key: 'git-rollback',
        label: menuLabel(<UndoOutlined />, t('workbench.commitTool.rollback'), '⌥⌘Z'),
        disabled: true,
      },
      { type: 'divider' },
      {
        key: 'git-push',
        label: menuLabel(<RiseOutlined />, t('workbench.commitTool.menu.push'), '⇧⌘K'),
        onClick: () => h.onPush(),
      },
      { key: 'git-pull', label: menuLabel(null, t('workbench.commitTool.menu.pull')), onClick: () => h.onPull() },
      { key: 'git-fetch', label: menuLabel(null, t('workbench.commitTool.menu.fetch')), onClick: () => h.onFetch() },
      { type: 'divider' },
      { key: 'git-merge', label: menuLabel(<ForkOutlined />, t('workbench.commitTool.menu.merge')), disabled: true },
      { key: 'git-rebase', label: menuLabel(null, t('workbench.commitTool.menu.rebase')), disabled: true },
      { type: 'divider' },
      {
        key: 'git-branches',
        label: menuLabel(<BranchesOutlined />, t('workbench.commitTool.menu.branches')),
        onClick: () => h.onBranches(),
      },
      {
        key: 'git-new-branch',
        label: menuLabel(<PlusOutlined />, t('workbench.commitTool.menu.newBranch'), '⌥⌘N'),
        onClick: () => h.onNewBranch(),
      },
      { key: 'git-new-tag', label: menuLabel(null, t('workbench.commitTool.menu.newTag')), disabled: true },
      { key: 'git-reset-head', label: menuLabel(null, t('workbench.commitTool.menu.resetHead')), disabled: true },
      { type: 'divider' },
      { key: 'git-stash', label: menuLabel(null, t('workbench.commitTool.menu.stash')), disabled: true },
      { key: 'git-unstash', label: menuLabel(null, t('workbench.commitTool.menu.unstash')), disabled: true },
      { type: 'divider' },
      { key: 'git-github', label: menuLabel(<GithubOutlined />, t('workbench.commitTool.menu.github')), disabled: true },
      {
        key: 'git-manage-remotes',
        label: menuLabel(null, t('workbench.commitTool.menu.manageRemotes')),
        disabled: true,
      },
      { key: 'git-clone', label: menuLabel(null, t('workbench.commitTool.menu.clone')), disabled: true },
    ],
  };
}

/**
 * The row menu for a checkable file row (tracked or unversioned) —
 * ignored rows carry no menu. Returned fresh per open; the builder is
 * pure over (row, t, handlers).
 */
export function buildCommitRowMenu(
  row: WorkspaceTreeWorkingChangeWire,
  t: Translate,
  h: CommitRowMenuHandlers,
): MenuProps {
  const unversioned = row.unversioned === true;
  const items: MenuItems = [
    {
      key: 'commit-file',
      label: menuLabel(null, t('workbench.commitTool.menu.commitFile')),
      onClick: () => h.onCommitFile(row.path),
    },
    {
      key: 'rollback',
      label: menuLabel(<UndoOutlined />, t('workbench.commitTool.rollback'), '⌥⌘Z'),
      disabled: true,
    },
    {
      key: 'move-changelist',
      label: menuLabel(null, t('workbench.commitTool.menu.moveToChangelist'), '⇧⌘M'),
      disabled: true,
    },
    {
      key: 'show-diff',
      label: menuLabel(<SwapOutlined />, t('workbench.commitTool.menu.showDiff'), '⌘D'),
      onClick: () => h.onShowDiff(row.path),
    },
    {
      key: 'show-diff-new-tab',
      label: menuLabel(<SwapOutlined />, t('workbench.commitTool.menu.showDiffNewTab')),
      disabled: true,
    },
    {
      key: 'jump-to-source',
      label: menuLabel(<EditOutlined />, t('workbench.commitTool.menu.jumpToSource')),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'delete', label: menuLabel(null, t('workbench.commitTool.menu.delete')), disabled: true },
    { key: 'add-vcs', label: menuLabel(null, t('workbench.commitTool.menu.addToVcs'), '⌥⌘A'), disabled: true },
    ...(unversioned ? [gitignoreSubmenu(t, '')] : []),
    { type: 'divider' },
    ...(unversioned
      ? []
      : [
          {
            key: 'new-changelist',
            label: menuLabel(<PlusOutlined />, t('workbench.commitTool.menu.newChangelist')),
            disabled: true,
          },
          {
            key: 'edit-changelist',
            label: menuLabel(<EditOutlined />, t('workbench.commitTool.menu.editChangelist'), 'F2'),
            disabled: true,
          },
        ]),
    {
      key: 'create-patch',
      label: menuLabel(<DiffOutlined />, t('workbench.commitTool.menu.createPatch')),
      disabled: true,
    },
    { key: 'copy-patch', label: menuLabel(null, t('workbench.commitTool.menu.copyPatch')), disabled: true },
    {
      key: 'shelve-changes',
      label: menuLabel(<VerticalAlignBottomOutlined />, t('workbench.commitTool.menu.shelveChanges')),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'refresh',
      label: menuLabel(<SyncOutlined />, t('workbench.commitTool.refresh')),
      onClick: () => h.onRefresh(),
    },
    { type: 'divider' },
    {
      key: 'local-history',
      label: menuLabel(null, t('workbench.commitTool.menu.localHistory')),
      children: [
        {
          key: 'local-history-show',
          label: menuLabel(null, t('workbench.commitTool.menu.localHistoryShow')),
          disabled: true,
        },
        {
          key: 'local-history-project',
          label: menuLabel(null, t('workbench.commitTool.menu.showProjectHistory')),
          disabled: true,
        },
        {
          key: 'local-history-recent',
          label: menuLabel(null, t('workbench.commitTool.menu.recentChanges'), '⌥⇧C'),
          disabled: true,
        },
        {
          key: 'local-history-label',
          label: menuLabel(null, t('workbench.commitTool.menu.putLabel')),
          disabled: true,
        },
      ],
    },
    gitSubmenu(row, t, h),
  ];
  return { items, selectable: false };
}

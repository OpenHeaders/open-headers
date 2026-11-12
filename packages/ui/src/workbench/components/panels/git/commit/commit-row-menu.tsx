/**
 * commit-row-menu — the Commit tree's right-click menu (reference design,
 * two variants): tracked rows carry the changelist/patch/shelve block,
 * unversioned rows carry Add to .gitignore instead. S22 posture — reads
 * and gestures with existing machinery are live (Commit File…, Show
 * Diff, Refresh, the Git ▸ verbs Push/Pull/Fetch/Compare with Branch
 * or Tag/Branches…/New Branch…, the Add to .gitignore ▸ targets
 * over the `ignorePath` verb, Add to VCS over unversioned rows,
 * Rollback… over added rows (the index drop back to unversioned) and
 * Delete… over any file rows — each over a selection's union);
 * placeholder constructs (changelists, shelf, Local History) and
 * unbuilt write verbs render visible-disabled. Shortcut hints mirror the reference anatomy; bindings
 * ride the keymap plane later.
 *
 * Every row carries the menu (the menu law): a directory node or a
 * group header gets the same anatomy over its subtree — the commit
 * verb reads Commit Directory… / Commit… and checks exactly those
 * paths, Show Diff (one file's read) is visible-disabled, Add to
 * .gitignore names the directory itself. The Ignored Files group and
 * its directories carry Refresh alone. With the files listed by what
 * they belong to, a named row that holds several reads as a selection
 * of them (Commit Files…), and Jump to Source opens the entity a row is
 * or is a part of — a file's row in any shape by its path.
 */

import { ClockCircleOutlined, EditOutlined, GithubOutlined, PlusOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import type { WorkspaceTreeEntityRefWire, WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import type { MenuProps } from 'antd';
import type React from 'react';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  BranchIcon,
  DiffIcon,
  MergeIcon,
  PushIcon,
  RefreshIcon,
  RollbackIcon,
  ShelveIcon,
} from '@openheaders/ui/shared/icons';
import { menuLabel } from '../git-menu-label';
import { type CommitMenuTarget, rollbackPaths } from './commit-model';

export interface CommitRowMenuHandlers {
  /** Check exactly these paths and focus the message box. */
  onCommitPaths: (paths: readonly string[]) => void;
  onShowDiff: (path: string) => void;
  onRefresh: () => void;
  onPush: () => void;
  onPull: () => void;
  onFetch: () => void;
  onCompareWithBranch: () => void;
  onBranches: () => void;
  onNewBranch: () => void;
  /** The Git Remotes dialog. */
  onManageRemotes: () => void;
  /** Append every path's entry to the target ignore file — one unversioned file or directory, or a selection of files. */
  onIgnorePaths: (paths: readonly string[], target: 'gitignore' | 'exclude') => void;
  /** Track these unversioned paths (intent-to-add) — the rows move to Changes as added. */
  onAddToVcs: (paths: readonly string[]) => void;
  /** Drop these added paths from the index — the panel confirms first; the rows return to Unversioned Files. */
  onRollbackPaths: (paths: readonly string[]) => void;
  /** Delete these files from disk — the panel confirms first. */
  onDeletePaths: (paths: readonly string[]) => void;
  onUnignorePath: (path: string, target: 'gitignore' | 'exclude') => void;
  /** Open the editor of the entity a row is or is a part of — by the entity a named row knows, else by the file's path. Absent: the verb is held. */
  onJumpToSource?: (path: string | null, entity?: WorkspaceTreeEntityRefWire) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

/** The target's facts the menu anatomy branches on. */
interface TargetFacts {
  unversioned: boolean;
  /** The commit verb's paths — empty on an empty group (the verb disables). */
  paths: readonly string[];
  /** Show Diff is one tracked file's read; null elsewhere. */
  diffPath: string | null;
  /** Add to .gitignore's paths — an unversioned file or directory, or every file of an all-unversioned selection; empty elsewhere. */
  ignorePaths: readonly string[];
  /** Add to VCS's paths — the unversioned target's files; empty on a tracked or mixed target. */
  addPaths: readonly string[];
  /** Rollback…'s paths — the target's files when every one is an added row; empty elsewhere. */
  rollbackPaths: readonly string[];
  /** Jump to Source's target — one file's row, or a named row whose entity has an editor; null elsewhere. */
  jump: { path: string | null; entity?: WorkspaceTreeEntityRefWire } | null;
  commitLabelKey: MessageKey;
}

function factsOf(target: CommitMenuTarget): TargetFacts {
  if (target.kind === 'file') {
    const unversioned = target.row.unversioned === true;
    return {
      unversioned,
      paths: [target.row.path],
      diffPath: unversioned ? null : target.row.path,
      ignorePaths: unversioned ? [target.row.path] : [],
      addPaths: unversioned ? [target.row.path] : [],
      rollbackPaths: rollbackPaths([target.row]),
      jump: { path: target.row.path, ...(target.entity !== undefined ? { entity: target.entity } : {}) },
      commitLabelKey: 'workbench.commitTool.menu.commitFile',
    };
  }
  // A multi-row selection, or a named row that holds several files:
  // the unversioned variant only when every row is unversioned, and
  // then Add to .gitignore covers them all; Show Diff (one file's read)
  // stays out.
  if (target.kind === 'files' || target.kind === 'named') {
    const unversioned = target.rows.every((row) => row.unversioned === true);
    const paths = target.rows.map((row) => row.path);
    return {
      unversioned,
      paths,
      diffPath: null,
      ignorePaths: unversioned ? paths : [],
      addPaths: unversioned ? paths : [],
      rollbackPaths: rollbackPaths(target.rows),
      jump: target.kind === 'named' && target.entity !== undefined ? { path: null, entity: target.entity } : null,
      commitLabelKey: 'workbench.commitTool.menu.commitFiles',
    };
  }
  const unversioned = target.group === 'unversioned';
  return {
    unversioned,
    paths: target.paths,
    diffPath: null,
    ignorePaths: target.kind === 'dir' && unversioned ? [target.path] : [],
    addPaths: unversioned ? target.paths : [],
    rollbackPaths: [],
    jump: null,
    commitLabelKey:
      target.kind === 'dir' ? 'workbench.commitTool.menu.commitDirectory' : 'workbench.commitTool.menu.commit',
  };
}

/** The commit verb — Commit File… / Commit Directory… / Commit… over the target's paths. */
function commitItem(facts: TargetFacts, h: CommitRowMenuHandlers, t: Translate, key: string): MenuItems[number] {
  return {
    key,
    label: menuLabel(null, t(facts.commitLabelKey)),
    disabled: facts.paths.length === 0,
    ...(facts.paths.length === 0 ? {} : { onClick: () => h.onCommitPaths(facts.paths) }),
  };
}

/** Add to VCS — live over an unversioned target's files, visible-disabled on a tracked or mixed one. */
function addToVcsItem(
  facts: TargetFacts,
  h: CommitRowMenuHandlers,
  t: Translate,
  key: string,
  labelKey: MessageKey,
  icon: React.ReactNode,
): MenuItems[number] {
  const paths = facts.addPaths;
  return {
    key,
    label: menuLabel(icon, t(labelKey), '⌥⌘A'),
    disabled: paths.length === 0,
    ...(paths.length === 0 ? {} : { onClick: () => h.onAddToVcs(paths) }),
  };
}

/** Rollback… — live over added rows (the index drop), visible-disabled on every other target. */
function rollbackItem(facts: TargetFacts, h: CommitRowMenuHandlers, t: Translate, key: string): MenuItems[number] {
  const paths = facts.rollbackPaths;
  return {
    key,
    label: menuLabel(<RollbackIcon />, t('workbench.commitTool.rollback'), '⌥⌘Z'),
    disabled: paths.length === 0,
    ...(paths.length === 0 ? {} : { onClick: () => h.onRollbackPaths(paths) }),
  };
}

/** Delete… — live over any file paths; the panel confirms before the disk write. */
function deleteItem(facts: TargetFacts, h: CommitRowMenuHandlers, t: Translate): MenuItems[number] {
  const paths = facts.paths;
  return {
    key: 'delete',
    label: menuLabel(null, t('workbench.commitTool.menu.delete')),
    disabled: paths.length === 0,
    ...(paths.length === 0 ? {} : { onClick: () => h.onDeletePaths(paths) }),
  };
}

/** Show Diff — live for one tracked file, visible-disabled elsewhere. */
function showDiffItem(facts: TargetFacts, h: CommitRowMenuHandlers, t: Translate, key: string): MenuItems[number] {
  const diffPath = facts.diffPath;
  return {
    key,
    label: menuLabel(<SwapOutlined />, t('workbench.commitTool.menu.showDiff'), '⌘D'),
    disabled: diffPath === null,
    ...(diffPath === null ? {} : { onClick: () => h.onShowDiff(diffPath) }),
  };
}

/** Jump to Source — live on a row that names one target and a surface that wires the verb, visible-disabled elsewhere. */
function jumpToSourceItem(facts: TargetFacts, h: CommitRowMenuHandlers, t: Translate): MenuItems[number] {
  const { jump } = facts;
  const run = h.onJumpToSource;
  const live = jump !== null && run !== undefined;
  return {
    key: 'jump-to-source',
    label: menuLabel(
      <EditOutlined />,
      t('workbench.commitTool.menu.jumpToSource'),
      undefined,
      'commit-tool-menu-jump',
    ),
    disabled: !live,
    ...(live ? { onClick: () => run(jump.path, jump.entity) } : {}),
  };
}

/** The Add to .gitignore ▸ submenu — repo-root `.gitignore` (shared) or `.git/info/exclude` (local-only). */
function gitignoreSubmenu(
  ignorePaths: readonly string[],
  t: Translate,
  h: CommitRowMenuHandlers,
  keyPrefix: string,
): MenuItems[number] {
  return {
    key: `${keyPrefix}gitignore`,
    label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.addToGitignore')),
    popupClassName: 'commit-tool-row-menu',
    children: [
      {
        key: `${keyPrefix}gitignore-file`,
        label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.addToGitignore')),
        onClick: () => h.onIgnorePaths(ignorePaths, 'gitignore'),
      },
      {
        key: `${keyPrefix}gitignore-exclude`,
        label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.excludeFile')),
        onClick: () => h.onIgnorePaths(ignorePaths, 'exclude'),
      },
    ],
  };
}

/** The Git ▸ submenu — verbs with existing machinery are live. */
function gitSubmenu(facts: TargetFacts, t: Translate, h: CommitRowMenuHandlers): MenuItems[number] {
  return {
    key: 'git',
    label: menuLabel(null, t('workbench.commitTool.menu.git')),
    popupClassName: 'commit-tool-row-menu',
    children: [
      commitItem(facts, h, t, 'git-commit-file'),
      addToVcsItem(facts, h, t, 'git-add', 'workbench.commitTool.menu.add', <PlusOutlined />),
      ...(facts.ignorePaths.length === 0 ? [] : [gitignoreSubmenu(facts.ignorePaths, t, h, 'git-')]),
      { type: 'divider' },
      showDiffItem(facts, h, t, 'git-show-diff'),
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
      rollbackItem(facts, h, t, 'git-rollback'),
      { type: 'divider' },
      {
        key: 'git-push',
        label: menuLabel(<PushIcon />, t('workbench.commitTool.menu.push'), '⇧⌘K', 'commit-tool-menu-push'),
        onClick: () => h.onPush(),
      },
      {
        key: 'git-pull',
        label: menuLabel(null, t('workbench.commitTool.menu.pull'), undefined, 'commit-tool-menu-pull'),
        onClick: () => h.onPull(),
      },
      {
        key: 'git-fetch',
        label: menuLabel(null, t('workbench.commitTool.menu.fetch'), undefined, 'commit-tool-menu-fetch'),
        onClick: () => h.onFetch(),
      },
      { type: 'divider' },
      { key: 'git-merge', label: menuLabel(<MergeIcon />, t('workbench.commitTool.menu.merge')), disabled: true },
      { key: 'git-rebase', label: menuLabel(null, t('workbench.commitTool.menu.rebase')), disabled: true },
      { type: 'divider' },
      {
        key: 'git-branches',
        label: menuLabel(<BranchIcon />, t('workbench.commitTool.menu.branches')),
        onClick: () => h.onBranches(),
      },
      {
        key: 'git-new-branch',
        label: menuLabel(
          <PlusOutlined />,
          t('workbench.commitTool.menu.newBranch'),
          '⌥⌘N',
          'commit-tool-menu-new-branch',
        ),
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
        label: menuLabel(
          null,
          t('workbench.commitTool.menu.manageRemotes'),
          undefined,
          'commit-tool-menu-manage-remotes',
        ),
        onClick: () => h.onManageRemotes(),
      },
      { key: 'git-clone', label: menuLabel(null, t('workbench.commitTool.menu.clone')), disabled: true },
    ],
  };
}

/**
 * The ignored-row menu — one verb: Stop Ignoring, enabled only when
 * the row's provenance is an exact single-file entry in the root
 * `.gitignore` or `exclude` (`removable`); a glob or a nested/global
 * source renders it visible-disabled (deleting a glob would un-ignore
 * other files, and foreign ignore files are not ours to edit).
 */
export function buildIgnoredRowMenu(
  row: WorkspaceTreeWorkingChangeWire,
  t: Translate,
  h: CommitRowMenuHandlers,
): MenuProps {
  const source = row.ignoreSource;
  const removable = source !== undefined && source.removable;
  const target = source?.kind === 'exclude' ? 'exclude' : 'gitignore';
  const items: MenuItems = [
    {
      key: 'stop-ignoring',
      label: menuLabel(<StopOutlined />, t('workbench.commitTool.menu.stopIgnoring')),
      disabled: !removable,
      ...(removable ? { onClick: () => h.onUnignorePath(row.path, target) } : {}),
    },
  ];
  return { items, selectable: false };
}

/** The Ignored Files group and its directories — nothing to commit or diff; Refresh alone. */
function refreshOnlyMenu(t: Translate, h: CommitRowMenuHandlers): MenuProps {
  const items: MenuItems = [
    {
      key: 'refresh',
      label: menuLabel(<RefreshIcon />, t('workbench.commitTool.refresh')),
      onClick: () => h.onRefresh(),
    },
  ];
  return { items, selectable: false };
}

/**
 * The row menu for a checkable target — a file row (tracked or
 * unversioned), a directory node or a group header. Returned fresh per
 * open; the builder is pure over (target, t, handlers).
 */
export function buildCommitRowMenu(target: CommitMenuTarget, t: Translate, h: CommitRowMenuHandlers): MenuProps {
  if (target.kind !== 'file' && target.kind !== 'files' && target.group === 'ignored') return refreshOnlyMenu(t, h);
  const facts = factsOf(target);
  const unversioned = facts.unversioned;
  const items: MenuItems = [
    commitItem(facts, h, t, 'commit-file'),
    rollbackItem(facts, h, t, 'rollback'),
    {
      key: 'move-changelist',
      label: menuLabel(null, t('workbench.commitTool.menu.moveToChangelist'), '⇧⌘M'),
      disabled: true,
    },
    showDiffItem(facts, h, t, 'show-diff'),
    {
      key: 'show-diff-new-tab',
      label: menuLabel(<SwapOutlined />, t('workbench.commitTool.menu.showDiffNewTab')),
      disabled: true,
    },
    jumpToSourceItem(facts, h, t),
    { type: 'divider' },
    deleteItem(facts, h, t),
    addToVcsItem(facts, h, t, 'add-vcs', 'workbench.commitTool.menu.addToVcs', null),
    ...(facts.ignorePaths.length === 0 ? [] : [gitignoreSubmenu(facts.ignorePaths, t, h, '')]),
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
      label: menuLabel(<DiffIcon />, t('workbench.commitTool.menu.createPatch')),
      disabled: true,
    },
    { key: 'copy-patch', label: menuLabel(null, t('workbench.commitTool.menu.copyPatch')), disabled: true },
    {
      key: 'shelve-changes',
      label: menuLabel(<ShelveIcon />, t('workbench.commitTool.menu.shelveChanges')),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'refresh',
      label: menuLabel(<RefreshIcon />, t('workbench.commitTool.refresh')),
      onClick: () => h.onRefresh(),
    },
    { type: 'divider' },
    {
      key: 'local-history',
      label: menuLabel(null, t('workbench.commitTool.menu.localHistory')),
      popupClassName: 'commit-tool-row-menu',
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
    gitSubmenu(facts, t, h),
  ];
  return { items, selectable: false };
}

/**
 * GitRefRail — section #1 of the IDE-log layout: the vertical activity
 * bar + the branches tree, wired to the workspace-tree verbs. Owns the
 * action semantics: what a tree click does (the gear's single-click
 * setting), which bar verbs the selection enables, the row context
 * menu (Checkout with the §6.2 dirty prompt, Merge into Current, and
 * the bar's verbs by row), the New Branch dialog, the delete toast
 * with Restore, and the per-workspace rail prefs (favorites, Show
 * Tags, Group By Directory). Data flows down from GitLogView (refs +
 * current branch); mutations go through the bridge and come back as
 * `workspaceTreeGitStatus` frames — the rail never refetches by hand.
 */

import { hostBridge, type WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { App as AntApp, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { GIT_LOG_SCOPE_HEAD } from '../git-panel-view-store';
import CreateBranchModal from './CreateBranchModal';
import GitRailActivityBar from './GitRailActivityBar';
import { getGitRailPrefs, patchGitRailPrefs, subscribeGitRailPrefs, toggleGitRailFavorite } from './git-rail-prefs';
import { buildRefRowMenu, type RefRowMenuHandlers } from './ref-row-menu';
import RefTree, { type RefTreeHandle, type RefTreeSelection } from './RefTree';
import SwitchBranchModal, { type SwitchBranchPrompt, type SwitchDirtyChoice } from './SwitchBranchModal';

export interface GitRefRailProps {
  workspaceId: string;
  refs: WorkspaceTreeRefWire[];
  currentRef: string | null;
  unbornBranch: string | null;
  /** The detached HEAD's commit (§3.4) — the HEAD row names it where the branch name goes; null on a branch. */
  detachedSha: string | null;
  /** A remote history rewrite is pending (§16) — Merge into Current holds until the banner resolves it. */
  historyRewritten: boolean;
  /** The tree selection — tab state, survives pane moves. */
  selection: RefTreeSelection | null;
  onSelectionChange: (selection: RefTreeSelection | null) => void;
  /** The log scope (the toolbar chip) — the single-click 'filter' target. */
  scopeRef: string | null;
  onScopeChange: (ref: string | null) => void;
  /** Scroll the commit list to a sha and select it (navigate gestures). */
  onNavigateToSha: (sha: string) => void;
  /** Open a Compare-with-Current tab for a ref. */
  onOpenCompare: (ref: string) => void;
  /** Collapse the rail to the vertical Branches strip. */
  onHide: () => void;
}

const GitRefRail: React.FC<GitRefRailProps> = ({
  workspaceId,
  refs,
  currentRef,
  unbornBranch,
  detachedSha,
  historyRewritten,
  selection,
  onSelectionChange,
  scopeRef,
  onScopeChange,
  onNavigateToSha,
  onOpenCompare,
  onHide,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { notification } = AntApp.useApp();
  const treeRef = useRef<RefTreeHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const subscribe = useCallback((listener: () => void) => subscribeGitRailPrefs(workspaceId, listener), [workspaceId]);
  const prefs = useSyncExternalStore(subscribe, () => getGitRailPrefs(workspaceId));
  const favoriteSet = useMemo<ReadonlySet<string>>(() => new Set(prefs.favorites), [prefs.favorites]);

  const [createFrom, setCreateFrom] = useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [fetchBusy, setFetchBusy] = useState(false);
  const [switchPrompt, setSwitchPrompt] = useState<SwitchBranchPrompt | null>(null);
  const [switching, setSwitching] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);

  const selectedSha = useCallback(
    (target: RefTreeSelection): string | null =>
      refs.find((ref) => ref.name === target.name && ref.kind === target.kind)?.sha ?? null,
    [refs],
  );

  const handleLeafClick = (node: RefTreeSelection): void => {
    onSelectionChange(node);
    if (prefs.singleClick === 'filter') {
      // Re-clicking the scoped branch KEEPS the filter (IDE behavior)
      // — only the chip's × or another row changes the scope.
      onScopeChange(node.name);
      return;
    }
    const sha = selectedSha(node);
    if (sha !== null) onNavigateToSha(sha);
  };

  // The HEAD row mirrors a branch row's gestures: single-click 'filter'
  // scopes the log to HEAD (the `Branch: HEAD` chip — the IDE move),
  // 'navigate' jumps to the checked-out tip.
  const handleHeadClick = (): void => {
    onSelectionChange(null);
    if (prefs.singleClick === 'filter') {
      onScopeChange(GIT_LOG_SCOPE_HEAD);
      return;
    }
    const sha = currentRef !== null ? (refs.find((ref) => ref.kind === 'local' && ref.name === currentRef)?.sha ?? null) : null;
    if (sha !== null) onNavigateToSha(sha);
  };

  const isLocalSelection = selection !== null && selection.kind === 'local';
  const isCurrentSelection = selection !== null && selection.kind === 'local' && selection.name === currentRef;

  const updateBranch = async (branch: string): Promise<void> => {
    if (updateBusy) return;
    setUpdateBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.updateBranch', { workspaceId, branch });
      if (!result.ok) {
        notification.error({
          title:
            result.reason === 'no-upstream'
              ? t('workbench.gitLog.updateBranch.noUpstream', { branch })
              : t('workbench.gitLog.updateBranch.failed', { branch, detail: result.detail ?? result.reason }),
        });
      }
    } finally {
      setUpdateBusy(false);
    }
  };

  const deleteBranch = async (branch: string): Promise<void> => {
    const result = await hostBridge.call('oh.workspaceTree.deleteBranch', { workspaceId, branch });
    if (!result.ok) {
      notification.error({
        title: t('workbench.gitLog.deleteBranch.failed', { detail: result.detail ?? result.reason }),
      });
      return;
    }
    if (selection !== null && selection.kind === 'local' && selection.name === branch) onSelectionChange(null);
    if (scopeRef === branch) onScopeChange(null);
    const key = `git-branch-deleted-${branch}`;
    notification.info({
      key,
      title: t('workbench.gitLog.deleteBranch.deleted', { branch }),
      duration: 8,
      btn: (
        <button
          type="button"
          onClick={() => {
            notification.destroy(key);
            void hostBridge.call('oh.workspaceTree.createBranch', {
              workspaceId,
              branch,
              from: result.sha,
              checkout: false,
            });
          }}
          data-testid="git-tool-restore-branch"
          style={{
            border: 'none',
            background: 'transparent',
            color: token.colorPrimary,
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
          }}
        >
          {t('workbench.gitLog.deleteBranch.restore')}
        </button>
      ),
    });
  };

  const handleFetch = async (): Promise<void> => {
    if (fetchBusy) return;
    setFetchBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.fetch', { workspaceId });
      if (!result.ok) {
        notification.error({
          title:
            result.reason === 'no-remote'
              ? t('workbench.gitLog.fetch.noRemote')
              : t('workbench.gitLog.fetch.failed', { detail: result.detail ?? result.reason }),
        });
      }
    } finally {
      setFetchBusy(false);
    }
  };

  // Checkout (§6): the wrapped switch; a dirty tree answers `dirty`
  // with the count and the §6.2 prompt re-enters the verb with the
  // user's choice. The status frame moves the star.
  const switchTo = async (branch: string, dirtyAction?: SwitchDirtyChoice): Promise<void> => {
    if (switching) return;
    setSwitching(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.switchBranch', {
        workspaceId,
        branch,
        ...(dirtyAction !== undefined ? { dirtyAction } : {}),
      });
      if (result.ok) {
        setSwitchPrompt(null);
        if (result.switched) {
          notification.info({ title: t('workbench.gitLog.switch.checkedOut', { branch }), duration: 5 });
        }
      } else if (result.reason === 'dirty') {
        setSwitchPrompt({ branch, dirtyFiles: result.dirtyFiles ?? 0 });
      } else {
        setSwitchPrompt(null);
        notification.error({
          title: t('workbench.gitLog.switch.failed', { branch, detail: result.detail ?? result.reason }),
        });
      }
    } catch (err) {
      setSwitchPrompt(null);
      notification.error({ title: t('workbench.gitLog.switch.failed', { branch, detail: (err as Error).message }) });
    } finally {
      setSwitching(false);
    }
  };

  // Merge into Current (§6): the Phase 4 machinery on a local or
  // remote-tracking ref — never raw `git merge`. A no-base merge
  // (shallow clone, unrelated histories) says why, like pull's toast.
  const mergeIntoCurrent = async (ref: string): Promise<void> => {
    if (mergeBusy) return;
    setMergeBusy(true);
    const branch = currentRef ?? 'HEAD';
    try {
      const result = await hostBridge.call('oh.workspaceTree.mergeBranch', { workspaceId, ref });
      if (!result.ok) {
        notification.error({
          title: t('workbench.gitLog.merge.failed', { ref, detail: result.detail ?? result.reason }),
        });
      } else if (result.upToDate) {
        notification.info({ title: t('workbench.gitLog.merge.upToDate', { ref, branch }), duration: 5 });
      } else if (result.history !== undefined) {
        notification.warning({
          title: t(
            result.history === 'shallow' ? 'workbench.gitLog.merge.doneShallow' : 'workbench.gitLog.merge.doneUnrelated',
            { ref, branch },
          ),
          duration: 8,
        });
      } else {
        notification.success({
          title: t('workbench.gitLog.merge.done', { ref, branch, sha: result.sha.slice(0, 8) }),
          duration: 5,
        });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.merge.failed', { ref, detail: (err as Error).message }) });
    } finally {
      setMergeBusy(false);
    }
  };

  const handleNavigate = (): void => {
    if (selection === null) return;
    const sha = selectedSha(selection);
    if (sha !== null) onNavigateToSha(sha);
  };

  const handleCreated = (branch: string, from: string, checkedOut: boolean): void => {
    if (checkedOut) {
      notification.info({
        title: t('workbench.gitLog.createBranch.checkedOut', { branch, from }),
        duration: 5,
      });
    }
  };

  // Built per render like the bar's handlers — a menu is constructed
  // only when a row is right-clicked, so there is nothing to memoize.
  const rowMenuHandlers: RefRowMenuHandlers = {
    onCheckout: (branch) => void switchTo(branch),
    onNewBranchFrom: (ref) => setCreateFrom(ref),
    onCompareWithCurrent: (ref) => onOpenCompare(ref),
    onMergeIntoCurrent: (ref) => void mergeIntoCurrent(ref),
    onUpdate: (branch) => void updateBranch(branch),
    onDelete: (branch) => void deleteBranch(branch),
  };
  const rowMenu = (node: RefTreeSelection): ReturnType<typeof buildRefRowMenu> =>
    buildRefRowMenu(node, { current: currentRef, historyRewritten }, t, rowMenuHandlers);

  return (
    <div
      ref={rootRef}
      style={{
        flex: '1 1 auto',
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
      data-testid="git-tool-rail"
    >
      <GitRailActivityBar
        onHide={onHide}
        onNewBranch={() => {
          const from = selection?.name ?? currentRef;
          if (from !== null) setCreateFrom(from);
        }}
        onUpdateSelected={() => {
          if (selection !== null) void updateBranch(selection.name);
        }}
        updateSelectedEnabled={isLocalSelection && !isCurrentSelection}
        updateSelectedBusy={updateBusy}
        onDeleteBranch={() => {
          if (selection !== null) void deleteBranch(selection.name);
        }}
        deleteEnabled={isLocalSelection && !isCurrentSelection}
        onCompareWithCurrent={() => {
          if (selection !== null) onOpenCompare(selection.name);
        }}
        compareEnabled={selection !== null && selection.name !== currentRef}
        onFetch={() => void handleFetch()}
        fetchBusy={fetchBusy}
        onToggleFavorite={() => {
          if (selection !== null) toggleGitRailFavorite(workspaceId, selection.kind, selection.name);
        }}
        favoriteEnabled={selection !== null}
        onNavigateToHead={handleNavigate}
        navigateEnabled={selection !== null}
        singleClick={prefs.singleClick}
        onSingleClickChange={(mode) => patchGitRailPrefs(workspaceId, { singleClick: mode })}
        showTags={prefs.showTags}
        onShowTagsChange={(show) => patchGitRailPrefs(workspaceId, { showTags: show })}
        groupByDirectory={prefs.groupByDirectory}
        onGroupByDirectoryChange={(grouped) => patchGitRailPrefs(workspaceId, { groupByDirectory: grouped })}
        onExpandAll={() => treeRef.current?.expandAll()}
        onCollapseAll={() => treeRef.current?.collapseAll()}
      />
      <RefTree
        ref={treeRef}
        refs={refs}
        currentRef={currentRef}
        unbornBranch={unbornBranch}
        detachedSha={detachedSha}
        selected={selection}
        favorites={favoriteSet}
        groupByDirectory={prefs.groupByDirectory}
        showTags={prefs.showTags}
        onLeafClick={handleLeafClick}
        onHeadClick={handleHeadClick}
        onLeafContextMenu={onSelectionChange}
        rowMenu={rowMenu}
      />
      <CreateBranchModal
        workspaceId={workspaceId}
        from={createFrom}
        fromRef={
          createFrom !== null && refs.some((ref) => ref.name === createFrom)
            ? createFrom
            : // The unborn current branch resolves nowhere yet — anchor
              // the create at HEAD, which IS that branch.
              undefined
        }
        container={rootRef.current?.closest<HTMLElement>('.git-tool-panel') ?? null}
        onClose={() => setCreateFrom(null)}
        onCreated={handleCreated}
      />
      <SwitchBranchModal
        prompt={switchPrompt}
        busy={switching}
        container={rootRef.current?.closest<HTMLElement>('.git-tool-panel') ?? null}
        onChoose={(choice) => {
          if (switchPrompt !== null) void switchTo(switchPrompt.branch, choice);
        }}
        onClose={() => setSwitchPrompt(null)}
      />
    </div>
  );
};

export default GitRefRail;

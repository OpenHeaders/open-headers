/**
 * GitRefRail — section #1 of the IDE-log layout: the vertical activity
 * bar + the branches tree, wired to the workspace-tree verbs. Owns the
 * action semantics: what a tree click does (the gear's single-click
 * setting), which bar verbs the selection enables, the New Branch
 * dialog, the delete toast with Restore, and the per-workspace rail
 * prefs (favorites, Show Tags, Group By Directory). Data flows down
 * from GitLogView (refs + current branch); mutations go through the
 * bridge and come back as `workspaceTreeGitStatus` frames — the rail
 * never refetches by hand.
 */

import { hostBridge, type WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { App as AntApp, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import CreateBranchModal from './CreateBranchModal';
import GitRailActivityBar from './GitRailActivityBar';
import { getGitRailPrefs, patchGitRailPrefs, subscribeGitRailPrefs, toggleGitRailFavorite } from './git-rail-prefs';
import RefTree, { type RefTreeHandle, type RefTreeSelection } from './RefTree';

export interface GitRefRailProps {
  workspaceId: string;
  refs: WorkspaceTreeRefWire[];
  currentRef: string | null;
  unbornBranch: string | null;
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

  const selectedSha = useCallback(
    (target: RefTreeSelection): string | null =>
      refs.find((ref) => ref.name === target.name && ref.kind === target.kind)?.sha ?? null,
    [refs],
  );

  const handleLeafClick = (node: RefTreeSelection): void => {
    onSelectionChange(node);
    if (prefs.singleClick === 'filter') {
      onScopeChange(node.name === scopeRef ? null : node.name);
      return;
    }
    const sha = selectedSha(node);
    if (sha !== null) onNavigateToSha(sha);
  };

  const handleHeadClick = (): void => {
    onSelectionChange(null);
    onScopeChange(null);
  };

  const isLocalSelection = selection !== null && selection.kind === 'local';
  const isCurrentSelection = selection !== null && selection.kind === 'local' && selection.name === currentRef;

  const handleUpdateSelected = async (): Promise<void> => {
    if (selection === null || updateBusy) return;
    setUpdateBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.updateBranch', { workspaceId, branch: selection.name });
      if (!result.ok) {
        notification.error({
          message:
            result.reason === 'no-upstream'
              ? t('workbench.gitLog.updateBranch.noUpstream', { branch: selection.name })
              : t('workbench.gitLog.updateBranch.failed', {
                  branch: selection.name,
                  detail: result.detail ?? result.reason,
                }),
        });
      }
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (selection === null) return;
    const branch = selection.name;
    const result = await hostBridge.call('oh.workspaceTree.deleteBranch', { workspaceId, branch });
    if (!result.ok) {
      notification.error({
        message: t('workbench.gitLog.deleteBranch.failed', { detail: result.detail ?? result.reason }),
      });
      return;
    }
    onSelectionChange(null);
    if (scopeRef === branch) onScopeChange(null);
    const key = `git-branch-deleted-${branch}`;
    notification.info({
      key,
      message: t('workbench.gitLog.deleteBranch.deleted', { branch }),
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
          message:
            result.reason === 'no-remote'
              ? t('workbench.gitLog.fetch.noRemote')
              : t('workbench.gitLog.fetch.failed', { detail: result.detail ?? result.reason }),
        });
      }
    } finally {
      setFetchBusy(false);
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
        message: t('workbench.gitLog.createBranch.checkedOut', { branch, from }),
        duration: 5,
      });
    }
  };

  return (
    <div
      ref={rootRef}
      style={{
        flex: '0 0 auto',
        display: 'flex',
        minHeight: 0,
        width: 248,
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
        onUpdateSelected={() => void handleUpdateSelected()}
        updateSelectedEnabled={isLocalSelection && !isCurrentSelection}
        updateSelectedBusy={updateBusy}
        onDeleteBranch={() => void handleDelete()}
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
        selected={selection}
        favorites={favoriteSet}
        groupByDirectory={prefs.groupByDirectory}
        showTags={prefs.showTags}
        onLeafClick={handleLeafClick}
        onHeadClick={handleHeadClick}
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
    </div>
  );
};

export default GitRefRail;

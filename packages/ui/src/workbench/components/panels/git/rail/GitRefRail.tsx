/**
 * GitRefRail — section #1 of the log-window layout: the vertical activity
 * bar + the branches tree, wired to the workspace-tree verbs. Owns the
 * rail's own semantics: what a tree click does (the gear's
 * single-click setting), which bar verbs the selection enables, and
 * the per-workspace rail prefs (favorites, Show Tags, Group By
 * Directory). The branch verbs themselves (checkout with the §6.2
 * dirty prompt, merge into current, update, delete with Restore,
 * fetch, new branch) are the shared `useGitBranchActions` — the same
 * implementation the top bar's branch widget drives. Data flows down
 * from GitLogView (refs + current branch); mutations come back as
 * `workspaceTreeGitStatus` frames — the rail never refetches by hand.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useGitBranchActions } from '../branch-actions/use-git-branch-actions';
import { GIT_LOG_SCOPE_HEAD } from '../git-panel-view-store';
import GitRailActivityBar from './GitRailActivityBar';
import { getGitRailPrefs, patchGitRailPrefs, subscribeGitRailPrefs, toggleGitRailFavorite } from './git-rail-prefs';
import { buildRefRowMenu, type RefRowMenuHandlers, type RefTreeSelection } from './ref-row-menu';
import RefTree, { type RefTreeHandle } from './RefTree';

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
  const treeRef = useRef<RefTreeHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const subscribe = useCallback((listener: () => void) => subscribeGitRailPrefs(workspaceId, listener), [workspaceId]);
  const prefs = useSyncExternalStore(subscribe, () => getGitRailPrefs(workspaceId));
  const favoriteSet = useMemo<ReadonlySet<string>>(() => new Set(prefs.favorites), [prefs.favorites]);

  const actions = useGitBranchActions({
    workspaceId,
    currentRef,
    refs,
    container: rootRef.current?.closest<HTMLElement>('.git-tool-panel') ?? null,
    onBranchDeleted: (branch) => {
      if (selection !== null && selection.kind === 'local' && selection.name === branch) onSelectionChange(null);
      if (scopeRef === branch) onScopeChange(null);
    },
  });

  const selectedSha = useCallback(
    (target: RefTreeSelection): string | null =>
      refs.find((ref) => ref.name === target.name && ref.kind === target.kind)?.sha ?? null,
    [refs],
  );

  const handleLeafClick = (node: RefTreeSelection): void => {
    onSelectionChange(node);
    if (prefs.singleClick === 'filter') {
      // Re-clicking the scoped branch KEEPS the filter (reference behavior)
      // — only the chip's × or another row changes the scope.
      onScopeChange(node.name);
      return;
    }
    const sha = selectedSha(node);
    if (sha !== null) onNavigateToSha(sha);
  };

  // The HEAD row mirrors a branch row's gestures: single-click 'filter'
  // scopes the log to HEAD (the `Branch: HEAD` chip — the reference move),
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

  const handleNavigate = (): void => {
    if (selection === null) return;
    const sha = selectedSha(selection);
    if (sha !== null) onNavigateToSha(sha);
  };

  // Built per render like the bar's handlers — a menu is constructed
  // only when a row is right-clicked, so there is nothing to memoize.
  const rowMenuHandlers: RefRowMenuHandlers = {
    onCheckout: actions.checkout,
    onCheckoutRemote: actions.checkoutRemote,
    onNewBranchFrom: actions.newBranchFrom,
    onCompareWithCurrent: onOpenCompare,
    onMergeIntoCurrent: actions.mergeIntoCurrent,
    onUpdate: actions.updateBranch,
    onPullCurrent: actions.pull,
    onPushCurrent: actions.push,
    onDelete: actions.deleteBranch,
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
        onNewBranch={() => actions.newBranchFrom(selection?.name ?? currentRef)}
        onUpdateSelected={() => {
          if (selection !== null) actions.updateBranch(selection.name);
        }}
        updateSelectedEnabled={isLocalSelection && !isCurrentSelection}
        updateSelectedBusy={actions.busy.update}
        onDeleteBranch={() => {
          if (selection !== null) actions.deleteBranch(selection.name);
        }}
        deleteEnabled={isLocalSelection && !isCurrentSelection}
        onCompareWithCurrent={() => {
          if (selection !== null) onOpenCompare(selection.name);
        }}
        compareEnabled={selection !== null && selection.name !== currentRef}
        onFetch={actions.fetch}
        fetchBusy={actions.busy.fetch}
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
      {actions.dialogs}
    </div>
  );
};

export default GitRefRail;

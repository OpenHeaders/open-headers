/**
 * GitLogView — ONE log tab's view, the log-window anatomy: three
 * sub-panes (branches rail, commit timeline, changes/details), EACH
 * owning its slice of the shared top band — the rail's Branch-or-tag
 * search, the log toolbar (text filter + Branch/User/Date/Paths chips
 * + Graph Options + actions), and the details toolbar (Show Diff /
 * View Options / expand-collapse). Self-sufficient per pane: it
 * fetches its own refs + log for its tab's scope and filters and
 * refetches on `workspaceTreeGitStatus` frames. Filter state lives in
 * the tab registry (travels with the tab); display prefs are
 * per-workspace. Hiding the rail swaps section #1 for the vertical
 * Branches strip (the log-window gesture).
 *
 * The three panes are grid tracks with a sash on each boundary (the
 * reference splitters): rail | log, log | details, and files | info inside
 * details. The templates and bounds are `git-log-layout.ts`; the drag
 * wiring is `use-git-log-layout.ts`.
 *
 * The branch verbs are ONE `useGitBranchActions` mounted here and
 * handed to the rail and the log rows' menu alike; its dialogs mount
 * once at the view's root, so they outlive a collapsed rail.
 */

import {
  hostBridge,
  type WorkspaceTreeEntityRefWire,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { Sash } from '@openheaders/ui/shared/dock-layout';
import { useGitBranchActions } from './branch-actions/use-git-branch-actions';
import { contiguousRangeBase, unionFiles } from './changed-files-union';
import CommitDetails from './CommitDetails';
import CommitFilesView from './CommitFilesView';
import CommitList from './CommitList';
import DiffModal from './DiffModal';
import { buildFileRowMenu } from './file-row-menu';
import FileHistoryModal from './FileHistoryModal';
import type { FileTreeViewHandle } from './FileTreeView';
import { getGitLogViewPrefs, patchGitLogViewPrefs, subscribeGitLogViewPrefs } from './git-log-view-prefs';
import { GIT_LOG_SCOPE_HEAD, type GitLogTabState, gitPanelTabKey } from './git-panel-view-store';
import { computeLogGraph } from './graph';
import { contractLog, firstParentOnly, firstParentReach } from './graph-filtered';
import { topologicalOrder } from './log-topological';
import { allLinearFragments, collapseLog, fragmentKey, type LogFragment } from './graph-fragment';
import { currentBranchBandTip, currentBranchShas as bandShas } from './log-reachability';
import { buildLogRowMenu, type LogRowMenuTarget } from './log-row-menu';
import { getGitRailPrefs, subscribeGitRailPrefs, toggleGitRailFavorite } from './rail/git-rail-prefs';
import { defaultFavoriteKeys, favoriteKeys } from './rail/ref-favorites';
import GitRailCollapsedStrip from './rail/GitRailCollapsedStrip';
import GitRefRail from './rail/GitRefRail';
import GitDetailsToolbar from './toolbar/GitDetailsToolbar';
import GitLogToolbar from './toolbar/GitLogToolbar';
import { buildLogWireFilters, hasRowFilters, isMergeCommit, makeTextMatcher } from './toolbar/log-filters';
import { useCommitApply } from './use-commit-apply';
import { useCommitPatch } from './use-commit-patch';
import { useFileDiff } from './use-file-diff';
import { useJumpToSource } from './use-jump-to-source';
import { useGitLogLayout } from './use-git-log-layout';
import { useLogHourCycle } from './use-log-hour-cycle';

export interface GitLogViewProps {
  workspaceId: string;
  tab: GitLogTabState;
  /** Checked-out branch from the panel's status feed (unborn included). */
  branch: string | null;
  /** The detached HEAD's commit (§3.4) from the status feed; null while a branch is checked out. */
  detachedSha: string | null;
  /** A remote history rewrite is pending (§16) — the rail's merge verb holds. */
  historyRewritten: boolean;
  patchTab: (patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>) => void;
  /** Open a Compare-with-Current tab (registry gesture — the renderer wires it). */
  onOpenCompare: (ref: string) => void;
}

const LOG_LIMIT = 200;

const GitLogView: React.FC<GitLogViewProps> = ({
  workspaceId,
  tab,
  branch,
  detachedSha,
  historyRewritten,
  patchTab,
  onOpenCompare,
}) => {
  const { token } = theme.useToken();
  const { t } = useLocale();
  const hourCycle = useLogHourCycle();
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const railCellRef = useRef<HTMLDivElement>(null);
  const detailsCellRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const infoCellRef = useRef<HTMLDivElement>(null);
  const fileTreeRef = useRef<FileTreeViewHandle>(null);

  // The window as the host answered it; `entries` below is what the view lists.
  const [loaded, setLoaded] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<{ sha: string; nonce: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // The entity the files tree names for the selection (Group By
  // Workspace) — what Jump to Source opens, a row that lists several
  // files included; set with the file, by the one report.
  const [selectedEntity, setSelectedEntity] = useState<WorkspaceTreeEntityRefWire | null>(null);
  // The commit the selected file's change is read against, where the
  // files are listed by parent (a merge's); set with the file.
  const [selectedBase, setSelectedBase] = useState<string | undefined>(undefined);
  // The timeline's row selection in list order (newest first). Two or
  // more commits and the details pane shows their files as ONE set
  // with a card per commit below (the reference reading); a contiguous
  // first-parent run also diffs as the range, a gapped set has no diff.
  const [selectedShas, setSelectedShas] = useState<readonly string[]>([]);
  const multiSelected = selectedShas.length >= 2;
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  // The graph's collapsed fragments (a click on a cell, the gear's
  // Collapse Linear Branches), by fragment key — a view state, dropped
  // with the tab; a stale entry is ignored.
  const [collapsed, setCollapsed] = useState<ReadonlyMap<string, LogFragment>>(() => new Map());
  const container = rootRef.current?.closest<HTMLElement>('.git-tool-panel') ?? null;
  const fileDiff = useFileDiff(workspaceId);
  const commitPatch = useCommitPatch(workspaceId);
  const commitApply = useCommitApply(workspaceId);
  const jumpToSource = useJumpToSource(workspaceId);

  const subscribeViewPrefs = useCallback(
    (listener: () => void) => subscribeGitLogViewPrefs(workspaceId, listener),
    [workspaceId],
  );
  const prefs = useSyncExternalStore(subscribeViewPrefs, () => getGitLogViewPrefs(workspaceId));
  const subscribeRailPrefs = useCallback(
    (listener: () => void) => subscribeGitRailPrefs(workspaceId, listener),
    [workspaceId],
  );
  const railPrefs = useSyncExternalStore(subscribeRailPrefs, () => getGitRailPrefs(workspaceId));
  const defaultFavorites = useMemo(() => defaultFavoriteKeys(refs, currentRef), [refs, currentRef]);
  const favoriteSet = useMemo<ReadonlySet<string>>(
    () => favoriteKeys(railPrefs, defaultFavorites),
    [railPrefs, defaultFavorites],
  );

  const { selectedRef, filter, filterRegex, filterCase, selectedSha, refsCollapsed, railSelection } = tab;
  const layout = useGitLogLayout(
    workspaceId,
    { root: gridRef, rail: railCellRef, details: detailsCellRef, detailBody: detailBodyRef, info: infoCellRef },
    { railCollapsed: refsCollapsed, showInfo: prefs.showDetails },
  );
  const { author, date, paths, sort, firstParent, noMerges } = tab;
  const tabKey = gitPanelTabKey(tab);
  const rowFiltersActive = hasRowFilters(tab);
  // Keyed on the filter fields alone — a selection or rail patch must
  // never refetch the log.
  const wireFilters = useMemo(
    () => buildLogWireFilters({ author, date, paths, sort }, new Date()),
    [author, date, paths, sort],
  );

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const refsResult = await hostBridge.call('oh.workspaceTree.listRefs', { workspaceId });
      if (refsResult.ok) {
        setRefs(refsResult.refs);
        setCurrentRef(refsResult.current);
      } else {
        setRefs([]);
        setCurrentRef(null);
      }
      // The unborn current branch scopes to an EMPTY filtered list (the
      // reference posture: `Branch: main` chip + no-matches empty state) —
      // its name exists only in `gitStatus`, so `log` would refuse it.
      const knownRefs = refsResult.ok ? refsResult.refs : [];
      const scopeIsUnborn =
        selectedRef !== null &&
        selectedRef === branch &&
        !knownRefs.some((ref) => ref.kind === 'local' && ref.name === selectedRef);
      if (scopeIsUnborn) {
        setLoaded([]);
        return;
      }
      // Scope triad (the reference model): null = every ref (`allRefs`),
      // the HEAD sentinel = the default walk, a name = that ref.
      const result = await hostBridge.call('oh.workspaceTree.log', {
        workspaceId,
        limit: LOG_LIMIT,
        ...(selectedRef !== null && selectedRef !== GIT_LOG_SCOPE_HEAD ? { ref: selectedRef } : {}),
        ...(selectedRef === null ? { allRefs: true } : {}),
        ...wireFilters,
      });
      if (result.ok) {
        setLoaded(result.entries);
      } else if (result.reason === 'unknown-ref') {
        // The scoped ref vanished (branch deleted, tag dropped) —
        // fall back to HEAD; the effect below refetches.
        patchTab({ selectedRef: null });
      } else {
        setLoaded([]);
        setError(t('workbench.gitLog.loadFailed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setLoaded([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedRef, branch, wireFilters, patchTab, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      void reload();
    });
  }, [workspaceId, reload]);

  // Sort › Topologically is the reference's order, made here over the
  // window (git's own topological walk keeps the window's cut honest):
  // the checked-out commit leads, the checked-out branch's upstream is
  // the last head listed above the trunk.
  const entries = useMemo(() => {
    if (sort !== 'topo') return loaded;
    const lead = refs.find((ref) => ref.kind === 'local' && ref.name === currentRef)?.sha ?? detachedSha;
    const upstream =
      currentRef === null ? [] : refs.filter((ref) => ref.kind === 'remote' && ref.name.endsWith(`/${currentRef}`));
    return topologicalOrder(loaded, { lead, last: new Set(upstream.map((ref) => ref.sha)) });
  }, [loaded, sort, refs, currentRef, detachedSha]);

  const matcher = useMemo(() => makeTextMatcher(filter, filterRegex, filterCase), [filter, filterRegex, filterCase]);

  // The view's own sifts of the window: the text filter, No Merges and
  // First Parent. Each hides rows (or lines) the window still holds, so
  // the list keeps a graph. First Parent follows a commit's first
  // parent alone, from every ref the log walks — a merged branch a ref
  // still names stays listed, on a lane of its own.
  const walked = useMemo(() => (firstParent ? firstParentOnly(entries) : entries), [entries, firstParent]);
  const filtered = useMemo(() => {
    if (matcher.kind !== 'match' && !noMerges && !firstParent) return entries;
    const roots =
      selectedRef === null ? [...refs.map((ref) => ref.sha), ...(detachedSha !== null ? [detachedSha] : [])] : [];
    const reached = firstParent ? firstParentReach(entries, roots) : null;
    return entries.filter(
      (entry) =>
        (reached === null || reached.has(entry.sha)) &&
        (matcher.kind !== 'match' || matcher.test(entry)) &&
        !(noMerges && isMergeCommit(entry)),
    );
  }, [entries, matcher, noMerges, firstParent, selectedRef, refs, detachedSha]);

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      const rows = map.get(ref.sha);
      if (rows !== undefined) rows.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [refs]);

  // HEAD's commit: the checked-out branch's tip, the detached sha, else
  // (a HEAD-scoped walk alone guarantees it) row 0.
  const headSha = useMemo(() => {
    const current = refs.find((ref) => ref.kind === 'local' && ref.name === currentRef);
    if (current !== undefined) return current.sha;
    if (detachedSha !== null) return detachedSha;
    return selectedRef === GIT_LOG_SCOPE_HEAD ? (entries[0]?.sha ?? null) : null;
  }, [refs, currentRef, detachedSha, selectedRef, entries]);

  // Graph edges are honest only over the contiguous log. A ROW filter
  // (author, date, paths, the walk riders) is the host's: the hidden
  // commits never reach the window, so rendering degrades to plain
  // dots (sort order alone keeps the graph) and no fragment collapses.
  // HEAD's commit names the lane that owns the shared history (the
  // trunk keeps one colour); a collapsed fragment hides its interior
  // rows and its skipping edge draws as the stubs.
  const graphHonest = filtered === entries && !rowFiltersActive;
  // The view's sifts hide rows of a window that still holds them, so
  // their list keeps a graph (the reference's reading): every listed
  // commit joined to the nearest listed commits it descends from, a
  // join through hidden commits drawn as the stubs.
  const searched = useMemo(
    () => (filtered !== entries && !rowFiltersActive ? contractLog(walked, new Set(filtered.map((e) => e.sha))) : null),
    [entries, walked, filtered, rowFiltersActive],
  );
  const shown = useMemo(
    () => (graphHonest ? collapseLog(entries, collapsed) : { entries: filtered, collapsedEdges: new Set<string>() }),
    [graphHonest, entries, filtered, collapsed],
  );
  // A branch head on a lane's own chain restarts the colour there (the
  // reference: the unpushed run reads apart from origin's).
  const branchHeads = useMemo(
    () => new Set(refs.filter((ref) => ref.kind === 'local' || ref.kind === 'remote').map((ref) => ref.sha)),
    [refs],
  );
  const graph = useMemo(() => {
    if (graphHonest) {
      return computeLogGraph(shown.entries, { headSha, collapsedEdges: shown.collapsedEdges, branchHeads });
    }
    if (searched === null) return null;
    // A listed commit wears the colour it has in the whole log.
    const whole = computeLogGraph(entries, { headSha, branchHeads });
    const colors = new Map(entries.map((entry, index) => [entry.sha, whole[index].color]));
    return computeLogGraph(searched.entries, { headSha, collapsedEdges: searched.skipped, colors });
  }, [graphHonest, shown, searched, entries, headSha, branchHeads]);
  // A fragment never crosses a ref'd commit or HEAD's.
  const anchors = useMemo(() => {
    const set = new Set(refsBySha.keys());
    if (headSha !== null) set.add(headSha);
    return set;
  }, [refsBySha, headSha]);
  const toggleFragment = useCallback((fragment: LogFragment) => {
    setCollapsed((prev) => {
      const next = new Map(prev);
      const key = fragmentKey(fragment);
      if (next.has(key)) next.delete(key);
      else next.set(key, fragment);
      return next;
    });
  }, []);
  // The gear's Collapse / Expand Linear Branches: every fragment of the
  // loaded window at once, or none — off while a filter hides the graph.
  const fragments = useMemo(() => (graphHonest ? allLinearFragments(entries, anchors) : []), [graphHonest, entries, anchors]);
  const canCollapseLinear = fragments.some((fragment) => !collapsed.has(fragmentKey(fragment)));
  const canExpandLinear = graphHonest && collapsed.size > 0;
  const collapseLinear = useCallback(
    () => setCollapsed(new Map(fragments.map((fragment) => [fragmentKey(fragment), fragment]))),
    [fragments],
  );
  const expandLinear = useCallback(() => setCollapsed(new Map()), []);

  const selected = useMemo(
    () => (selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null),
    [entries, selectedSha],
  );

  // What the toolbar's Cherry-Pick acts on: the selected set, else the one selected commit.
  const pickTargets = selectedShas.length > 0 ? selectedShas : selected !== null ? [selected.sha] : [];

  const selectedEntries = useMemo(() => {
    if (!multiSelected) return [];
    const bySha = new Map(entries.map((entry) => [entry.sha, entry]));
    return selectedShas.flatMap((sha) => {
      const entry = bySha.get(sha);
      return entry === undefined ? [] : [entry];
    });
  }, [multiSelected, entries, selectedShas]);
  const unionOfSelected = useMemo(() => unionFiles(selectedEntries), [selectedEntries]);
  const rangeBase = useMemo(
    () => (multiSelected ? contiguousRangeBase(selectedShas, entries) : null),
    [multiSelected, selectedShas, entries],
  );

  // What the files tree lists — the selected commit, or the set. The
  // tree is keyed by it, and the pane's file selection lives exactly as
  // long: a fresh commit selection starts with no file row selected,
  // and a refetch of the same log leaves the selected row its verbs.
  const filesKey =
    selected === null
      ? null
      : multiSelected
        ? `${tabKey}:${selectedShas.length}:${selectedShas[0]}:${selectedShas[selectedShas.length - 1]}`
        : `${tabKey}:${selected.sha}`;
  useEffect(() => {
    setSelectedFile(null);
    setSelectedEntity(null);
    setSelectedBase(undefined);
  }, [filesKey]);

  // What Show Diff reads: one commit's change, or the run's range from
  // its base to its newest commit; null while a gapped set is selected.
  const diffTarget = useMemo<{ sha: string; base?: string } | null>(() => {
    if (multiSelected) return rangeBase === null ? null : { sha: selectedShas[0], base: rangeBase };
    return selected === null ? null : { sha: selected.sha };
  }, [multiSelected, rangeBase, selectedShas, selected]);

  // Highlight > Current Branch: the commits reachable from HEAD carry
  // the reference's soft band under everything else — the host's
  // containment flags (the window walk from HEAD's commit when a host
  // sends none), off with the preference and withheld on the HEAD /
  // current-branch scope (the pure rule).
  const currentBranchShas = useMemo(() => {
    if (!prefs.highlightCurrentBranch) return null;
    const tip = currentBranchBandTip(headSha, {
      selectedRef,
      headScope: GIT_LOG_SCOPE_HEAD,
      currentBranch: currentRef ?? branch,
    });
    return tip === null ? null : bandShas(tip, entries);
  }, [prefs.highlightCurrentBranch, headSha, selectedRef, currentRef, branch, entries]);

  // The branch gitStatus reports but listRefs doesn't: an unborn HEAD
  // (fresh repo, first commit pending). Shown as the current branch in
  // the Local group; its name must never scope `log` — the membership
  // gate would refuse it — so selecting it is HEAD scope.
  const unbornBranch = useMemo(
    () => (branch !== null && !refs.some((ref) => ref.kind === 'local' && ref.name === branch) ? branch : null),
    [branch, refs],
  );

  const navigateToSha = (sha: string): void => {
    patchTab({ selectedSha: sha });
    setScrollTo((prev) => ({ sha, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const combinedError =
    error ?? (fileDiff.error !== null ? t('workbench.gitLog.loadFailed', { detail: fileDiff.error }) : null);

  const filtersActive =
    matcher.kind !== 'none' || selectedRef !== null || rowFiltersActive || noMerges || firstParent;
  const resetFilters = (): void =>
    patchTab({
      filter: '',
      selectedRef: null,
      author: null,
      date: null,
      paths: [],
      noMerges: false,
      firstParent: false,
    });

  // A deleted branch leaves the rail selection and the scope that named it.
  const actions = useGitBranchActions({
    workspaceId,
    currentRef,
    refs,
    container,
    onBranchDeleted: (deleted) => {
      const patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>> = {};
      if (railSelection !== null && railSelection.kind === 'local' && railSelection.name === deleted) {
        patch.railSelection = null;
      }
      if (selectedRef === deleted) patch.selectedRef = null;
      if (Object.keys(patch).length > 0) patchTab(patch);
    },
  });

  // The commit rows' menu: the clipboard read, the patch of the set,
  // the pick and the revert of the set, the detached checkout, the New Branch and New Tag dialogs anchored
  // at the commit, and the parent / child walk.
  const rowMenu = (target: LogRowMenuTarget): ReturnType<typeof buildLogRowMenu> =>
    buildLogRowMenu(target, t, {
      onCopyRevision: (shas) => void navigator.clipboard.writeText(shas.join('\n')),
      onCreatePatch: commitPatch.createPatch,
      onCopyAsPatch: commitPatch.copyAsPatch,
      onCherryPick: commitApply.cherryPick,
      onRevert: commitApply.revert,
      onNewBranchFrom: actions.newBranchFrom,
      onNewTagAt: actions.newTagAt,
      onCheckoutRevision: actions.checkoutRevision,
      onNavigate: navigateToSha,
    });

  const placeholderStyle: React.CSSProperties = {
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: token.colorTextSecondary,
  };

  // A file of a merge reads against the parent its group is of.
  const openDiff = (path: string, base?: string): void => {
    if (diffTarget !== null) void fileDiff.open(diffTarget.sha, path, base ?? diffTarget.base);
  };

  // The changed-file row menu: Show Diff reads the selected commit's
  // blob pair or the run's range; Show History opens the path's own
  // timeline. An entity's row that lists several files has no path —
  // the two file verbs hold and Jump to Source opens the entity.
  const fileRowMenu = (
    path: string | null,
    entity?: WorkspaceTreeEntityRefWire,
    base?: string,
  ): ReturnType<typeof buildFileRowMenu> =>
    buildFileRowMenu(t, {
      ...(diffTarget === null || path === null ? {} : { onShowDiff: () => openDiff(path, base) }),
      ...(path === null ? {} : { onShowHistory: () => setHistoryPath(path) }),
      onJumpToSource: () => jumpToSource(path, entity),
    });

  return (
    <div
      ref={rootRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      data-testid="git-tool-view"
    >
      {combinedError !== null && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '4px 12px',
            fontSize: 12,
            color: token.colorError,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
          data-testid="git-tool-error"
        >
          {combinedError}
        </div>
      )}
      <div
        ref={gridRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: layout.columns,
          gridTemplateRows: 'minmax(0, 1fr)',
        }}
        data-testid="git-tool-split"
      >
        <div
          ref={railCellRef}
          style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex' }}
          data-testid="git-tool-rail-cell"
        >
          {refsCollapsed ? (
            <GitRailCollapsedStrip onExpand={() => patchTab({ refsCollapsed: false })} />
          ) : (
            <GitRefRail
            workspaceId={workspaceId}
            refs={refs}
            currentRef={currentRef}
            unbornBranch={unbornBranch}
            detachedSha={detachedSha}
            historyRewritten={historyRewritten}
            actions={actions}
            selection={railSelection}
            onSelectionChange={(selection) => patchTab({ railSelection: selection })}
            scopeRef={selectedRef}
            onScopeChange={(ref) => patchTab({ selectedRef: ref })}
            onNavigateToSha={navigateToSha}
            onOpenCompare={onOpenCompare}
            onHide={() => patchTab({ refsCollapsed: true })}
          />
          )}
          {!refsCollapsed && <Sash axis="x" edge="end" begin={layout.beginRail} onReset={layout.resetRail} />}
        </div>
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <GitLogToolbar
            tab={tab}
            patchTab={patchTab}
            refs={refs}
            favorites={favoriteSet}
            onToggleFavorite={(kind, name) => toggleGitRailFavorite(workspaceId, kind, name, defaultFavorites)}
            entries={entries}
            loading={loading}
            onRefresh={() => void reload()}
            onCherryPick={pickTargets.length > 0 ? () => commitApply.cherryPick(pickTargets) : undefined}
            onNavigate={navigateToSha}
            prefs={prefs}
            onPatchPrefs={(patch) => patchGitLogViewPrefs(workspaceId, patch)}
            canCollapseLinear={canCollapseLinear}
            onCollapseLinear={collapseLinear}
            canExpandLinear={canExpandLinear}
            onExpandLinear={expandLinear}
            textInvalid={matcher.kind === 'invalid'}
            container={container}
          />
          <CommitList
            entries={shown.entries}
            graph={graph}
            refsBySha={refsBySha}
            headSha={headSha}
            currentBranchShas={currentBranchShas}
            selectedSha={selectedSha}
            onSelect={(sha) => patchTab({ selectedSha: sha })}
            onSelectionChange={setSelectedShas}
            filtersActive={filtersActive}
            onResetFilters={resetFilters}
            matchRanges={matcher.kind === 'match' ? matcher.ranges : undefined}
            fragments={graphHonest}
            scrollTo={scrollTo}
            compactRefs={prefs.compactReferences}
            refsOnLeft={prefs.referencesOnLeft}
            showTagChips={prefs.showTagNames}
            showTimestamp={prefs.showCommitTimestamp}
            showAuthor={prefs.showAuthorColumn}
            showHash={prefs.showHashColumn}
            showDate={prefs.showDateColumn}
            dimMergeCommits={prefs.highlightMergeCommits}
            hourCycle={hourCycle}
            anchors={anchors}
            collapsed={collapsed}
            onToggleFragment={toggleFragment}
            rowMenu={rowMenu}
          />
        </div>
        <div
          ref={detailsCellRef}
          style={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          data-testid="git-tool-detail"
        >
          <Sash axis="x" edge="start" begin={layout.beginDetails} onReset={layout.resetDetails} />
          <GitDetailsToolbar
            canShowDiff={diffTarget !== null && selectedFile !== null}
            onShowDiff={() => {
              if (selectedFile !== null) openDiff(selectedFile, selectedBase);
            }}
            onJumpToSource={() => jumpToSource(selectedFile, selectedEntity ?? undefined)}
            canJumpToSource={selectedFile !== null || selectedEntity !== null}
            prefs={prefs}
            onPatchPrefs={(patch) => patchGitLogViewPrefs(workspaceId, patch)}
            hasFiles={selected !== null}
            onExpandAll={() => fileTreeRef.current?.expandAll()}
            onCollapseAll={() => fileTreeRef.current?.collapseAll()}
          />
          <div
            ref={detailBodyRef}
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'grid',
              gridTemplateRows: layout.detailRows,
              gridTemplateColumns: 'minmax(0, 1fr)',
            }}
            data-testid="git-tool-detail-body"
          >
            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {selected === null ? (
                <div style={placeholderStyle} data-testid="git-tool-detail-placeholder">
                  {t('workbench.gitLog.selectCommit')}
                </div>
              ) : (
                <CommitFilesView
                  key={filesKey}
                  ref={fileTreeRef}
                  files={multiSelected ? unionOfSelected : selected.files}
                  {...(multiSelected ? {} : { commit: selected })}
                  workspaceId={workspaceId}
                  sha={selected.sha}
                  loadingPath={fileDiff.loadingPath}
                  // ⋯ > Show on Double-Click: the diff, or the entity's editor.
                  onOpenFile={(path, entity, base) => {
                    if (prefs.doubleClickOpens === 'source') jumpToSource(path, entity);
                    else openDiff(path, base);
                  }}
                  selectedPath={selectedFile}
                  onSelectFile={(path, entity, base) => {
                    setSelectedFile(path);
                    setSelectedEntity(entity ?? null);
                    setSelectedBase(base);
                  }}
                  groupByWorkspace={prefs.groupFilesByWorkspace}
                  groupByDirectory={prefs.groupFilesByDirectory}
                  rowMenu={fileRowMenu}
                />
              )}
            </div>
            {prefs.showDetails && (
              <div
                ref={infoCellRef}
                style={{
                  position: 'relative',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
                data-testid="git-tool-detail-info-cell"
              >
                <Sash axis="y" edge="start" begin={layout.beginInfo} onReset={layout.resetInfo} />
                {selected === null ? (
                  <div style={placeholderStyle} data-testid="git-tool-detail-none">
                    {t('workbench.gitLog.noneSelected')}
                  </div>
                ) : multiSelected ? (
                  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }} data-testid="git-tool-detail-multi">
                    {selectedEntries.map((entry) => (
                      <div key={entry.sha} style={{ padding: '6px 0 10px' }} data-testid="git-tool-detail-card">
                        <CommitDetails
                          entry={entry}
                          refsAtCommit={refsBySha.get(entry.sha) ?? []}
                          isHead={entry.sha === headSha}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                    <CommitDetails
                      entry={selected}
                      refsAtCommit={refsBySha.get(selected.sha) ?? []}
                      isHead={selected.sha === headSha}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {actions.dialogs}
      {commitApply.dialogs}
      <DiffModal diff={fileDiff.diff} onClose={fileDiff.close} />
      <FileHistoryModal
        workspaceId={workspaceId}
        path={historyPath}
        container={container}
        onClose={() => setHistoryPath(null)}
      />
    </div>
  );
};

export default GitLogView;

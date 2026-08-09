/**
 * GitLogView — ONE log tab's view, the IDE-log anatomy: three
 * sub-panes (branches rail, commit timeline, changes/details), EACH
 * owning its slice of the shared top band — the rail's Branch-or-tag
 * search, the log toolbar (text filter + Branch/User/Date/Paths chips
 * + Graph Options + actions), and the details toolbar (Show Diff /
 * View Options / expand-collapse). Self-sufficient per pane: it
 * fetches its own refs + log for its tab's scope and filters and
 * refetches on `workspaceTreeGitStatus` frames. Filter state lives in
 * the tab registry (travels with the tab); display prefs are
 * per-workspace. Hiding the rail swaps section #1 for the vertical
 * Branches strip (the IDE-log gesture).
 */

import {
  hostBridge,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import CommitDetails from './CommitDetails';
import CommitList from './CommitList';
import DiffModal from './DiffModal';
import FileTreeView, { type FileTreeViewHandle } from './FileTreeView';
import { getGitLogViewPrefs, patchGitLogViewPrefs, subscribeGitLogViewPrefs } from './git-log-view-prefs';
import { type GitLogTabState, gitPanelTabKey } from './git-panel-view-store';
import { computeLogGraph } from './graph';
import { getGitRailPrefs, subscribeGitRailPrefs } from './rail/git-rail-prefs';
import GitRailCollapsedStrip from './rail/GitRailCollapsedStrip';
import GitRefRail from './rail/GitRefRail';
import GitDetailsToolbar from './toolbar/GitDetailsToolbar';
import GitLogToolbar from './toolbar/GitLogToolbar';
import { buildLogWireFilters, hasRowFilters, makeTextMatcher } from './toolbar/log-filters';
import { useFileDiff } from './use-file-diff';

export interface GitLogViewProps {
  workspaceId: string;
  tab: GitLogTabState;
  /** Checked-out branch from the panel's status feed (unborn included). */
  branch: string | null;
  patchTab: (patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>) => void;
  /** Open a Compare-with-Current tab (registry gesture — the renderer wires it). */
  onOpenCompare: (ref: string) => void;
}

const LOG_LIMIT = 200;

const GitLogView: React.FC<GitLogViewProps> = ({ workspaceId, tab, branch, patchTab, onOpenCompare }) => {
  const { token } = theme.useToken();
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileTreeRef = useRef<FileTreeViewHandle>(null);

  const [entries, setEntries] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<{ sha: string; nonce: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileDiff = useFileDiff(workspaceId);

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
  const favoriteSet = useMemo<ReadonlySet<string>>(() => new Set(railPrefs.favorites), [railPrefs.favorites]);

  const { selectedRef, filter, filterRegex, filterCase, selectedSha, refsCollapsed, railSelection } = tab;
  const { author, date, paths, sort, firstParent, noMerges } = tab;
  const tabKey = gitPanelTabKey(tab);
  const rowFiltersActive = hasRowFilters(tab);
  // Keyed on the filter fields alone — a selection or rail patch must
  // never refetch the log.
  const wireFilters = useMemo(
    () => buildLogWireFilters({ author, date, paths, sort, firstParent, noMerges }, new Date()),
    [author, date, paths, sort, firstParent, noMerges],
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
      // IDE posture: `Branch: main` chip + no-matches empty state) —
      // its name exists only in `gitStatus`, so `log` would refuse it.
      const knownRefs = refsResult.ok ? refsResult.refs : [];
      const scopeIsUnborn =
        selectedRef !== null &&
        selectedRef === branch &&
        !knownRefs.some((ref) => ref.kind === 'local' && ref.name === selectedRef);
      if (scopeIsUnborn) {
        setEntries([]);
        return;
      }
      const result = await hostBridge.call('oh.workspaceTree.log', {
        workspaceId,
        limit: LOG_LIMIT,
        ...(selectedRef !== null ? { ref: selectedRef } : {}),
        ...wireFilters,
      });
      if (result.ok) {
        setEntries(result.entries);
      } else if (result.reason === 'unknown-ref') {
        // The scoped ref vanished (branch deleted, tag dropped) —
        // fall back to HEAD; the effect below refetches.
        patchTab({ selectedRef: null });
      } else {
        setEntries([]);
        setError(t('workbench.gitLog.loadFailed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setEntries([]);
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

  // A fresh commit selection starts with no file row selected.
  useEffect(() => {
    setSelectedFile(null);
  }, [selectedSha]);

  const matcher = useMemo(() => makeTextMatcher(filter, filterRegex, filterCase), [filter, filterRegex, filterCase]);

  const filtered = useMemo(() => {
    if (matcher.kind !== 'match') return entries;
    return entries.filter((entry) => matcher.test(entry));
  }, [entries, matcher]);

  // Graph edges are honest only over the contiguous log — a text filter
  // or any row filter hides commits, so rendering degrades to plain
  // dots (sort order alone keeps the graph).
  const graph = useMemo(
    () => (filtered === entries && !rowFiltersActive ? computeLogGraph(entries) : null),
    [filtered, entries, rowFiltersActive],
  );

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      const rows = map.get(ref.sha);
      if (rows !== undefined) rows.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [refs]);

  const headSha = useMemo(() => {
    const current = refs.find((ref) => ref.kind === 'local' && ref.name === currentRef);
    if (current !== undefined) return current.sha;
    return selectedRef === null ? (entries[0]?.sha ?? null) : null;
  }, [refs, currentRef, selectedRef, entries]);

  const selected = useMemo(
    () => (selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null),
    [entries, selectedSha],
  );

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

  const filtersActive = matcher.kind !== 'none' || selectedRef !== null || rowFiltersActive;
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

  const container = rootRef.current?.closest<HTMLElement>('.git-tool-panel') ?? null;

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
      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {refsCollapsed ? (
          <GitRailCollapsedStrip onExpand={() => patchTab({ refsCollapsed: false })} />
        ) : (
          <GitRefRail
            workspaceId={workspaceId}
            refs={refs}
            currentRef={currentRef}
            unbornBranch={unbornBranch}
            selection={railSelection}
            onSelectionChange={(selection) => patchTab({ railSelection: selection })}
            scopeRef={selectedRef}
            onScopeChange={(ref) => patchTab({ selectedRef: ref })}
            onNavigateToSha={navigateToSha}
            onOpenCompare={onOpenCompare}
            onHide={() => patchTab({ refsCollapsed: true })}
          />
        )}
        <div
          style={{
            flex: '1 1 55%',
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
            currentRef={currentRef}
            favorites={favoriteSet}
            entries={entries}
            loading={loading}
            onRefresh={() => void reload()}
            onNavigate={navigateToSha}
            prefs={prefs}
            onPatchPrefs={(patch) => patchGitLogViewPrefs(workspaceId, patch)}
            textInvalid={matcher.kind === 'invalid'}
            container={container}
          />
          <CommitList
            entries={filtered}
            graph={graph}
            refsBySha={refsBySha}
            selectedSha={selectedSha}
            onSelect={(sha) => patchTab({ selectedSha: sha })}
            filtersActive={filtersActive}
            onResetFilters={resetFilters}
            scrollTo={scrollTo}
            showTagChips={prefs.showTagNames}
            showTimestamp={prefs.showCommitTimestamp}
            dimMergeCommits={prefs.highlightMergeCommits}
          />
        </div>
        <div
          style={{ flex: '1 1 45%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          data-testid="git-tool-detail"
        >
          <GitDetailsToolbar
            canShowDiff={selected !== null && selectedFile !== null}
            onShowDiff={() => {
              if (selected !== null && selectedFile !== null) void fileDiff.open(selected.sha, selectedFile);
            }}
            prefs={prefs}
            onPatchPrefs={(patch) => patchGitLogViewPrefs(workspaceId, patch)}
            onExpandAll={() => fileTreeRef.current?.expandAll()}
            onCollapseAll={() => fileTreeRef.current?.collapseAll()}
          />
          {selected === null ? (
            <>
              <div
                style={{
                  flex: '1 1 55%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
                data-testid="git-tool-detail-placeholder"
              >
                {t('workbench.gitLog.selectCommit')}
              </div>
              {prefs.showDetails && (
                <div
                  style={{
                    flex: '1 1 45%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: token.colorTextSecondary,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                  }}
                  data-testid="git-tool-detail-none"
                >
                  {t('workbench.gitLog.noneSelected')}
                </div>
              )}
            </>
          ) : (
            <>
              <FileTreeView
                key={`${tabKey}:${selected.sha}`}
                ref={fileTreeRef}
                files={selected.files}
                loadingPath={fileDiff.loadingPath}
                onOpenFile={(path) => void fileDiff.open(selected.sha, path)}
                selectedPath={selectedFile}
                onSelectFile={setSelectedFile}
                groupByDirectory={prefs.groupFilesByDirectory}
              />
              {prefs.showDetails && (
                <div
                  style={{
                    flex: '1 1 45%',
                    minHeight: 0,
                    overflowY: 'auto',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <CommitDetails
                    entry={selected}
                    refsAtCommit={refsBySha.get(selected.sha) ?? []}
                    isHead={selected.sha === headSha}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DiffModal diff={fileDiff.diff} onClose={fileDiff.close} />
    </div>
  );
};

export default GitLogView;

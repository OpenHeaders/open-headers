/**
 * GitLogView — ONE log tab's view, the log-window anatomy: three
 * sub-panes (branches rail, commit timeline, changes/details), EACH
 * owning its slice of the shared top band — the rail's Branch-or-tag
 * search, the log toolbar (text filter + Branch/User/Date/Paths chips
 * + Graph Options + actions), and the details toolbar (Show Diff /
 * View Options / expand-collapse). Filter state lives in the tab
 * registry (travels with the tab); display prefs are per-workspace.
 * Hiding the rail swaps section #1 for the vertical Branches strip (the
 * log-window gesture).
 *
 * The timeline lists the WHOLE history its scope reaches. The host
 * keeps the list the tab asks for (`log-rows-ask.ts`) and the view
 * reads the rows it shows (`use-log-rows.ts`), listed by row number
 * (`LogRowList`). What stands beside the list reads through it: the
 * tab's one commit as a row (`use-log-tab-row.ts`), the selected rows'
 * commits for the details, the files, the pick and the patch
 * (`use-selected-commits.ts`), the signatures of the rows in view.
 *
 * An applied text sifts the list's first page at once and, where the
 * list is longer than that, is asked of the whole history
 * (`use-log-search.ts`): an answer that reaches past the page takes
 * the list — the host's page, in its order, with no graph. Either is
 * a list of named commits (`CommitList`), and everything beside it
 * reads the commits that are listed.
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

import type {
  WorkspaceTreeEntityRefWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeLogRunWire,
  WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { makeLogTextMatcher } from '@openheaders/core/workspace-tree';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { Sash } from '@openheaders/ui/shared/dock-layout';
import { useRowSelection } from '@openheaders/ui/shared/selection';
import { useGitBranchActions } from './branch-actions/use-git-branch-actions';
import { contiguousRangeBase, unionFiles } from './changed-files-union';
import { commitsApply } from './commit-apply';
import CommitDetails from './CommitDetails';
import CommitFilesView from './CommitFilesView';
import CommitList from './CommitList';
import type { CommitRowColumns } from './CommitRowCells';
import DiffModal from './DiffModal';
import { buildFileRowMenu } from './file-row-menu';
import FileHistoryModal from './FileHistoryModal';
import type { FileTreeViewHandle } from './FileTreeView';
import {
  getGitLogRecentFilters,
  nameGitLogPaths,
  rememberGitLogFilter,
  subscribeGitLogRecentFilters,
} from './git-log-recent-filters';
import { getGitLogViewPrefs, patchGitLogViewPrefs, subscribeGitLogViewPrefs } from './git-log-view-prefs';
import { GIT_LOG_SCOPE_HEAD, type GitLogTabState, gitPanelTabKey } from './git-panel-view-store';
import GitWorkingLine from './GitWorkingLine';
import { ALL_LOG_FOLDS, canFoldAll, canUnfoldAll, NO_LOG_FOLDS, toggleLogFold } from './log-folds';
import { buildLogRowMenu, type LogRowMenuHandlers } from './log-row-menu';
import { logRowMenuTarget } from './log-row-menu-target';
import {
  firstLogRows,
  heldLogAuthors,
  LOG_PAGE_ROWS,
  type LogRowRange,
  logRowAt,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
} from './log-row-pages';
import { logListingName, logRowsAsk } from './log-rows-ask';
import { type GitLogScope, scopeShowsCurrentBranch, scopeWithout } from './log-scope';
import { logSearchFace, logSearchRequest } from './log-search';
import { type SelectedSet, shownSelectedSet } from './log-selected-commits';
import { siftLogWindow } from './log-sifted-window';
import LogRowList from './LogRowList';
import { getGitRailPrefs, subscribeGitRailPrefs, toggleGitRailFavorite } from './rail/git-rail-prefs';
import { defaultFavoriteKeys, favoriteKeys } from './rail/ref-favorites';
import GitRailCollapsedStrip from './rail/GitRailCollapsedStrip';
import GitRefRail from './rail/GitRefRail';
import GitDetailsToolbar from './toolbar/GitDetailsToolbar';
import GitLogToolbar from './toolbar/GitLogToolbar';
import { buildLogWireFilters, hasRowFilters } from './toolbar/log-filters';
import { useCommitApply } from './use-commit-apply';
import { useCommitPatch } from './use-commit-patch';
import { useCommitSignatures } from './use-commit-signatures';
import { useFileDiff } from './use-file-diff';
import { useJumpToSource } from './use-jump-to-source';
import { useLogRefs } from './use-log-refs';
import { useLogRows } from './use-log-rows';
import { useLogRowsInView } from './use-log-rows-in-view';
import { useLogSearch } from './use-log-search';
import { useLogTabRow } from './use-log-tab-row';
import { useGitLogLayout } from './use-git-log-layout';
import { useLogHourCycle } from './use-log-hour-cycle';
import { useSelectedCommits } from './use-selected-commits';

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

const NO_COMMITS: readonly WorkspaceTreeLogEntryWire[] = [];
const NO_SELECTION: SelectedSet = { kind: 'none' };

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
  const gridRef = useRef<HTMLDivElement>(null);
  const railCellRef = useRef<HTMLDivElement>(null);
  const detailsCellRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const infoCellRef = useRef<HTMLDivElement>(null);
  const fileTreeRef = useRef<FileTreeViewHandle>(null);

  // Presses of Refresh: each reads the log again and asks a search again.
  const [refreshes, setRefreshes] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // The entity the files tree names for the selection (Group By
  // Workspace) — what Jump to Source opens, a row that lists several
  // files included; set with the file, by the one report.
  const [selectedEntity, setSelectedEntity] = useState<WorkspaceTreeEntityRefWire | null>(null);
  // The commit the selected file's change is read against, where the
  // files are listed by parent (a merge's); set with the file.
  const [selectedBase, setSelectedBase] = useState<string | undefined>(undefined);
  // A search's list selects by commit: its selection in list order, and the commit a navigation brings into view.
  const [searchShas, setSearchShas] = useState<readonly string[]>([]);
  const [searchScrollTo, setSearchScrollTo] = useState<{ sha: string; nonce: number } | null>(null);
  const [historyPath, setHistoryPath] = useState<string | null>(null);
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
  const { refs, current: currentRef, read: refsRead, reload: reloadRefs } = useLogRefs(workspaceId);
  const defaultFavorites = useMemo(() => defaultFavoriteKeys(refs, currentRef), [refs, currentRef]);
  const favoriteSet = useMemo<ReadonlySet<string>>(
    () => favoriteKeys(railPrefs, defaultFavorites),
    [railPrefs, defaultFavorites],
  );

  const subscribeRecentFilters = useCallback(
    (listener: () => void) => subscribeGitLogRecentFilters(workspaceId, listener),
    [workspaceId],
  );
  const recentFilters = useSyncExternalStore(subscribeRecentFilters, () => getGitLogRecentFilters(workspaceId));

  const { selectedRefs, filter, filterRegex, filterCase, selectedSha, refsCollapsed, railSelection, folds } = tab;
  // A filter the person applies — from a chip's menu, its field or the rail — is remembered as a recent one.
  const applyScope = (scope: GitLogScope): void => {
    patchTab({ selectedRefs: scope });
    rememberGitLogFilter(workspaceId, 'scopes', scope);
  };
  const applyUsers = (users: readonly string[]): void => {
    patchTab({ author: users.length === 0 ? null : { kind: 'users', values: users } });
    rememberGitLogFilter(workspaceId, 'users', users);
  };
  const applyPaths = (next: readonly string[], names?: Readonly<Record<string, string>>): void => {
    patchTab({ paths: next });
    rememberGitLogFilter(workspaceId, 'paths', next);
    if (names !== undefined) nameGitLogPaths(workspaceId, names);
  };
  const layout = useGitLogLayout(
    workspaceId,
    { root: gridRef, rail: railCellRef, details: detailsCellRef, detailBody: detailBodyRef, info: infoCellRef },
    { railCollapsed: refsCollapsed, showInfo: prefs.showDetails },
  );
  const { author, date, paths, sort, firstParent, noMerges } = tab;
  const tabKey = gitPanelTabKey(tab);
  const rowFiltersActive = hasRowFilters(tab);
  // Keyed on the filter fields alone — a selection or rail patch must
  // never ask for the list again.
  const wireFilters = useMemo(
    () => buildLogWireFilters({ author, date, paths, sort }, new Date()),
    [author, date, paths, sort],
  );

  // `patchTab` is a function the tab group makes anew on every render
  // of its own (a resize of the window, a theme change, a click that
  // focuses the pane): whatever must stand still reaches the newest one
  // through a ref, and reads the tab as it stands then.
  const live = useRef({ patchTab, tab });
  live.current = { patchTab, tab };
  const setSelectedSha = useCallback((sha: string | null): void => live.current.patchTab({ selectedSha: sha }), []);

  // The branch gitStatus reports but listRefs doesn't: an unborn HEAD
  // (fresh repo, first commit pending). Shown as the current branch in
  // the Local group; its name must never scope the log — the host would
  // refuse it — so selecting it is HEAD scope.
  const unbornBranch = useMemo(
    () =>
      refsRead && branch !== null && !refs.some((ref) => ref.kind === 'local' && ref.name === branch) ? branch : null,
    [refsRead, branch, refs],
  );
  // The unborn current branch has no history to walk: alone it scopes
  // to an EMPTY filtered list (the reference posture: `Branch: main`
  // chip + no-matches empty state), beside other refs it adds nothing.
  const walked = useMemo(
    () => (unbornBranch === null ? selectedRefs : scopeWithout(selectedRefs, [unbornBranch])),
    [selectedRefs, unbornBranch],
  );
  // A scope that names the checked-out branch waits for the refs: until they are read it may be the unborn one.
  const scopeKnown = refsRead || branch === null || !selectedRefs.includes(branch);
  const nothingListed = selectedRefs.length > 0 && walked.length === 0;

  // What the tab asks the host to list — one object while what it asks stands.
  const ask = useMemo(
    () =>
      !scopeKnown || nothingListed
        ? null
        : logRowsAsk({ workspaceId, key: tabKey, scope: walked, filters: wireFilters, noMerges, firstParent, folds }),
    [scopeKnown, nothingListed, workspaceId, tabKey, walked, wireFilters, noMerges, firstParent, folds],
  );
  const rows = useLogRows(ask);
  const refusal = rows.refusal;

  // Scoped refs vanished (branch deleted, tag dropped): the scope keeps
  // the rest — every ref once none is left — and the new scope is
  // asked. A host that names none clears the scope.
  useEffect(() => {
    if (refusal === null || refusal.reason !== 'unknown-ref') return;
    const scope = live.current.tab.selectedRefs;
    const kept = scopeWithout(scope, refusal.unknownRefs ?? scope);
    live.current.patchTab({ selectedRefs: kept.length < scope.length ? kept : [] });
  }, [refusal]);
  const refused = refusal !== null && refusal.reason !== 'unknown-ref' ? refusal : null;

  // The list drawn: the rows held — none under a refusal, whose rows would be another ask's.
  const held = refused === null ? rows.held : NO_LOG_ROWS;
  // The held rows are the ask's own: until then the ask before's stay drawn.
  const landed = ask !== null && held.ask === ask;
  const pending = rows.pending || !scopeKnown;

  // The press of Refresh: the host looks at the repo again, and the window answers with its sign of work.
  const pressRefresh = useCallback((): void => {
    rows.refresh();
    void reloadRefs();
    setRefreshes((count) => count + 1);
  }, [rows.refresh, reloadRefs]);

  const matcher = useMemo(() => makeLogTextMatcher(filter, filterRegex, filterCase), [filter, filterRegex, filterCase]);
  const searches = matcher.kind === 'match';

  // A text sifts the list's first page — its newest rows — at once. The
  // page is kept while a text is applied: the list over row numbers is
  // not mounted then, and nothing else asks for it.
  const wantRows = rows.want;
  useEffect(() => {
    if (searches) wantRows(NO_LOG_ROW_RANGE);
  }, [searches, wantRows]);
  const firstRows = useMemo(() => (landed ? firstLogRows(held) : null), [landed, held]);
  const firstCommits = useMemo(() => firstRows?.map((row) => row.entry) ?? NO_COMMITS, [firstRows]);

  // The text asked of the whole history. Only where the list is longer
  // than its first page: a shorter one is held whole, and the sift
  // below is already exact. The request is one object while what it
  // asks stands, so a status frame alone asks nothing.
  const pageHeld = firstRows !== null;
  const listLonger = held.total > LOG_PAGE_ROWS;
  const searchRequest = useMemo(() => {
    if (!searches || !pageHeld || !listLonger) return null;
    return logSearchRequest({
      workspaceId,
      key: tabKey,
      text: filter,
      regex: filterRegex,
      matchCase: filterCase,
      scope: walked,
      filters: wireFilters,
      noMerges,
      firstParent,
      limit: LOG_PAGE_ROWS,
    });
  }, [
    searches,
    pageHeld,
    listLonger,
    workspaceId,
    tabKey,
    filter,
    filterRegex,
    filterCase,
    walked,
    wireFilters,
    noMerges,
    firstParent,
  ]);
  // What an answer stands on besides what was asked: where the refs
  // and HEAD point. A frame that moves none of them leaves it standing.
  const tips = useMemo(
    () => [...refs.map((ref) => `${ref.kind} ${ref.name} ${ref.sha}`), currentRef ?? '', detachedSha ?? ''].join('\n'),
    [refs, currentRef, detachedSha],
  );
  const search = useLogSearch(
    searchRequest,
    `${tips}\n${refreshes}`,
    `${filter}\n${filterRegex}\n${filterCase}\n${refreshes}`,
  );
  const searchFace = useMemo(() => logSearchFace(firstCommits, search.answer), [firstCommits, search.answer]);
  // The host's page, when its answer reaches past the list's first.
  const page = searchFace.kind === 'page' ? searchFace.entries : null;

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      const at = map.get(ref.sha);
      if (at !== undefined) at.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [refs]);

  // HEAD's commit: the checked-out branch's tip, the detached sha, else
  // (a HEAD-scoped walk alone guarantees it) the list's first row.
  const firstSha = logRowAt(held, 0)?.entry.sha ?? null;
  const headSha = useMemo(() => {
    const current = refs.find((ref) => ref.kind === 'local' && ref.name === currentRef);
    if (current !== undefined) return current.sha;
    if (detachedSha !== null) return detachedSha;
    return selectedRefs.length === 1 && selectedRefs[0] === GIT_LOG_SCOPE_HEAD ? firstSha : null;
  }, [refs, currentRef, detachedSha, selectedRefs, firstSha]);

  // The sift keeps a graph (the reference's reading): every listed
  // commit joined to the nearest listed commits it descends from. A
  // page past the list's first is the host's: its commits are listed
  // as the host found them, with no graph between them.
  const sifted = useMemo(
    () =>
      matcher.kind === 'match' && firstRows !== null && page === null ? siftLogWindow(firstRows, matcher.test) : null,
    [matcher, firstRows, page],
  );
  // The commits a search lists — and everything beside its list reads these.
  const searchCommits = page ?? sifted?.entries ?? NO_COMMITS;

  // What the list says under its last row: matches past the page, or a
  // search past the first page that did not finish. An EMPTY sift while
  // the host is still asked — or the page still read — says so: "no
  // matches" is not known yet.
  const searchUnanswered = search.pending || (searches && !pageHeld && ask !== null);
  const searchNote = !searches
    ? null
    : searchUnanswered && searchCommits.length === 0
      ? t('workbench.gitLog.search.searching')
      : searchFace.kind === 'page'
        ? searchFace.more
          ? t('workbench.gitLog.search.more', { count: searchFace.entries.length })
          : null
        : searchFace.kind === 'timeout'
          ? t(
              searchCommits.length === 0 ? 'workbench.gitLog.search.timeoutEmpty' : 'workbench.gitLog.search.timeout',
              { count: firstCommits.length },
            )
          : null;

  // Highlight > Current Branch: the commits the checked-out one reaches
  // carry the reference's soft band — the host's flag on every row —
  // off with the preference and withheld on the HEAD / current-branch
  // scope. A page past the list's first never bands: its rows carry no
  // flag.
  const band =
    prefs.highlightCurrentBranch && headSha !== null && scopeShowsCurrentBranch(selectedRefs, currentRef ?? branch);
  const searchBand = useMemo(
    () =>
      band && sifted !== null
        ? new Set(sifted.entries.filter((entry) => entry.onHead === true).map((entry) => entry.sha))
        : null,
    [band, sifted],
  );

  // A row number means something under the list's two names: the
  // selection is that list's, and gone with it.
  const listName = useMemo(() => ({ ask: held.ask, list: held.list }), [held.ask, held.list]);
  const selection = useRowSelection(listName);
  const { ranges } = selection.selection;

  // What the person is looking at: a listing — the ask before its folds
  // — or a search over it. Another one is looked at from its top.
  const listing = useMemo(
    () => (ask === null ? null : `${logListingName(ask)}${searches ? '\nsearch' : ''}`),
    [ask, searches],
  );
  const tabRow = useLogTabRow(held, listing, landed, selectedSha, setSelectedSha);

  // The selected commits, newest first — the list's rows read through,
  // or the search's own. Two or more and the details pane shows their
  // files as ONE set with a card per commit below (the reference
  // reading); a contiguous first-parent run also diffs as the range, a
  // gapped set has no diff.
  const rowSet = useSelectedCommits(held, ranges);
  const searchSet = useMemo<SelectedSet>(() => {
    const bySha = new Map(searchCommits.map((entry) => [entry.sha, entry]));
    const entries = searchShas.flatMap((sha) => {
      const entry = bySha.get(sha);
      return entry === undefined ? [] : [entry];
    });
    return entries.length === 0 ? NO_SELECTION : { kind: 'commits', entries };
  }, [searchCommits, searchShas]);
  const set = searches ? searchSet : rowSet;
  // What the panes show: the set — held as it was while its commits are read, or the tab's commit found again.
  const before = useRef<SelectedSet>(NO_SELECTION);
  const shown = searches ? set : shownSelectedSet(set, before.current, tabRow.finding);
  useEffect(() => {
    before.current = shown;
  }, [shown]);

  const shownCommits = shown.kind === 'commits' ? shown.entries : NO_COMMITS;
  const multiSelected = shownCommits.length >= 2;
  // The commit the details follow: the tab's own among the ones shown, else the newest.
  const selected = shownCommits.find((entry) => entry.sha === selectedSha) ?? shownCommits[0] ?? null;
  const shownShas = useMemo(() => shownCommits.map((entry) => entry.sha), [shownCommits]);

  // What the set's verbs act on — the selection as it IS: none while its commits are read, or past what is read together.
  const setShas = useMemo(() => (set.kind === 'commits' ? set.entries.map((entry) => entry.sha) : null), [set]);
  // The toolbar's Cherry-Pick holds, as the row menu's does, over a set a pick does not take.
  const canPick = set.kind === 'commits' && setShas !== null && commitsApply(set.entries, setShas);

  const unionOfSelected = useMemo(() => unionFiles(multiSelected ? shownCommits : []), [multiSelected, shownCommits]);
  const rangeBase = useMemo(
    () => (multiSelected ? contiguousRangeBase(shownShas, shownCommits) : null),
    [multiSelected, shownShas, shownCommits],
  );

  // The signature column's marks: asked of the host only while the column shows, for the commits in view.
  const inView = useLogRowsInView(held, prefs.showSignatureColumn && !searches);
  const searchCommitShas = useMemo(() => searchCommits.map((entry) => entry.sha), [searchCommits]);
  const signatures = useCommitSignatures(
    workspaceId,
    searches ? searchCommitShas : inView.shas,
    prefs.showSignatureColumn,
  );
  const reportInView = inView.onWindow;
  const onWindow = useCallback(
    (mounted: LogRowRange): void => {
      wantRows(mounted);
      reportInView(mounted);
    },
    [wantRows, reportInView],
  );

  // The graph's linear runs fold on a list that sifts nothing (the
  // host's rule); a press on a run's dot folds it or opens it again,
  // the gear's Collapse / Expand Linear Branches every one at once.
  const runsFold = !rowFiltersActive && !noMerges && !firstParent && !searches;
  const toggleRun = useCallback(
    (run: WorkspaceTreeLogRunWire): void =>
      live.current.patchTab({ folds: toggleLogFold(live.current.tab.folds, run.first, run.folded) }),
    [],
  );

  // The names the User filter offers: the authors of the rows held — the same list while they are the same names.
  const heldAuthors = useMemo(() => heldLogAuthors(held), [held]);
  const authorsKey = heldAuthors.join('\n');
  const authors = useMemo(() => heldAuthors, [authorsKey]);

  const columns = useMemo<CommitRowColumns>(
    () => ({
      compactRefs: prefs.compactReferences,
      refsOnLeft: prefs.referencesOnLeft,
      showTagChips: prefs.showTagNames,
      showTimestamp: prefs.showCommitTimestamp,
      showAuthor: prefs.showAuthorColumn,
      showHash: prefs.showHashColumn,
      showDate: prefs.showDateColumn,
      showSignature: prefs.showSignatureColumn,
      dimMergeCommits: prefs.highlightMergeCommits,
      hourCycle,
    }),
    [prefs, hourCycle],
  );

  // What the files tree lists — the selected commit, or the set. The
  // tree is keyed by it, and the pane's file selection lives exactly as
  // long: a fresh commit selection starts with no file row selected,
  // and a list read again leaves the selected row its verbs.
  const filesKey =
    selected === null
      ? null
      : multiSelected
        ? `${tabKey}:${shownShas.length}:${shownShas[0]}:${shownShas[shownShas.length - 1]}`
        : `${tabKey}:${selected.sha}`;
  useEffect(() => {
    setSelectedFile(null);
    setSelectedEntity(null);
    setSelectedBase(undefined);
  }, [filesKey]);

  // What Show Diff reads: one commit's change, or the run's range from
  // its base to its newest commit; null while a gapped set is selected.
  const diffTarget = useMemo<{ sha: string; base?: string } | null>(() => {
    if (multiSelected) return rangeBase === null ? null : { sha: shownShas[0], base: rangeBase };
    return selected === null ? null : { sha: selected.sha };
  }, [multiSelected, rangeBase, shownShas, selected]);

  // A navigation to a commit by its hash (the rail's): the log's list
  // asks the host where it sits; a search's list holds it or does not.
  const goTo = tabRow.goTo;
  const navigateToSha = useCallback(
    (sha: string): void => {
      if (!searches) {
        void goTo(sha, true);
        return;
      }
      live.current.patchTab({ selectedSha: sha });
      setSearchScrollTo((prev) => ({ sha, nonce: (prev?.nonce ?? 0) + 1 }));
    },
    [searches, goTo],
  );

  const combinedError =
    refused !== null
      ? t('workbench.gitLog.loadFailed', { detail: refused.detail ?? refused.reason })
      : fileDiff.error !== null
        ? t('workbench.gitLog.loadFailed', { detail: fileDiff.error })
        : null;

  const filtersActive =
    matcher.kind !== 'none' || selectedRefs.length > 0 || rowFiltersActive || noMerges || firstParent;
  const resetFilters = (): void =>
    patchTab({
      filter: '',
      selectedRefs: [],
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
    onBranchDeleted: (deleted) => {
      const patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>> = {};
      if (railSelection !== null && railSelection.kind === 'local' && railSelection.name === deleted) {
        patch.railSelection = null;
      }
      if (selectedRefs.includes(deleted)) patch.selectedRefs = scopeWithout(selectedRefs, [deleted]);
      if (Object.keys(patch).length > 0) patchTab(patch);
    },
  });

  // One of this window's verbs is at the host — a pick, a revert, a
  // patch read, a branch verb: with a list not yet answered and a read
  // the person pressed for, what the pulse along the log's top edge says.
  const atHost = commitApply.working || commitPatch.working || actions.busy.working;

  // The commit rows' menu: the clipboard read, the patch of the set,
  // the pick and the revert of the set, the detached checkout, the New Branch and New Tag dialogs anchored
  // at the commit, and the parent / child walk — by row in the log's
  // list, by commit in a search's.
  const menuVerbs: Omit<LogRowMenuHandlers, 'onNavigate'> = {
    onCopyRevision: (shas) => void navigator.clipboard.writeText(shas.join('\n')),
    onCreatePatch: commitPatch.createPatch,
    onCopyAsPatch: commitPatch.copyAsPatch,
    onCherryPick: commitApply.cherryPick,
    onRevert: commitApply.revert,
    onNewBranchFrom: actions.newBranchFrom,
    onNewTagAt: actions.newTagAt,
    onCheckoutRevision: actions.checkoutRevision,
  };

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
            onScopeChange={(ref) => applyScope([ref])}
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
            workspaceId={workspaceId}
            tab={tab}
            patchTab={patchTab}
            refs={refs}
            favorites={favoriteSet}
            onToggleFavorite={(kind, name) => toggleGitRailFavorite(workspaceId, kind, name, defaultFavorites)}
            recent={recentFilters}
            onScopeChange={applyScope}
            onUsersChange={applyUsers}
            onPathsChange={applyPaths}
            authors={authors}
            onRefresh={pressRefresh}
            onCherryPick={
              canPick && setShas !== null && !commitApply.working ? () => commitApply.cherryPick(setShas) : undefined
            }
            onGoTo={(target) => goTo(target, false)}
            prefs={prefs}
            onPatchPrefs={(patch) => patchGitLogViewPrefs(workspaceId, patch)}
            canCollapseLinear={runsFold && canFoldAll(folds)}
            onCollapseLinear={() => patchTab({ folds: ALL_LOG_FOLDS })}
            canExpandLinear={runsFold && canUnfoldAll(folds)}
            onExpandLinear={() => patchTab({ folds: NO_LOG_FOLDS })}
            textInvalid={matcher.kind === 'invalid'}
          />
          <GitWorkingLine active={atHost || pending || rows.asked || search.asked} />
          {matcher.kind === 'match' ? (
            <CommitList
              entries={searchCommits}
              graph={page === null ? (sifted?.graph ?? null) : null}
              refsBySha={refsBySha}
              headSha={headSha}
              currentBranchShas={searchBand}
              selectedSha={selectedSha}
              onSelect={setSelectedSha}
              onSelectionChange={setSearchShas}
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
              note={searchNote}
              matchRanges={matcher.ranges}
              scrollTo={searchScrollTo}
              compactRefs={columns.compactRefs}
              refsOnLeft={columns.refsOnLeft}
              showTagChips={columns.showTagChips}
              showTimestamp={columns.showTimestamp}
              showAuthor={columns.showAuthor}
              showHash={columns.showHash}
              showDate={columns.showDate}
              showSignature={columns.showSignature}
              signatures={signatures}
              dimMergeCommits={columns.dimMergeCommits}
              hourCycle={columns.hourCycle}
              rowMenu={(target) => buildLogRowMenu(target, t, { ...menuVerbs, onNavigate: navigateToSha })}
            />
          ) : (
            <LogRowList
              held={held}
              pending={pending}
              onWindow={onWindow}
              selection={selection}
              selectedRow={tabRow.row}
              onSelect={tabRow.select}
              refsBySha={refsBySha}
              headSha={headSha}
              band={band}
              filtersActive={filtersActive}
              onResetFilters={resetFilters}
              scrollTo={tabRow.scrollTo}
              columns={columns}
              signatures={signatures}
              onToggleRun={runsFold ? toggleRun : undefined}
              rowMenu={(row) =>
                buildLogRowMenu(logRowMenuTarget(held, ranges, set, row), t, {
                  ...menuVerbs,
                  onNavigate: tabRow.walkTo,
                })
              }
            />
          )}
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
              {shown.kind === 'over' ? (
                // More commits than are read together: their number, and no files that would read as the set's.
                <div style={placeholderStyle} data-testid="git-tool-detail-over">
                  {t('workbench.gitLog.commitsSelected', { count: shown.count })}
                </div>
              ) : selected === null ? (
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
                {shown.kind === 'over' ? (
                  <div style={{ flex: '1 1 auto' }} data-testid="git-tool-detail-over-info" />
                ) : selected === null ? (
                  <div style={placeholderStyle} data-testid="git-tool-detail-none">
                    {t('workbench.gitLog.noneSelected')}
                  </div>
                ) : multiSelected ? (
                  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }} data-testid="git-tool-detail-multi">
                    {shownCommits.map((entry) => (
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
        onClose={() => setHistoryPath(null)}
      />
    </div>
  );
};

export default GitLogView;

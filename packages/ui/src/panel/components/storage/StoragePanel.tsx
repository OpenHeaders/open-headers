/**
 * Storage tool window — application-storage inspector for the inspected
 * tab. The locked layout (STORAGE_PANEL_PLAN.md §4) is a storage-type
 * rail on the left and the active section's view on the right; the
 * scope bar (origin select + partition chip) is shared across sections.
 *
 * DOM storage rides the standard data plane (SW injection) with
 * visibility-gated polling; writes ride the same plane and refetch
 * through the read path. Cookies reuse the shipped jar plane — the poll
 * tick invalidates the jar cache and the sticky hook refetches.
 * IndexedDB, Cache Storage and Usage (quota) ride their own hooks.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyEditForm, jarCookieToKey } from '../../data/cookies/cookie-edit';
import {
  clearSiteJarCookies,
  isCookieJarReadable,
  isCookieJarSiteClearable,
  isCookieJarWritable,
  type JarCookie,
  type JarCookieEdit,
  jarCookieRowKey,
  removeJarCookie,
  type SiteJarCookie,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import { useSiteCookieJarSticky } from '../../data/cookies/use-cookie-jar';
import { cacheEntryTabId, cookieTabId, domStorageEntryTabId, idbRecordTabId } from '../../data/inspector-tab';
import { buildStorageFooterStatus, type StorageFooterStatus } from '../../data/footer-status';
import { setStorageFooterStatus } from '../../data/stores/footer-status-store';
import type { DomStorageArea, DomStorageEntry, SiteDataType } from '../../data/storage/storage-inspector-host';
import {
  cacheEntryMatches,
  cacheMatches,
  cookieMatches,
  countIdbStoreMatches,
  domEntryMatches,
  idbRecordMatches,
} from '../../data/storage/storage-filter';
import { parseStorageKey } from '../../data/storage/storage-key';
import { useDomAreaSnapshot } from '../../data/storage/use-dom-area-snapshot';
import { useCacheBrowser } from '../../data/storage/use-cache-browser';
import { useIdbBrowser } from '../../data/storage/use-idb-browser';
import { useStorageQuota } from '../../data/storage/use-storage-quota';
import {
  type StorageInspectorState,
  type StorageSection,
  useStorageInspector,
} from '../../data/storage/use-storage-inspector';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../../data/text-match';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { type FilterHiddenHint, FilterHiddenNote } from '../FilterHiddenNote';
import { FilterInput } from '../FilterInput';
import { CacheStorageSection } from './CacheStorageSection';
import { CookiesSection } from './CookiesSection';
import { IndexedDbSection, type OpenIdbRecordRequest } from './IndexedDbSection';
import { StorageGrid } from './StorageGrid';
import { CookieIcon, DatabaseIcon, TableIcon, UsagePieIcon } from './StorageNavIcons';
import { ClearSiteDataControl, StorageQuotaCard } from './StorageQuotaCard';
import { useActiveRowScroll } from './use-active-row-scroll';

/** An editor-tab "Reveal in Storage" jump target — back to the record's
 *  IndexedDB store, the entry's DOM storage area, the Cookies section,
 *  or a Cache Storage cache's entry grid. `row` (a search-result jump)
 *  additionally opens that row's document once the section's data is
 *  in, so the grid highlights the exact matched row: the entry key
 *  (`dom`), the jar cookie row key (`cookies`), the record's wire key
 *  (`idb`), or `method + ' ' + url` (`cache`). */
export type StorageRevealRequest =
  | { kind: 'idb'; database: string; store: string; row?: string }
  | { kind: 'dom'; area: DomStorageArea; row?: string }
  | { kind: 'cookies'; row?: string }
  | { kind: 'cache'; cache: string; row?: string };

/** What an editor-tab open needs from a DOM storage row (plus the
 *  scope's frame, which the panel shell adds). */
export interface OpenDomStorageEntryRequest {
  area: DomStorageArea;
  entryKey: string;
}

/** What an editor-tab open needs from a cookie row — the jar cookie
 *  plus the scope URL its site-jar lookup rode (the tab's re-fetch
 *  scope). */
export interface OpenCookieRequest {
  cookie: SiteJarCookie;
  scopeUrl: string;
}

/** What an editor-tab open needs from a Cache Storage entry row (plus
 *  the scope's frame, which the panel shell adds). */
export interface OpenCacheEntryRequest {
  cache: string;
  url: string;
  method: string;
}

interface StoragePanelProps {
  onHide: () => void;
  /** Open one IndexedDB record as an editor tab (scope frame attached). */
  onOpenIdbRecord: (request: OpenIdbRecordRequest & { frameId: number }) => void;
  /** Open one localStorage/sessionStorage entry as an editor tab. */
  onOpenDomEntry: (request: OpenDomStorageEntryRequest & { frameId: number }) => void;
  /** Open one jar cookie as an editor tab. */
  onOpenCookie: (request: OpenCookieRequest) => void;
  /** Open one Cache Storage entry's stored response as an editor tab. */
  onOpenCacheEntry: (request: OpenCacheEntryRequest & { frameId: number }) => void;
  /** Pending editor-tab jump back into a storage section — consumed
   *  exactly once via `onRevealConsumed` (a re-mount or section
   *  round-trip must not replay it). */
  reveal: StorageRevealRequest | null;
  onRevealConsumed: () => void;
  /** Id of the ACTIVE storage-document editor tab (null when the active
   *  tab is another kind) — exactly that row renders highlighted. */
  activeStorageTabId?: string | null;
}

const SECTIONS: ReadonlyArray<{ value: StorageSection; label: string; icon: React.ReactNode }> = [
  { value: 'local', label: 'Local storage', icon: <TableIcon /> },
  { value: 'session', label: 'Session storage', icon: <TableIcon /> },
  { value: 'cookies', label: 'Cookies', icon: <CookieIcon /> },
  { value: 'indexeddb', label: 'IndexedDB', icon: <DatabaseIcon /> },
  { value: 'cachestorage', label: 'Cache Storage', icon: <DatabaseIcon /> },
  { value: 'quota', label: 'Usage', icon: <UsagePieIcon /> },
];

function areaName(section: StorageSection): string {
  return section === 'session' ? 'sessionStorage' : 'localStorage';
}

const READ_ONLY_ADD_TITLES = {
  indexeddb: 'IndexedDB is read-only here',
  cachestorage: 'Cache Storage is read-only here',
  quota: 'Usage is read-only',
} as const;

export function StoragePanel({
  onHide,
  onOpenIdbRecord,
  onOpenDomEntry,
  onOpenCookie,
  onOpenCacheEntry,
  reveal,
  onRevealConsumed,
  activeStorageTabId,
}: StoragePanelProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const [section, setSection] = useState<StorageSection>('local');
  const inspector = useStorageInspector(section);
  const [textFilter, setTextFilter] = useState('');
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [adding, setAdding] = useState(false);

  // A reveal's row target, parked until the section's data is in — the
  // per-kind effects below resolve it to a document open (which makes
  // the grid row active) and bring the row into view.
  const [pendingRow, setPendingRow] = useState<(StorageRevealRequest & { row: string }) | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const revealActiveRow = useActiveRowScroll(rootRef);
  // The user moving to another section abandons the parked row —
  // resolving it later would tear them right back out of where they
  // went. Declared before the consume effect so the same-commit run
  // order stays "clear stale, then park fresh".
  // biome-ignore lint/correctness/useExhaustiveDependencies: section identity is the reset trigger
  useEffect(() => {
    setPendingRow(null);
  }, [section]);

  const filterPredicate = useMemo(() => buildTextPredicate(textFilter, filterConfig), [textFilter, filterConfig]);
  const filterActive = !filterPredicate.empty;

  // "Revealed but filtered" note: a search jump opened a row's document
  // but the panel's filter hides that grid row. The filter is never
  // auto-cleared — the note offers it; clearing re-runs the active-row
  // scroll so the now-visible row centers.
  const [filterHint, setFilterHint] = useState<FilterHiddenHint | null>(null);
  const noteRowHiddenByFilter = useCallback(() => {
    setFilterHint((prev) => ({ nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);
  const dismissFilterHint = useCallback(() => setFilterHint(null), []);
  const clearFilterForHint = useCallback(() => {
    setTextFilter('');
    setFilterHint(null);
    revealActiveRow();
  }, [revealActiveRow]);

  // Selection or section moved out from under an open add row — drop it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selection identity is the reset trigger
  useEffect(() => {
    setAdding(false);
  }, [inspector.selectedOrigin, section]);

  const entries = inspector.snapshot?.entries ?? [];
  const filtered = useMemo<ReadonlyArray<DomStorageEntry>>(() => {
    if (filterPredicate.empty) return entries;
    return entries.filter((e) => domEntryMatches(e, filterPredicate));
  }, [entries, filterPredicate]);

  // Partition evidence (CDP tier): the selected scope's storage key, when
  // the browser reported one and it carries partition components.
  const selectedScope = inspector.scopes.find((s) => s.origin === inspector.selectedOrigin) ?? null;
  const partition = selectedScope?.storageKey ? parseStorageKey(selectedScope.storageKey) : null;

  // ── IndexedDB / Cache Storage / Usage section data (own hooks, own polls) ──
  // While a filter is typed, the sectioned stores' hooks activate too:
  // the nav rail's match-count badges need every section's data, not
  // just the active one's. Idle (no filter) keeps today's gating.
  const idb = useIdbBrowser(section === 'indexeddb' || filterActive, selectedScope?.frameId ?? null);
  const cacheStorage = useCacheBrowser(section === 'cachestorage' || filterActive, selectedScope?.frameId ?? null);
  const quota = useStorageQuota(section === 'quota', selectedScope?.frameId ?? null);

  // Scope-bar sweeps for the sectioned stores — every enumerated
  // database/cache through the same per-name delete the row lanes use.
  const clearIdbDatabases = useCallback(async () => {
    for (const db of idb.databases ?? []) idb.deleteDatabase(db.name);
    return true;
  }, [idb.databases, idb.deleteDatabase]);
  const clearCacheStorage = useCallback(async () => {
    for (const c of cacheStorage.caches ?? []) cacheStorage.deleteCache(c.name);
    return true;
  }, [cacheStorage.caches, cacheStorage.deleteCache]);

  // Per-section clear outcome — the button hides the moment the confirm
  // lands (no disarmed-label flash while the refetch drains the rows)
  // and a transient "✓ cleared" takes its place, like Clear everything's.
  const [sectionClearOutcome, setSectionClearOutcome] = useState<'pending' | 'ok' | 'fail' | null>(null);
  const sectionClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSectionClear = useCallback(async (clear: () => Promise<boolean>): Promise<boolean> => {
    if (sectionClearTimer.current !== null) clearTimeout(sectionClearTimer.current);
    setSectionClearOutcome('pending');
    const ok = await clear();
    setSectionClearOutcome(ok ? 'ok' : 'fail');
    if (ok) sectionClearTimer.current = setTimeout(() => setSectionClearOutcome(null), 4000);
    return ok;
  }, []);
  // Section or scope moved on — the note belongs to the old view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: view identity is the reset trigger
  useEffect(() => {
    if (sectionClearTimer.current !== null) clearTimeout(sectionClearTimer.current);
    setSectionClearOutcome(null);
  }, [section, inspector.selectedOrigin]);
  useEffect(
    () => () => {
      if (sectionClearTimer.current !== null) clearTimeout(sectionClearTimer.current);
    },
    [],
  );

  // Site-data types UNchecked for Clear everything — owned here so the
  // scope bar's control and the quota card's checkboxes share it.
  const [clearExcluded, setClearExcluded] = useState<ReadonlySet<SiteDataType>>(new Set());
  const toggleClearType = useCallback((type: SiteDataType) => {
    setClearExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Hovering Clear everything lights up its reach: the nav rail's
  // covered sections and the card's checked type rows.
  const [clearHovered, setClearHovered] = useState(false);
  const clearTargetSections = useMemo(() => {
    const targets = new Set<StorageSection>();
    if (!clearHovered) return targets;
    if (!clearExcluded.has('cookies')) targets.add('cookies');
    if (!clearExcluded.has('localStorage')) targets.add('local');
    if (!clearExcluded.has('sessionStorage')) targets.add('session');
    if (!clearExcluded.has('indexedDB')) targets.add('indexeddb');
    if (!clearExcluded.has('cacheStorage')) targets.add('cachestorage');
    return targets;
  }, [clearHovered, clearExcluded]);

  // Editor-tab "Reveal in Storage": switch to the target section, then
  // (for IndexedDB) select the target store and hand the request back
  // as consumed. Two effects because activating a section resets the
  // idb hook's selection (its own scope-reset effect runs first — hook
  // call order — so the select lands after it).
  const revealSection: StorageSection | null =
    reveal === null
      ? null
      : reveal.kind === 'idb'
        ? 'indexeddb'
        : reveal.kind === 'cookies'
          ? 'cookies'
          : reveal.kind === 'cache'
            ? 'cachestorage'
            : reveal.area;
  useEffect(() => {
    if (revealSection !== null) setSection(revealSection);
  }, [revealSection]);
  const selectIdbStore = idb.selectStore;
  const selectCache = cacheStorage.selectCache;
  useEffect(() => {
    if (!reveal || section !== revealSection) return;
    if (reveal.kind === 'idb') selectIdbStore(reveal.database, reveal.store);
    if (reveal.kind === 'cache') selectCache(reveal.cache);
    const row = reveal.row;
    setPendingRow(row !== undefined && row !== '' ? { ...reveal, row } : null);
    onRevealConsumed();
  }, [reveal, revealSection, section, selectIdbStore, selectCache, onRevealConsumed]);

  const selectedFrameId = selectedScope?.frameId ?? null;
  const openIdbRecord = useCallback(
    (request: OpenIdbRecordRequest) => {
      if (selectedFrameId === null) return;
      onOpenIdbRecord({ ...request, frameId: selectedFrameId });
    },
    [onOpenIdbRecord, selectedFrameId],
  );
  const isIdbRecordActive = useCallback(
    (database: string, store: string, primaryKeyWire: string) =>
      selectedFrameId !== null &&
      activeStorageTabId != null &&
      activeStorageTabId === idbRecordTabId(selectedFrameId, database, store, primaryKeyWire),
    [activeStorageTabId, selectedFrameId],
  );
  const selectedCacheName = cacheStorage.selectedCache;
  const openCacheEntry = useCallback(
    (url: string, method: string) => {
      if (selectedFrameId === null || selectedCacheName === null) return;
      onOpenCacheEntry({ cache: selectedCacheName, url, method, frameId: selectedFrameId });
    },
    [onOpenCacheEntry, selectedFrameId, selectedCacheName],
  );
  const isCacheEntryActive = useCallback(
    (url: string, method: string) =>
      selectedFrameId !== null &&
      selectedCacheName !== null &&
      activeStorageTabId != null &&
      activeStorageTabId === cacheEntryTabId(selectedFrameId, selectedCacheName, url, method),
    [activeStorageTabId, selectedFrameId, selectedCacheName],
  );
  const domArea: DomStorageArea = section === 'session' ? 'session' : 'local';
  const openDomEntry = useCallback(
    (entryKey: string) => {
      if (selectedFrameId === null) return;
      onOpenDomEntry({ area: domArea, entryKey, frameId: selectedFrameId });
    },
    [onOpenDomEntry, selectedFrameId, domArea],
  );
  const isDomEntryActive = useCallback(
    (entryKey: string) =>
      selectedFrameId !== null &&
      activeStorageTabId != null &&
      activeStorageTabId === domStorageEntryTabId(selectedFrameId, domArea, entryKey),
    [activeStorageTabId, selectedFrameId, domArea],
  );

  // ── Cookies section data + write plumbing (jar plane reuse) ────────
  const scopeUrl = selectedScope?.url ?? '';
  const openCookie = useCallback(
    (cookie: SiteJarCookie) => {
      onOpenCookie({ cookie, scopeUrl });
    },
    [onOpenCookie, scopeUrl],
  );
  const isCookieActive = useCallback(
    (cookie: SiteJarCookie) => activeStorageTabId != null && activeStorageTabId === cookieTabId(jarCookieToKey(cookie)),
    [activeStorageTabId],
  );
  const jar = useSiteCookieJarSticky(section === 'cookies' || filterActive ? scopeUrl : '');
  const sortedCookies = useMemo<ReadonlyArray<SiteJarCookie> | null>(() => {
    if (!jar) return jar;
    return [...jar].sort(
      (a, b) => a.name.localeCompare(b.name) || a.domain.localeCompare(b.domain) || a.path.localeCompare(b.path),
    );
  }, [jar]);
  const filteredCookies = useMemo<ReadonlyArray<SiteJarCookie>>(() => {
    if (!sortedCookies) return [];
    if (filterPredicate.empty) return sortedCookies;
    return sortedCookies.filter((c) => cookieMatches(c, filterPredicate));
  }, [sortedCookies, filterPredicate]);

  // ── Search-jump row resolution ────────────────────────────────────
  // Each effect resolves a parked row once ITS section's data is in:
  // opening the row's document is what makes the grid row active (the
  // grids' single-click semantics), and the reveal scroll brings it
  // into view. A row that no longer exists resolves to the plain
  // section reveal — live storage may have moved since the search ran.
  useEffect(() => {
    if (pendingRow?.kind !== 'dom' || selectedFrameId === null) return;
    onOpenDomEntry({ area: pendingRow.area, entryKey: pendingRow.row, frameId: selectedFrameId });
    revealActiveRow();
    if (filterActive) {
      // Best-effort: the dom open doesn't wait for the snapshot; when
      // it's already in, note a row the filter hides.
      const entry = inspector.snapshot?.entries.find((e) => e.key === pendingRow.row);
      if (entry !== undefined && !domEntryMatches(entry, filterPredicate)) noteRowHiddenByFilter();
    }
    setPendingRow(null);
  }, [
    pendingRow,
    selectedFrameId,
    onOpenDomEntry,
    revealActiveRow,
    filterActive,
    inspector.snapshot,
    filterPredicate,
    noteRowHiddenByFilter,
  ]);

  useEffect(() => {
    if (pendingRow?.kind !== 'cookies' || sortedCookies === null) return;
    const cookie = sortedCookies.find((c) => jarCookieRowKey(c) === pendingRow.row);
    if (cookie !== undefined) {
      openCookie(cookie);
      revealActiveRow();
      if (filterActive && !cookieMatches(cookie, filterPredicate)) noteRowHiddenByFilter();
    }
    setPendingRow(null);
  }, [pendingRow, sortedCookies, openCookie, revealActiveRow, filterActive, filterPredicate, noteRowHiddenByFilter]);

  useEffect(() => {
    if (pendingRow?.kind !== 'idb') return;
    if (idb.selection?.database !== pendingRow.database || idb.selection.store !== pendingRow.store) return;
    if (idb.recordsPage === null) return;
    const record = idb.recordsPage.records.find((r) => r.primaryKeyWire === pendingRow.row);
    if (record !== undefined) {
      openIdbRecord({
        database: pendingRow.database,
        store: pendingRow.store,
        primaryKeyWire: pendingRow.row,
        keyPreview: record.primaryKeyPreview,
      });
      revealActiveRow();
      if (filterActive && !idbRecordMatches(record, filterPredicate)) noteRowHiddenByFilter();
    }
    setPendingRow(null);
  }, [
    pendingRow,
    idb.selection,
    idb.recordsPage,
    openIdbRecord,
    revealActiveRow,
    filterActive,
    filterPredicate,
    noteRowHiddenByFilter,
  ]);

  useEffect(() => {
    if (pendingRow?.kind !== 'cache') return;
    if (cacheStorage.selectedCache !== pendingRow.cache || cacheStorage.entriesPage === null) return;
    // The row key is `method + ' ' + url` — methods are space-free tokens.
    const sep = pendingRow.row.indexOf(' ');
    const method = pendingRow.row.slice(0, sep);
    const url = pendingRow.row.slice(sep + 1);
    const entry = cacheStorage.entriesPage.entries.find((e) => e.method === method && e.url === url);
    if (entry !== undefined) {
      openCacheEntry(entry.url, entry.method);
      revealActiveRow();
      if (filterActive && !cacheEntryMatches(entry, filterPredicate)) noteRowHiddenByFilter();
    }
    setPendingRow(null);
  }, [
    pendingRow,
    cacheStorage.selectedCache,
    cacheStorage.entriesPage,
    openCacheEntry,
    revealActiveRow,
    filterActive,
    filterPredicate,
    noteRowHiddenByFilter,
  ]);

  // ── Nav-rail match badges (settings-sidebar idiom) ────────────────
  // While a filter is typed, every section tab shows how many of its
  // rows match. The non-active DOM area rides a read-only sibling
  // snapshot; everything else reuses the data the hooks above already
  // load once `filterActive` ungates them.
  const domSection: DomStorageArea | null = section === 'local' ? 'local' : section === 'session' ? 'session' : null;
  const localSibling = useDomAreaSnapshot(filterActive && domSection !== 'local', selectedFrameId, 'local');
  const sessionSibling = useDomAreaSnapshot(filterActive && domSection !== 'session', selectedFrameId, 'session');
  const navMatchCounts = useMemo<Partial<Record<StorageSection, number>>>(() => {
    if (filterPredicate.empty) return {};
    const counts: Partial<Record<StorageSection, number>> = {};
    const localEntries = domSection === 'local' ? inspector.snapshot?.entries : localSibling?.entries;
    const sessionEntries = domSection === 'session' ? inspector.snapshot?.entries : sessionSibling?.entries;
    if (localEntries) counts.local = localEntries.filter((e) => domEntryMatches(e, filterPredicate)).length;
    if (sessionEntries) counts.session = sessionEntries.filter((e) => domEntryMatches(e, filterPredicate)).length;
    if (sortedCookies) counts.cookies = sortedCookies.filter((c) => cookieMatches(c, filterPredicate)).length;
    if (idb.databases) counts.indexeddb = countIdbStoreMatches(idb.databases, filterPredicate);
    if (cacheStorage.caches) {
      counts.cachestorage = cacheStorage.caches.filter((c) => cacheMatches(c, filterPredicate)).length;
    }
    return counts;
  }, [
    filterPredicate,
    domSection,
    inspector.snapshot,
    localSibling,
    sessionSibling,
    sortedCookies,
    idb.databases,
    cacheStorage.caches,
  ]);

  const cookiesWritable = isCookieJarWritable() && inspector.scopes.length > 0;
  const [cookieWriteFailed, setCookieWriteFailed] = useState(false);

  // ── Focused-tool footer status (published to the status bar) ──────
  // The active section's counts, the cross-section match note, and the
  // failure alert, mirrored from the same data the scope note reads.
  // `null` (no data yet / no scopes) makes the footer fall back to the
  // Network line.
  const matchingSections = useMemo(
    () => Object.values(navMatchCounts).filter((count) => count > 0).length,
    [navMatchCounts],
  );
  const footerStatus = useMemo<StorageFooterStatus | null>(() => {
    if (inspector.scopes.length === 0) return null;
    const common = { section, filterActive, matchingSections };
    if (section === 'cookies') {
      if (!sortedCookies) return null;
      return buildStorageFooterStatus({
        ...common,
        filteredCount: filteredCookies.length,
        totalCount: sortedCookies.length,
        writeFailed: cookieWriteFailed,
        deleteFailed: false,
        readFailed: false,
        quotaUsage: null,
        quotaTotal: null,
      });
    }
    if (section === 'indexeddb' || section === 'cachestorage') {
      const total = section === 'indexeddb' ? idb.databases?.length : cacheStorage.caches?.length;
      if (total === undefined) return null;
      return buildStorageFooterStatus({
        ...common,
        filteredCount: null,
        totalCount: total,
        writeFailed: false,
        deleteFailed: section === 'indexeddb' ? idb.mutationFailed : cacheStorage.mutationFailed,
        readFailed: false,
        quotaUsage: null,
        quotaTotal: null,
      });
    }
    if (section === 'quota') {
      if (quota.quota === null) return null;
      return buildStorageFooterStatus({
        ...common,
        filteredCount: null,
        totalCount: 0,
        writeFailed: false,
        deleteFailed: false,
        readFailed: false,
        quotaUsage: quota.quota.usage,
        quotaTotal: quota.quota.quota,
      });
    }
    if (inspector.snapshot === null) return null;
    return buildStorageFooterStatus({
      ...common,
      filteredCount: filtered.length,
      totalCount: entries.length,
      writeFailed: inspector.writeFailed,
      deleteFailed: false,
      readFailed: inspector.readFailed,
      quotaUsage: null,
      quotaTotal: null,
    });
  }, [
    inspector.scopes.length,
    inspector.snapshot,
    inspector.writeFailed,
    inspector.readFailed,
    section,
    filterActive,
    matchingSections,
    sortedCookies,
    filteredCookies,
    cookieWriteFailed,
    idb.databases,
    idb.mutationFailed,
    cacheStorage.caches,
    cacheStorage.mutationFailed,
    quota.quota,
    filtered,
    entries,
  ]);
  useEffect(() => {
    setStorageFooterStatus(footerStatus);
  }, [footerStatus]);
  useEffect(() => () => setStorageFooterStatus(null), []);

  const applyCookieEdit = useCallback(async (edit: JarCookieEdit): Promise<boolean> => {
    const { cookie } = await writeJarCookie(edit);
    setCookieWriteFailed(cookie === null);
    return cookie !== null;
  }, []);

  const deleteCookie = useCallback((cookie: JarCookie) => {
    void removeJarCookie(jarCookieToKey(cookie)).then((ok) => {
      setCookieWriteFailed(!ok);
    });
  }, []);

  const clearCookies = useCallback(async (): Promise<boolean> => {
    const ok = await clearSiteJarCookies(scopeUrl);
    setCookieWriteFailed(!ok);
    return ok;
  }, [scopeUrl]);

  const addCookieCanonical = useMemo(() => {
    let domain = '';
    try {
      domain = new URL(scopeUrl).hostname;
    } catch {
      domain = '';
    }
    return emptyEditForm({ domain, secure: scopeUrl.startsWith('https:') });
  }, [scopeUrl]);

  const canWrite = inspector.available && inspector.scopes.length > 0 && inspector.snapshot !== null;

  // The active section's scope-bar clear gesture, `null` when there is
  // nothing to clear (or nothing visible to clear yet).
  const sectionClear: (() => Promise<boolean>) | null =
    section === 'cookies'
      ? cookiesWritable && isCookieJarSiteClearable() && (sortedCookies?.length ?? 0) > 0
        ? clearCookies
        : null
      : section === 'indexeddb'
        ? (idb.databases?.length ?? 0) > 0
          ? clearIdbDatabases
          : null
        : section === 'cachestorage'
          ? (cacheStorage.caches?.length ?? 0) > 0
            ? clearCacheStorage
            : null
          : section === 'quota'
            ? null
            : canWrite && entries.length > 0
              ? inspector.clearArea
              : null;

  const scopeNote =
    section === 'cookies'
      ? [
          sortedCookies ? `${filteredCookies.length} of ${sortedCookies.length} cookies` : '',
          cookieWriteFailed ? ' · write failed' : '',
        ].join('')
      : section === 'indexeddb'
        ? [
            idb.databases ? `${idb.databases.length} ${idb.databases.length === 1 ? 'database' : 'databases'}` : '',
            idb.mutationFailed ? ' · delete failed' : '',
          ].join('')
        : section === 'cachestorage'
          ? [
              cacheStorage.caches
                ? `${cacheStorage.caches.length} ${cacheStorage.caches.length === 1 ? 'cache' : 'caches'}`
                : '',
              cacheStorage.mutationFailed ? ' · delete failed' : '',
            ].join('')
          : [
            inspector.snapshot ? `${filtered.length} of ${entries.length} items` : '',
            inspector.snapshot?.truncated ? ' · list truncated' : '',
            inspector.readFailed ? ' · read failed — showing last data' : '',
            inspector.writeFailed ? ' · write failed' : '',
          ].join('');

  return (
    <div className="dt-panel" ref={rootRef}>
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-header-filter-row">
            <strong className="dt-header-panel-name">Storage</strong>
            <div className="dt-filter-separator" />
            <FilterInput
              value={textFilter}
              onChange={setTextFilter}
              config={filterConfig}
              onConfigChange={setFilterConfig}
              hasError={filterPredicate.error}
              ariaLabel="Filter storage entries"
            />
            <div className="dt-filter-separator" />
            {section === 'cookies' ? (
              <CookieEditPopover mode="add" canonical={addCookieCanonical} onSubmit={applyCookieEdit}>
                <button
                  type="button"
                  className="dt-toolbar-icon"
                  disabled={!cookiesWritable}
                  title="Add a cookie to the browser jar (including HttpOnly)"
                  aria-label="Add cookie"
                >
                  <PlusOutlined />
                </button>
              </CookieEditPopover>
            ) : section === 'indexeddb' || section === 'cachestorage' || section === 'quota' ? (
              <button
                type="button"
                className="dt-toolbar-icon"
                disabled
                title={READ_ONLY_ADD_TITLES[section]}
                aria-label={READ_ONLY_ADD_TITLES[section]}
              >
                <PlusOutlined />
              </button>
            ) : (
              <button
                type="button"
                className="dt-toolbar-icon"
                onClick={() => setAdding(true)}
                disabled={!canWrite}
                title="Add entry"
                aria-label="Add storage entry"
              >
                <PlusOutlined />
              </button>
            )}
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={() => {
                inspector.refresh();
                if (section === 'indexeddb') idb.refresh();
                if (section === 'cachestorage') cacheStorage.refresh();
                if (section === 'quota') quota.refresh();
              }}
              title="Refresh"
              aria-label="Refresh storage"
            >
              <ReloadOutlined />
            </button>
          </div>
        }
      />
      <FilterHiddenNote
        hint={filterHint}
        message="Revealed row is hidden by the active filter"
        onClearFilter={clearFilterForHint}
        onDismiss={dismissFilterHint}
      />

      <div className="dt-storage-layout">
        <nav className="dt-storage-nav" aria-label="Storage type">
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`dt-storage-nav-item${
                clearTargetSections.has(s.value) ? ' dt-storage-nav-item--clear-target' : ''
              }`}
              data-active={section === s.value}
              onClick={() => setSection(s.value)}
            >
              <span className="dt-storage-nav-icon">{s.icon}</span>
              {s.label}
              {navMatchCounts[s.value] !== undefined && navMatchCounts[s.value] !== 0 && (
                <span className="dt-storage-nav-badge" title={`${navMatchCounts[s.value]} matches`}>
                  {navMatchCounts[s.value]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="dt-storage-main">
          {inspector.scopes.length > 0 && (
            <div className="dt-storage-scope-bar">
              <select
                className="dt-storage-scope-select"
                value={inspector.selectedOrigin ?? ''}
                onChange={(e) => inspector.selectOrigin(e.target.value)}
                aria-label="Storage origin"
              >
                {inspector.scopes.map((s) => (
                  <option key={s.origin} value={s.origin}>
                    {s.origin}
                    {s.isMainFrame ? '' : ' (iframe)'}
                  </option>
                ))}
              </select>
              {partition?.partitioned && (
                <span
                  className="dt-storage-partition-chip"
                  title={`Partitioned storage — this origin's data here is keyed under ${partition.topLevelSite ?? 'a partition'}.\nStorage key: ${partition.raw}`}
                >
                  partitioned{partition.topLevelSite ? ` · ${partition.topLevelSite}` : ''}
                </span>
              )}
              <span className="dt-storage-scope-note">{scopeNote}</span>
              {section === 'quota' ? (
                <ClearSiteDataControl quota={quota} excluded={clearExcluded} onHoverChange={setClearHovered} />
              ) : (
                (sectionClear !== null || sectionClearOutcome === 'ok' || sectionClearOutcome === 'fail') && (
                  <span className="dt-storage-clear-group">
                    {sectionClearOutcome === 'ok' ? (
                      <span className="dt-storage-quota-clear-done" role="status">
                        ✓ cleared
                      </span>
                    ) : sectionClearOutcome === 'fail' ? (
                      <span className="dt-storage-quota-clear-failed">clear failed</span>
                    ) : null}
                    {sectionClear !== null &&
                      sectionClearOutcome !== 'pending' &&
                      sectionClearOutcome !== 'ok' && (
                        <ClearAllButton section={section} onClear={() => runSectionClear(sectionClear)} />
                      )}
                  </span>
                )
              )}
            </div>
          )}

          <div className="dt-storage-body">
            {section === 'cookies' ? (
              <CookiesBody
                inspector={inspector}
                cookies={sortedCookies}
                filteredCookies={filteredCookies}
                scopeUrl={scopeUrl}
                writable={cookiesWritable}
                onApplyEdit={applyCookieEdit}
                onDelete={deleteCookie}
                onOpen={openCookie}
                isActive={isCookieActive}
              />
            ) : section === 'indexeddb' || section === 'cachestorage' || section === 'quota' ? (
              inspector.available && inspector.scopes.length > 0 ? (
                section === 'indexeddb' ? (
                  <IndexedDbSection
                    idb={idb}
                    filter={filterPredicate}
                    onOpenRecord={openIdbRecord}
                    isRecordActive={isIdbRecordActive}
                  />
                ) : section === 'cachestorage' ? (
                  <CacheStorageSection
                    cache={cacheStorage}
                    filter={filterPredicate}
                    onOpenEntry={openCacheEntry}
                    isEntryActive={isCacheEntryActive}
                  />
                ) : (
                  <StorageQuotaCard
                    quota={quota}
                    excluded={clearExcluded}
                    onToggleType={toggleClearType}
                    highlightTargets={clearHovered}
                  />
                )
              ) : (
                <div className="dt-empty-hero">
                  <strong>No inspectable origins</strong>
                  <span className="dt-empty-hero-sub">
                    This tab has no http(s) frames — browser-internal pages can’t be inspected.
                  </span>
                </div>
              )
            ) : (
              <StorageBody
                inspector={inspector}
                section={section}
                entries={filtered}
                totalCount={entries.length}
                adding={adding}
                onCloseAdd={() => setAdding(false)}
                onOpenEntry={openDomEntry}
                isEntryActive={isDomEntryActive}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two-step inline confirm — first click arms, second commits. */
const CLEAR_ALL_WORDING: Partial<Record<StorageSection, { label: string; noun: string }>> = {
  cookies: { label: 'Clear cookies', noun: 'cookie in this site’s jar' },
  indexeddb: { label: 'Clear IndexedDB', noun: 'IndexedDB database' },
  cachestorage: { label: 'Clear Cache Storage', noun: 'cache' },
};

function ClearAllButton({ section, onClear }: { section: StorageSection; onClear: () => Promise<boolean> }) {
  const [armed, setArmed] = useState(false);
  const wording = CLEAR_ALL_WORDING[section] ?? {
    label: section === 'session' ? 'Clear session storage' : 'Clear local storage',
    noun: `${areaName(section)} entry`,
  };
  const { label, noun } = wording;
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      title={armed ? `Deletes every ${noun} for this origin` : `Clear every ${noun}`}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void onClear();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Confirm clear?' : label}
    </button>
  );
}

interface StorageBodyProps {
  inspector: StorageInspectorState;
  section: StorageSection;
  entries: ReadonlyArray<DomStorageEntry>;
  totalCount: number;
  adding: boolean;
  onCloseAdd: () => void;
  onOpenEntry: (key: string) => void;
  isEntryActive: (key: string) => boolean;
}

function StorageBody({
  inspector,
  section,
  entries,
  totalCount,
  adding,
  onCloseAdd,
  onOpenEntry,
  isEntryActive,
}: StorageBodyProps) {
  const { available, loading, selectedOrigin: origin } = inspector;
  const hasScopes = inspector.scopes.length > 0;
  const hasSnapshot = inspector.snapshot !== null;

  if (!available) {
    return (
      <div className="dt-empty-hero">
        <strong>Storage inspection isn’t available here</strong>
        <span className="dt-empty-hero-sub">This host doesn’t expose the inspected tab’s application storage.</span>
      </div>
    );
  }
  if (!hasScopes) {
    return (
      <div className="dt-empty-hero">
        <strong>No inspectable origins</strong>
        <span className="dt-empty-hero-sub">
          This tab has no http(s) frames with DOM storage — browser-internal pages can’t be inspected.
        </span>
      </div>
    );
  }
  if (loading && !hasSnapshot) {
    return <div className="dt-empty">Loading…</div>;
  }
  if (!hasSnapshot) {
    return (
      <div className="dt-empty-hero">
        <strong>Storage unavailable</strong>
        <span className="dt-empty-hero-sub">
          The frame for {origin ?? 'this origin'} can’t be read right now — it may have navigated away.
        </span>
      </div>
    );
  }
  if (totalCount === 0 && !adding) {
    return (
      <div className="dt-empty">
        No items in {areaName(section)} for {origin}.
      </div>
    );
  }
  if (entries.length === 0 && !adding) {
    return <div className="dt-empty">No items match your filter.</div>;
  }
  return (
    <StorageGrid
      area={section === 'session' ? 'session' : 'local'}
      entries={entries}
      adding={adding}
      onCloseAdd={onCloseAdd}
      onCommit={inspector.applyEdit}
      onRemove={inspector.removeEntry}
      fetchFullValue={inspector.fetchFullValue}
      onOpenEntry={onOpenEntry}
      isEntryActive={isEntryActive}
    />
  );
}

interface CookiesBodyProps {
  inspector: StorageInspectorState;
  /** `null` while the first jar lookup for this scope is in flight. */
  cookies: ReadonlyArray<SiteJarCookie> | null;
  filteredCookies: ReadonlyArray<SiteJarCookie>;
  scopeUrl: string;
  writable: boolean;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
  onOpen: (cookie: SiteJarCookie) => void;
  isActive: (cookie: SiteJarCookie) => boolean;
}

function CookiesBody({
  inspector,
  cookies,
  filteredCookies,
  scopeUrl,
  writable,
  onApplyEdit,
  onDelete,
  onOpen,
  isActive,
}: CookiesBodyProps) {
  const hasScopes = inspector.scopes.length > 0;

  if (!isCookieJarReadable()) {
    return (
      <div className="dt-empty-hero">
        <strong>Cookies aren’t available here</strong>
        <span className="dt-empty-hero-sub">This host doesn’t expose the browser cookie jar.</span>
      </div>
    );
  }
  if (!inspector.available || !hasScopes) {
    return (
      <div className="dt-empty-hero">
        <strong>No inspectable origins</strong>
        <span className="dt-empty-hero-sub">
          This tab has no http(s) frames — browser-internal pages carry no site cookies.
        </span>
      </div>
    );
  }
  if (cookies === null) {
    return <div className="dt-empty">Loading…</div>;
  }
  if (cookies.length === 0) {
    return <div className="dt-empty">No cookies for {inspector.selectedOrigin}.</div>;
  }
  if (filteredCookies.length === 0) {
    return <div className="dt-empty">No cookies match your filter.</div>;
  }
  return (
    <CookiesSection
      cookies={filteredCookies}
      scopeUrl={scopeUrl}
      writable={writable}
      onApplyEdit={onApplyEdit}
      onDelete={onDelete}
      onOpen={onOpen}
      isActive={isActive}
    />
  );
}

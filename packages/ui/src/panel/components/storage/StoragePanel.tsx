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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyEditForm, jarCookieToKey } from '../../data/cookies/cookie-edit';
import {
  clearSiteJarCookies,
  isCookieJarReadable,
  isCookieJarSiteClearable,
  isCookieJarWritable,
  type JarCookie,
  type JarCookieEdit,
  removeJarCookie,
  type SiteJarCookie,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import { useSiteCookieJarSticky } from '../../data/cookies/use-cookie-jar';
import { domStorageEntryTabId, idbRecordTabId } from '../../data/inspector-tab';
import type { DomStorageArea, DomStorageEntry } from '../../data/storage/storage-inspector-host';
import { parseStorageKey } from '../../data/storage/storage-key';
import { useCacheBrowser } from '../../data/storage/use-cache-browser';
import { useIdbBrowser } from '../../data/storage/use-idb-browser';
import { useStorageQuota } from '../../data/storage/use-storage-quota';
import {
  type StorageInspectorState,
  type StorageSection,
  useStorageInspector,
} from '../../data/storage/use-storage-inspector';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { CacheStorageSection } from './CacheStorageSection';
import { CookiesSection } from './CookiesSection';
import { IndexedDbSection, type OpenIdbRecordRequest } from './IndexedDbSection';
import { StorageGrid } from './StorageGrid';
import { CookieIcon, DatabaseIcon, TableIcon, UsagePieIcon } from './StorageNavIcons';
import { StorageQuotaCard } from './StorageQuotaCard';

/** An editor-tab "Reveal in Storage" jump target — back to the record's
 *  IndexedDB store or the entry's DOM storage area. */
export type StorageRevealRequest =
  | { kind: 'idb'; database: string; store: string }
  | { kind: 'dom'; area: DomStorageArea };

/** What an editor-tab open needs from a DOM storage row (plus the
 *  scope's frame, which the panel shell adds). */
export interface OpenDomStorageEntryRequest {
  area: DomStorageArea;
  entryKey: string;
}

interface StoragePanelProps {
  onHide: () => void;
  /** Open one IndexedDB record as an editor tab (scope frame attached). */
  onOpenIdbRecord: (request: OpenIdbRecordRequest & { frameId: number }) => void;
  /** Open one localStorage/sessionStorage entry as an editor tab. */
  onOpenDomEntry: (request: OpenDomStorageEntryRequest & { frameId: number }) => void;
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
  reveal,
  onRevealConsumed,
  activeStorageTabId,
}: StoragePanelProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const [section, setSection] = useState<StorageSection>('local');
  const inspector = useStorageInspector(section);
  const [textFilter, setTextFilter] = useState('');
  const [adding, setAdding] = useState(false);

  // Selection or section moved out from under an open add row — drop it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selection identity is the reset trigger
  useEffect(() => {
    setAdding(false);
  }, [inspector.selectedOrigin, section]);

  const entries = inspector.snapshot?.entries ?? [];
  const filtered = useMemo<ReadonlyArray<DomStorageEntry>>(() => {
    const needle = textFilter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => e.key.toLowerCase().includes(needle) || e.value.toLowerCase().includes(needle));
  }, [entries, textFilter]);

  // Partition evidence (CDP tier): the selected scope's storage key, when
  // the browser reported one and it carries partition components.
  const selectedScope = inspector.scopes.find((s) => s.origin === inspector.selectedOrigin) ?? null;
  const partition = selectedScope?.storageKey ? parseStorageKey(selectedScope.storageKey) : null;

  // ── IndexedDB / Cache Storage / Usage section data (own hooks, own polls) ──
  const idb = useIdbBrowser(section === 'indexeddb', selectedScope?.frameId ?? null);
  const cacheStorage = useCacheBrowser(section === 'cachestorage', selectedScope?.frameId ?? null);
  const quota = useStorageQuota(section === 'quota', selectedScope?.frameId ?? null);

  // Editor-tab "Reveal in Storage": switch to the target section, then
  // (for IndexedDB) select the target store and hand the request back
  // as consumed. Two effects because activating a section resets the
  // idb hook's selection (its own scope-reset effect runs first — hook
  // call order — so the select lands after it).
  const revealSection: StorageSection | null = reveal === null ? null : reveal.kind === 'idb' ? 'indexeddb' : reveal.area;
  useEffect(() => {
    if (revealSection !== null) setSection(revealSection);
  }, [revealSection]);
  const selectIdbStore = idb.selectStore;
  useEffect(() => {
    if (!reveal || section !== revealSection) return;
    if (reveal.kind === 'idb') selectIdbStore(reveal.database, reveal.store);
    onRevealConsumed();
  }, [reveal, revealSection, section, selectIdbStore, onRevealConsumed]);

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
  const jar = useSiteCookieJarSticky(section === 'cookies' ? scopeUrl : '');
  const sortedCookies = useMemo<ReadonlyArray<SiteJarCookie> | null>(() => {
    if (!jar) return jar;
    return [...jar].sort(
      (a, b) => a.name.localeCompare(b.name) || a.domain.localeCompare(b.domain) || a.path.localeCompare(b.path),
    );
  }, [jar]);
  const filteredCookies = useMemo<ReadonlyArray<SiteJarCookie>>(() => {
    if (!sortedCookies) return [];
    const needle = textFilter.trim().toLowerCase();
    if (!needle) return sortedCookies;
    return sortedCookies.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.value.toLowerCase().includes(needle) ||
        c.domain.toLowerCase().includes(needle),
    );
  }, [sortedCookies, textFilter]);

  const cookiesWritable = isCookieJarWritable() && inspector.scopes.length > 0;
  const [cookieWriteFailed, setCookieWriteFailed] = useState(false);

  const applyCookieEdit = useCallback(async (edit: JarCookieEdit): Promise<boolean> => {
    const result = await writeJarCookie(edit);
    setCookieWriteFailed(result === null);
    return result !== null;
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
    <div className="dt-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-header-filter-row">
            <input
              type="text"
              className="dt-filter-input dt-filter-input--grow"
              placeholder="Filter"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
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

      <div className="dt-storage-layout">
        <nav className="dt-storage-nav" aria-label="Storage type">
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              className="dt-storage-nav-item"
              data-active={section === s.value}
              onClick={() => setSection(s.value)}
            >
              <span className="dt-storage-nav-icon">{s.icon}</span>
              {s.label}
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
              {section === 'cookies'
                ? cookiesWritable &&
                  isCookieJarSiteClearable() &&
                  (sortedCookies?.length ?? 0) > 0 && <ClearAllButton section={section} onClear={clearCookies} />
                : canWrite && entries.length > 0 && <ClearAllButton section={section} onClear={inspector.clearArea} />}
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
              />
            ) : section === 'indexeddb' || section === 'cachestorage' || section === 'quota' ? (
              inspector.available && inspector.scopes.length > 0 ? (
                section === 'indexeddb' ? (
                  <IndexedDbSection
                    idb={idb}
                    filter={textFilter}
                    onOpenRecord={openIdbRecord}
                    isRecordActive={isIdbRecordActive}
                  />
                ) : section === 'cachestorage' ? (
                  <CacheStorageSection cache={cacheStorage} filter={textFilter} />
                ) : (
                  <StorageQuotaCard quota={quota} />
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
function ClearAllButton({ section, onClear }: { section: StorageSection; onClear: () => Promise<boolean> }) {
  const [armed, setArmed] = useState(false);
  const noun = section === 'cookies' ? 'cookie in this site’s jar' : `${areaName(section)} entry`;
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
      {armed ? 'Confirm clear?' : 'Clear all'}
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
}

function CookiesBody({
  inspector,
  cookies,
  filteredCookies,
  scopeUrl,
  writable,
  onApplyEdit,
  onDelete,
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
    />
  );
}

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
 * IndexedDB / Cache Storage / quota arrive in later slices.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyEditForm, jarCookieToKey } from '../../data/cookies/cookie-edit';
import {
  isCookieJarReadable,
  isCookieJarWritable,
  type JarCookie,
  type JarCookieEdit,
  removeJarCookie,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import { useCookieJarSticky } from '../../data/cookies/use-cookie-jar';
import type { DomStorageEntry } from '../../data/storage/storage-inspector-host';
import { parseStorageKey } from '../../data/storage/storage-key';
import { useIdbBrowser } from '../../data/storage/use-idb-browser';
import {
  type StorageInspectorState,
  type StorageSection,
  useStorageInspector,
} from '../../data/storage/use-storage-inspector';
import { CookieEditPopover } from '../detail/cookies/CookieEditPopover';
import { CookiesSection } from './CookiesSection';
import { IndexedDbSection } from './IndexedDbSection';
import { StorageGrid } from './StorageGrid';

interface StoragePanelProps {
  onHide: () => void;
}

const SECTIONS: ReadonlyArray<{ value: StorageSection; label: string }> = [
  { value: 'local', label: 'Local storage' },
  { value: 'session', label: 'Session storage' },
  { value: 'cookies', label: 'Cookies' },
  { value: 'indexeddb', label: 'IndexedDB' },
];

function areaName(section: StorageSection): string {
  return section === 'session' ? 'sessionStorage' : 'localStorage';
}

export function StoragePanel({ onHide }: StoragePanelProps) {
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

  // ── IndexedDB section data (own hook, own poll) ────────────────────
  const idb = useIdbBrowser(section === 'indexeddb', selectedScope?.frameId ?? null);

  // ── Cookies section data + write plumbing (jar plane reuse) ────────
  const scopeUrl = selectedScope?.url ?? '';
  const jar = useCookieJarSticky(section === 'cookies' ? scopeUrl : '');
  const sortedCookies = useMemo<ReadonlyArray<JarCookie> | null>(() => {
    if (!jar) return jar;
    return [...jar].sort(
      (a, b) => a.name.localeCompare(b.name) || a.domain.localeCompare(b.domain) || a.path.localeCompare(b.path),
    );
  }, [jar]);
  const filteredCookies = useMemo<ReadonlyArray<JarCookie>>(() => {
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
        ? idb.databases
          ? `${idb.databases.length} ${idb.databases.length === 1 ? 'database' : 'databases'}`
          : ''
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
            ) : section === 'indexeddb' ? (
              <button
                type="button"
                className="dt-toolbar-icon"
                disabled
                title="IndexedDB is read-only here"
                aria-label="IndexedDB is read-only"
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
              {section !== 'cookies' && canWrite && entries.length > 0 && (
                <ClearAllButton section={section} onClear={inspector.clearArea} />
              )}
            </div>
          )}

          <div className="dt-storage-body">
            {section === 'cookies' ? (
              <CookiesBody
                inspector={inspector}
                cookies={sortedCookies}
                filteredCookies={filteredCookies}
                writable={cookiesWritable}
                onApplyEdit={applyCookieEdit}
                onDelete={deleteCookie}
              />
            ) : section === 'indexeddb' ? (
              inspector.available && inspector.scopes.length > 0 ? (
                <IndexedDbSection idb={idb} filter={textFilter} />
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
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      title={
        armed ? `Deletes every ${areaName(section)} entry for this origin` : `Clear all ${areaName(section)} entries`
      }
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
}

function StorageBody({ inspector, section, entries, totalCount, adding, onCloseAdd }: StorageBodyProps) {
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
    />
  );
}

interface CookiesBodyProps {
  inspector: StorageInspectorState;
  /** `null` while the first jar lookup for this scope is in flight. */
  cookies: ReadonlyArray<JarCookie> | null;
  filteredCookies: ReadonlyArray<JarCookie>;
  writable: boolean;
  onApplyEdit: (edit: JarCookieEdit) => Promise<boolean>;
  onDelete: (cookie: JarCookie) => void;
}

function CookiesBody({ inspector, cookies, filteredCookies, writable, onApplyEdit, onDelete }: CookiesBodyProps) {
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
  return <CookiesSection cookies={filteredCookies} writable={writable} onApplyEdit={onApplyEdit} onDelete={onDelete} />;
}

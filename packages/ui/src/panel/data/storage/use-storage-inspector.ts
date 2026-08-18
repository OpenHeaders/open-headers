/**
 * State + fetch loop for the Storage tool window.
 *
 * The tool window only mounts while visible (the shell renders the
 * active window per dock), so mounting this hook IS the visibility
 * gate: entries poll on a fixed cadence while mounted, scopes re-list
 * on a slower one, and a hidden DevTools window (`document.hidden`)
 * skips ticks. Standard-plane reads have no change events to ride
 * (see the storage-panel plan §2.1), so polling is the live tier here.
 *
 * The Cookies section rides the same loop with the invalidation
 * discipline: a tick doesn't read anything, it invalidates the shipped
 * jar cache for the selected scope's URL and lets the section's
 * `useCookieJarSticky` refetch through the one jar path.
 *
 * Every fetch is token-guarded: a response landing after selection or
 * navigation changed is dropped, never rendered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invalidateJarCache } from '../cookies/cookie-jar-cache';
import { useInspectedTabId } from '../inspected-tab-context';
import { notifyDomStorageWrite } from './dom-storage-write-notifier';
import type { DomStorageArea, DomStorageFullValue, DomStorageSnapshot, StorageScope } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const ENTRIES_POLL_MS = 2000;
const SCOPES_POLL_TICKS = 5; // re-list scopes every N entry ticks

/**
 * Structural compare for a scope re-list. Every poll returns a FRESH
 * array; adopting it unconditionally would change the `scopes` identity
 * each time, cascade into a new `readEntries` callback, and re-fire the
 * effects that reset the grid and restart the poll — an infinite
 * blank-and-reload loop. Unchanged data keeps the previous state object.
 */
function scopesEqual(a: ReadonlyArray<StorageScope>, b: ReadonlyArray<StorageScope>): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const o = b[i];
    return (
      s.frameId === o.frameId &&
      s.origin === o.origin &&
      s.url === o.url &&
      s.isMainFrame === o.isMainFrame &&
      s.storageKey === o.storageKey
    );
  });
}

/** The storage types the tool window's navigation rail offers. Local
 *  and Session are the two DOM storage areas; Cookies rides the jar
 *  plane; IndexedDB, Cache Storage and Usage have their own hooks
 *  (`use-idb-browser` / `use-cache-browser` / `use-storage-quota`). */
export type StorageSection = 'local' | 'session' | 'cookies' | 'indexeddb' | 'cachestorage' | 'quota';

export interface StorageInspectorState {
  /** A host is installed and the inspected tab is resolvable. */
  available: boolean;
  scopes: ReadonlyArray<StorageScope>;
  selectedOrigin: string | null;
  selectOrigin: (origin: string) => void;
  /** `null` until the first read lands, or when the read failed. */
  snapshot: DomStorageSnapshot | null;
  /** True while no read for the current selection has settled yet. */
  loading: boolean;
  /** The latest read failed (frame gone / page not injectable). */
  readFailed: boolean;
  /** The latest write failed (quota / frame gone); cleared by the next success. */
  writeFailed: boolean;
  refresh: () => void;
  /**
   * Commit an add or edit against the selected scope+area. `originalKey`
   * is `null` for an add; a changed key is a rename — Storage has no
   * rename, so the new entry is written FIRST and the old key removed
   * only after that write succeeded (a failure never loses the original).
   * Resolves `true` on success, after the grid refetched.
   */
  applyEdit: (originalKey: string | null, key: string, value: string) => Promise<boolean>;
  removeEntry: (key: string) => Promise<boolean>;
  clearArea: () => Promise<boolean>;
  /** Fetch a clipped entry's full value before editing it. */
  fetchFullValue: (key: string) => Promise<DomStorageFullValue | null>;
}

export function useStorageInspector(section: StorageSection): StorageInspectorState {
  const host = getStorageInspectorHost();
  const tabId = useInspectedTabId();
  const available = host !== null && tabId !== null;

  // The two DOM areas map onto the read/write plane; the other sections
  // park it (no entry reads) while scope discovery keeps polling.
  const area: DomStorageArea = section === 'session' ? 'session' : 'local';
  const domActive = section === 'local' || section === 'session';

  const [scopes, setScopes] = useState<ReadonlyArray<StorageScope>>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DomStorageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);

  // Selection identity for stale-guarding fetches. Bumped by every
  // selection/area change and by refresh(); a landing response compares
  // against the current value and drops itself when stale.
  const fetchTokenRef = useRef(0);

  const selectedScope = useMemo(
    () => scopes.find((s) => s.origin === selectedOrigin) ?? null,
    [scopes, selectedOrigin],
  );

  const listScopes = useCallback(async () => {
    if (!host || tabId === null) return;
    const next = await host.listScopes(tabId);
    if (next === null) return; // tab not enumerable right now — keep the last list
    setScopes((prev) => (scopesEqual(prev, next) ? prev : next));
    setSelectedOrigin((prev) => {
      if (prev !== null && next.some((s) => s.origin === prev)) return prev;
      return next[0]?.origin ?? null;
    });
  }, [host, tabId]);

  // Keyed on the frame id PRIMITIVE, not the scope object: a genuine
  // scope-list change (new iframe, same-origin navigation) must not mint
  // a new callback — and thereby reset the grid — while the selected
  // frame is still the same one.
  const selectedFrameId = selectedScope?.frameId ?? null;

  const readEntries = useCallback(async () => {
    if (!host || tabId === null || selectedFrameId === null || !domActive) return;
    const token = ++fetchTokenRef.current;
    const result = await host.readDomStorage(tabId, selectedFrameId, area);
    if (token !== fetchTokenRef.current) return;
    setLoading(false);
    if (result === null) {
      // Keep the last snapshot on a transient failure; the flag lets the
      // view render a soft "stale" note instead of blanking the grid.
      setReadFailed(true);
      return;
    }
    setReadFailed(false);
    setSnapshot(result);
  }, [host, tabId, selectedFrameId, area, domActive]);

  // Selection or area changed → drop the stale grid, read immediately.
  useEffect(() => {
    fetchTokenRef.current++;
    setSnapshot(null);
    setLoading(true);
    setReadFailed(false);
    void readEntries();
  }, [readEntries]);

  // What one poll tick does for the active section: DOM sections read
  // entries; Cookies invalidates the jar cache for the selected scope's
  // URL — the section's sticky jar hook refetches through the one jar
  // path (invalidation, not a second read plane). IndexedDB polls in its
  // own hook. Keyed on the URL PRIMITIVE for the same reason as
  // `selectedFrameId` above.
  const selectedUrl = selectedScope?.url ?? null;
  const cookiesActive = section === 'cookies';
  const pollTick = useCallback(() => {
    if (domActive) void readEntries();
    else if (cookiesActive && selectedUrl !== null) invalidateJarCache(selectedUrl);
  }, [domActive, cookiesActive, readEntries, selectedUrl]);

  // Mount → scope discovery; then the poll loop (section tick every
  // tick, scopes every SCOPES_POLL_TICKS) while the window is visible.
  useEffect(() => {
    if (!available) return;
    void listScopes();
    let tick = 0;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tick++;
      pollTick();
      if (tick % SCOPES_POLL_TICKS === 0) void listScopes();
    }, ENTRIES_POLL_MS);
    return () => clearInterval(timer);
  }, [available, listScopes, pollTick]);

  const refresh = useCallback(() => {
    void listScopes();
    pollTick();
  }, [listScopes, pollTick]);

  // Writes ride the invalidation discipline: commit through the host,
  // then refetch through the SAME read path — the grid never renders
  // data a write pushed, only what the next read observed.
  const [writeFailed, setWriteFailed] = useState(false);

  const applyEdit = useCallback(
    async (originalKey: string | null, key: string, value: string): Promise<boolean> => {
      if (!host || tabId === null || selectedFrameId === null) return false;
      let ok = await host.writeDomStorage(tabId, selectedFrameId, area, key, value);
      if (ok && originalKey !== null && originalKey !== key) {
        ok = await host.removeDomStorage(tabId, selectedFrameId, area, originalKey);
      }
      setWriteFailed(!ok);
      notifyDomStorageWrite();
      void readEntries();
      return ok;
    },
    [host, tabId, selectedFrameId, area, readEntries],
  );

  const removeEntry = useCallback(
    async (key: string): Promise<boolean> => {
      if (!host || tabId === null || selectedFrameId === null) return false;
      const ok = await host.removeDomStorage(tabId, selectedFrameId, area, key);
      setWriteFailed(!ok);
      notifyDomStorageWrite();
      void readEntries();
      return ok;
    },
    [host, tabId, selectedFrameId, area, readEntries],
  );

  const clearArea = useCallback(async (): Promise<boolean> => {
    if (!host || tabId === null || selectedFrameId === null) return false;
    const ok = await host.clearDomStorage(tabId, selectedFrameId, area);
    setWriteFailed(!ok);
    notifyDomStorageWrite();
    void readEntries();
    return ok;
  }, [host, tabId, selectedFrameId, area, readEntries]);

  const fetchFullValue = useCallback(
    async (key: string): Promise<DomStorageFullValue | null> => {
      if (!host || tabId === null || selectedFrameId === null) return null;
      return host.readDomStorageValue(tabId, selectedFrameId, area, key);
    },
    [host, tabId, selectedFrameId, area],
  );

  const selectOrigin = useCallback((origin: string) => {
    setSelectedOrigin(origin);
  }, []);

  return {
    available,
    scopes,
    selectedOrigin,
    selectOrigin,
    snapshot,
    loading,
    readFailed,
    writeFailed,
    refresh,
    applyEdit,
    removeEntry,
    clearArea,
    fetchFullValue,
  };
}

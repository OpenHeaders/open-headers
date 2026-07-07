/**
 * State + fetch loop for the Storage tool window's DOM storage view.
 *
 * The tool window only mounts while visible (the shell renders the
 * active window per dock), so mounting this hook IS the visibility
 * gate: entries poll on a fixed cadence while mounted, scopes re-list
 * on a slower one, and a hidden DevTools window (`document.hidden`)
 * skips ticks. Standard-plane reads have no change events to ride
 * (see STORAGE_PANEL_PLAN.md §2.1), so polling is the live tier here.
 *
 * Every fetch is token-guarded: a response landing after selection or
 * navigation changed is dropped, never rendered.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface StorageInspectorState {
  /** A host is installed and the inspected tab is resolvable. */
  available: boolean;
  scopes: ReadonlyArray<StorageScope>;
  selectedOrigin: string | null;
  selectOrigin: (origin: string) => void;
  area: DomStorageArea;
  setArea: (area: DomStorageArea) => void;
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

export function useStorageInspector(): StorageInspectorState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();
  const available = host !== null && tabId !== null;

  const [scopes, setScopes] = useState<ReadonlyArray<StorageScope>>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [area, setArea] = useState<DomStorageArea>('local');
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
    if (!host || tabId === null || selectedFrameId === null) return;
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
  }, [host, tabId, selectedFrameId, area]);

  // Selection or area changed → drop the stale grid, read immediately.
  useEffect(() => {
    fetchTokenRef.current++;
    setSnapshot(null);
    setLoading(true);
    setReadFailed(false);
    void readEntries();
  }, [readEntries]);

  // Mount → scope discovery; then the poll loop (entries every tick,
  // scopes every SCOPES_POLL_TICKS) while the window is visible.
  useEffect(() => {
    if (!available) return;
    void listScopes();
    let tick = 0;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tick++;
      void readEntries();
      if (tick % SCOPES_POLL_TICKS === 0) void listScopes();
    }, ENTRIES_POLL_MS);
    return () => clearInterval(timer);
  }, [available, listScopes, readEntries]);

  const refresh = useCallback(() => {
    void listScopes();
    void readEntries();
  }, [listScopes, readEntries]);

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
      void readEntries();
      return ok;
    },
    [host, tabId, selectedFrameId, area, readEntries],
  );

  const clearArea = useCallback(async (): Promise<boolean> => {
    if (!host || tabId === null || selectedFrameId === null) return false;
    const ok = await host.clearDomStorage(tabId, selectedFrameId, area);
    setWriteFailed(!ok);
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
    area,
    setArea,
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

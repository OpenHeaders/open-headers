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
import type { DomStorageArea, DomStorageSnapshot, StorageScope } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const ENTRIES_POLL_MS = 2000;
const SCOPES_POLL_TICKS = 5; // re-list scopes every N entry ticks

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
  refresh: () => void;
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
    setScopes(next);
    setSelectedOrigin((prev) => {
      if (prev !== null && next.some((s) => s.origin === prev)) return prev;
      return next[0]?.origin ?? null;
    });
  }, [host, tabId]);

  const readEntries = useCallback(async () => {
    if (!host || tabId === null || !selectedScope) return;
    const token = ++fetchTokenRef.current;
    const result = await host.readDomStorage(tabId, selectedScope.frameId, area);
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
  }, [host, tabId, selectedScope, area]);

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
    refresh,
  };
}

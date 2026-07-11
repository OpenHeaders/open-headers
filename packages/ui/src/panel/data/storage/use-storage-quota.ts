/**
 * State + fetch loop for the Storage tool window's Usage section: the
 * scope's usage/quota snapshot over the host seam. Mounted alongside
 * `useStorageInspector` and gated by `active` (hooks can't be
 * conditional); inactive means no fetches and no polling.
 *
 * Quota moves slowly, so the poll is gentler than the data sections' —
 * there is no CDP tracking event for usage, polling IS the live tier.
 * Same loop discipline as the sibling hooks: token-guarded fetches,
 * structural dedupe before every `setState` (RPCs return fresh
 * identities), callbacks keyed on primitives.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteDataType, StorageQuota } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const QUOTA_POLL_MS = 10_000;

function quotaEqual(a: StorageQuota, b: StorageQuota): boolean {
  if (a.usage !== b.usage || a.quota !== b.quota || a.overrideActive !== b.overrideActive) return false;
  const aRows = a.breakdown ?? [];
  const bRows = b.breakdown ?? [];
  if (aRows.length !== bRows.length) return false;
  return aRows.every((row, i) => row.storageType === bRows[i].storageType && row.usage === bRows[i].usage);
}

/** How long the transient "cleared" note stays up after a successful
 *  clear — long enough to register, gone before it reads as state. */
const CLEAR_SUCCESS_NOTE_MS = 4000;

export interface StorageQuotaState {
  /** `null` until the first read lands; with `loading` false it means
   *  the scope's usage can't be read (non-secure context, frame gone). */
  quota: StorageQuota | null;
  loading: boolean;
  refresh: () => void;
  /** The last clear failed — cleared by the next successful one. */
  clearFailed: boolean;
  /** The last clear succeeded — transient (auto-dismisses), the Usage
   *  section's only visible outcome since nothing disappears on it. */
  clearSucceeded: boolean;
  /** Clear the scope origin's site data (optionally a subset of the
   *  types), then refetch the usage. */
  clearSiteData: (types?: ReadonlyArray<SiteDataType>) => void;
  /** The last quota-override commit failed — cleared by the next
   *  successful one. */
  overrideFailed: boolean;
  /** Simulate a custom quota for the scope origin (`null` clears the
   *  simulation), then refetch the usage. */
  setQuotaOverride: (quotaBytes: number | null) => void;
}

export function useStorageQuota(active: boolean, frameId: number | null): StorageQuotaState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();

  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearFailed, setClearFailed] = useState(false);
  const [clearSucceeded, setClearSucceeded] = useState(false);
  const [overrideFailed, setOverrideFailed] = useState(false);
  const tokenRef = useRef(0);
  const successNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scope or activation change → drop the old scope's snapshot.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope identity is the reset trigger
  useEffect(() => {
    tokenRef.current++;
    setQuota(null);
    setLoading(true);
    setClearFailed(false);
    setClearSucceeded(false);
    setOverrideFailed(false);
  }, [active, frameId]);

  useEffect(
    () => () => {
      if (successNoteTimer.current !== null) clearTimeout(successNoteTimer.current);
    },
    [],
  );

  const readQuota = useCallback(async () => {
    if (!active || !host || tabId === null || frameId === null) return;
    const token = tokenRef.current;
    const next = await host.readQuota(tabId, frameId);
    if (token !== tokenRef.current) return;
    setLoading(false);
    if (next === null) return; // unreadable — keep the last snapshot
    setQuota((prev) => (prev && quotaEqual(prev, next) ? prev : next));
  }, [active, host, tabId, frameId]);

  useEffect(() => {
    if (!active) return;
    void readQuota();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void readQuota();
    }, QUOTA_POLL_MS);
    return () => clearInterval(timer);
  }, [active, readQuota]);

  const refresh = useCallback(() => {
    void readQuota();
  }, [readQuota]);

  // The clear rides the invalidation discipline: commit through the
  // host, then refetch through the SAME read path — the card only ever
  // shows what the next read observed. The other sections' hooks refetch
  // on their own next activation/poll.
  const clearSiteData = useCallback(
    (types?: ReadonlyArray<SiteDataType>) => {
      if (!host || tabId === null || frameId === null) return;
      void host.clearSiteData(tabId, frameId, types).then((ok) => {
        setClearFailed(!ok);
        setClearSucceeded(ok);
        if (successNoteTimer.current !== null) clearTimeout(successNoteTimer.current);
        if (ok) successNoteTimer.current = setTimeout(() => setClearSucceeded(false), CLEAR_SUCCESS_NOTE_MS);
        void readQuota();
      });
    },
    [host, tabId, frameId, readQuota],
  );

  const setQuotaOverride = useCallback(
    (quotaBytes: number | null) => {
      if (!host || tabId === null || frameId === null) return;
      void host.setQuotaOverride(tabId, frameId, quotaBytes).then((ok) => {
        setOverrideFailed(!ok);
        void readQuota();
      });
    },
    [host, tabId, frameId, readQuota],
  );

  return { quota, loading, refresh, clearFailed, clearSucceeded, clearSiteData, overrideFailed, setQuotaOverride };
}

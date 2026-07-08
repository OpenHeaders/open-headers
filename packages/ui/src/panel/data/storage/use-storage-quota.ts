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
import type { StorageQuota } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const QUOTA_POLL_MS = 10_000;

function quotaEqual(a: StorageQuota, b: StorageQuota): boolean {
  if (a.usage !== b.usage || a.quota !== b.quota) return false;
  const aRows = a.breakdown ?? [];
  const bRows = b.breakdown ?? [];
  if (aRows.length !== bRows.length) return false;
  return aRows.every((row, i) => row.storageType === bRows[i].storageType && row.usage === bRows[i].usage);
}

export interface StorageQuotaState {
  /** `null` until the first read lands; with `loading` false it means
   *  the scope's usage can't be read (non-secure context, frame gone). */
  quota: StorageQuota | null;
  loading: boolean;
  refresh: () => void;
}

export function useStorageQuota(active: boolean, frameId: number | null): StorageQuotaState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();

  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(0);

  // Scope or activation change → drop the old scope's snapshot.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope identity is the reset trigger
  useEffect(() => {
    tokenRef.current++;
    setQuota(null);
    setLoading(true);
  }, [active, frameId]);

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

  return { quota, loading, refresh };
}

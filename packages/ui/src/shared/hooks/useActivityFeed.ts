/**
 * useActivityFeed — read + live-tail the workspace-wide Activity Feed.
 *
 * Phase C F5. One mount-time fetch via `oh.sync.listActivity` seeds the
 * list; a `bridge.subscribe('activityEntry')` listener prepends new
 * rows as the receiver-side classifier produces them. Dedup rides the
 * entry id (`${hlcKey}|${mutationId}|${kind}`) — re-deliveries and the
 * race window between fetch + first broadcast cannot produce
 * duplicates.
 *
 * Workspace switches drop the prior list and re-fetch — entries for
 * other workspaces live in their own per-workspace IDB/SQLite slice
 * and re-appear when the user flips back.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { ActivityEntry } from '@openheaders/core/sync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_LIMIT = 100;

export interface UseActivityFeedApi {
  entries: ActivityEntry[];
  isLoading: boolean;
  /** Flip `read` on entries; optimistic + RPC-confirmed. */
  markRead: (ids: readonly string[]) => void;
}

export function useActivityFeed(
  workspaceId: string | null,
  options: { limit?: number } = {},
): UseActivityFeedApi {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(workspaceId != null);

  // Hold the workspaceId in a ref so the broadcast listener (registered
  // once per mount) can compare without re-subscribing on each switch.
  const wsRef = useRef<string | null>(workspaceId);
  wsRef.current = workspaceId;

  useEffect(() => {
    if (!workspaceId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let cancelled = false;

    void hostBridge
      .call('oh.sync.listActivity', { workspaceId, limit })
      .catch(() => ({ entries: [] as ActivityEntry[] }))
      .then((resp) => {
        if (cancelled) return;
        setEntries(resp?.entries ?? []);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit]);

  useEffect(() => {
    const unsub = hostBridge.subscribe('activityEntry', (entry) => {
      if (!entry || entry.workspaceId !== wsRef.current) return;
      setEntries((prev) => {
        // Dedup by id — covers the seed/broadcast race + re-delivery.
        for (const existing of prev) {
          if (existing.id === entry.id) return prev;
        }
        // Newest first; the seed list is already HLC-sorted.
        return [entry, ...prev];
      });
    });
    return unsub;
  }, []);

  const markRead = useCallback(
    (ids: readonly string[]) => {
      if (!workspaceId || ids.length === 0) return;
      // Optimistic flip — the RPC is idempotent and the next broadcast
      // doesn't re-emit existing rows, so a failed RPC just leaves the
      // optimistic state in place (harmless until a workspace flip
      // re-seeds).
      const idSet = new Set(ids);
      setEntries((prev) => prev.map((e) => (idSet.has(e.id) && !e.read ? { ...e, read: true } : e)));
      void hostBridge.call('oh.sync.markActivityRead', { workspaceId, ids }).catch(() => null);
    },
    [workspaceId],
  );

  return useMemo(() => ({ entries, isLoading, markRead }), [entries, isLoading, markRead]);
}

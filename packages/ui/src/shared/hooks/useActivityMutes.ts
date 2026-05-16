/**
 * useActivityMutes — read + live-tail the per-workspace mute list.
 *
 * Phase C F6.b. Seed via `oh.sync.listActivityMutes`, live-tail via
 * `bridge.subscribe('activityMuteChanged')`. The hook exposes a fast
 * synchronous `isMuted` lookup the panel cards consult to render the
 * Mute / Unmute button state, plus `mute` / `unmute` actions that
 * write through the bridge.
 *
 * Like {@link useActivityFeed}, the hook is host-agnostic: extension
 * workbench and (future) desktop renderer both consume it through the
 * same `hostBridge`. Workspace switch re-seeds the list.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { ActivityMuteEntry } from '@openheaders/core/sync';
import { activityMuteKey } from '@openheaders/core/sync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseActivityMutesApi {
  mutes: ActivityMuteEntry[];
  isMuted: (entityType: string, entityId: string) => boolean;
  mute: (entityType: string, entityId: string) => void;
  unmute: (entityType: string, entityId: string) => void;
}

export function useActivityMutes(workspaceId: string | null): UseActivityMutesApi {
  const [mutes, setMutes] = useState<ActivityMuteEntry[]>([]);
  // Pin the workspaceId in a ref so the broadcast listener (registered
  // once per mount) can filter without re-subscribing on each switch.
  const wsRef = useRef<string | null>(workspaceId);
  wsRef.current = workspaceId;

  useEffect(() => {
    if (!workspaceId) {
      setMutes([]);
      return;
    }
    let cancelled = false;
    void hostBridge
      .call('oh.sync.listActivityMutes', { workspaceId })
      .catch(() => ({ mutes: [] as ActivityMuteEntry[] }))
      .then((resp) => {
        if (cancelled) return;
        setMutes(resp?.mutes ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    const unsub = hostBridge.subscribe('activityMuteChanged', (change) => {
      if (!change || change.workspaceId !== wsRef.current) return;
      setMutes((prev) => {
        if (change.muted) {
          // Idempotent insert; refresh `mutedAt` on re-mute.
          const filtered = prev.filter(
            (m) => m.entityType !== change.entityType || m.entityId !== change.entityId,
          );
          filtered.push({
            workspaceId: change.workspaceId,
            entityType: change.entityType,
            entityId: change.entityId,
            mutedAt: change.at,
          });
          return filtered;
        }
        return prev.filter(
          (m) => m.entityType !== change.entityType || m.entityId !== change.entityId,
        );
      });
    });
    return unsub;
  }, []);

  const mutedSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of mutes) s.add(activityMuteKey(m.entityType, m.entityId));
    return s;
  }, [mutes]);

  const isMuted = useCallback(
    (entityType: string, entityId: string) => mutedSet.has(activityMuteKey(entityType, entityId)),
    [mutedSet],
  );

  const mute = useCallback(
    (entityType: string, entityId: string) => {
      if (!workspaceId) return;
      // Optimistic flip — the bridge call broadcasts the change back as
      // well, but the local insert keeps the UI responsive.
      setMutes((prev) => {
        const filtered = prev.filter(
          (m) => m.entityType !== entityType || m.entityId !== entityId,
        );
        filtered.push({ workspaceId, entityType, entityId, mutedAt: Date.now() });
        return filtered;
      });
      void hostBridge
        .call('oh.sync.muteActivityEntity', { workspaceId, entityType, entityId })
        .catch(() => null);
    },
    [workspaceId],
  );

  const unmute = useCallback(
    (entityType: string, entityId: string) => {
      if (!workspaceId) return;
      setMutes((prev) =>
        prev.filter((m) => m.entityType !== entityType || m.entityId !== entityId),
      );
      void hostBridge
        .call('oh.sync.unmuteActivityEntity', { workspaceId, entityType, entityId })
        .catch(() => null);
    },
    [workspaceId],
  );

  return useMemo(() => ({ mutes, isMuted, mute, unmute }), [mutes, isMuted, mute, unmute]);
}

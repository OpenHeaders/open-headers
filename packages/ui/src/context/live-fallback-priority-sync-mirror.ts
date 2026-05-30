/**
 * Renderer-side live-fallback-priority sync mirror (WS-C C14 commit 3).
 *
 * Thin adapter over {@link createSingletonEntityMirror}. The management UI
 * reads the current ranked-host members from this mirror to render the
 * reorder list and to compute the whole-list re-emit a drag produces — no
 * SW round-trip per write (§19.4). Members carry a `Principal.id`, a rank
 * `order`, and a self-reported host `label`; not sensitive.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { LIVE_FALLBACK_PRIORITY_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { type CreateSingletonMirrorOptions, createSingletonEntityMirror } from './singleton-entity-mirror';

export interface LiveFallbackPriorityMirrorEntry {
  members: Record<string, LiveFallbackPriorityMember>;
  /** Derived ranking — `Principal.id`s sorted `(order, principalId)`. */
  principalIds: string[];
}

export type LiveFallbackPriorityMirrorListener = () => void;

export interface LiveFallbackPrioritySyncMirror {
  getMirror(): LiveFallbackPriorityMirrorEntry | null;
  /** Members in ranked order, ready for display + whole-list re-emit. */
  orderedMembers(): LiveFallbackPriorityMember[];
  subscribeMirror(listener: LiveFallbackPriorityMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateLiveFallbackPrioritySyncMirrorOptions = CreateSingletonMirrorOptions;

export function createLiveFallbackPrioritySyncMirror(
  workspaceId: string,
  options: CreateLiveFallbackPrioritySyncMirrorOptions = {},
): LiveFallbackPrioritySyncMirror {
  const core = createSingletonEntityMirror<LiveFallbackPriorityMirrorEntry>(
    {
      loggerTag: 'LiveFallbackPrioritySyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, liveFallbackPriorityPostState } = event;
        if (envelope.body.type !== LIVE_FALLBACK_PRIORITY_ENTITY_TYPE) return null;
        if (!liveFallbackPriorityPostState) return 'tombstone';
        return {
          members: liveFallbackPriorityPostState.members,
          principalIds: liveFallbackPriorityPostState.principalIds,
        };
      },
      fetchSnapshot: async () => {
        const resp = await hostBridge.call('oh.sync.snapshotFallbackPriority', { workspaceId });
        const first = resp.entries[0];
        return first ? { members: first.members, principalIds: first.principalIds } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    orderedMembers: () => {
      const entry = core.get();
      if (!entry) return [];
      return entry.principalIds
        .map((id) => entry.members[id])
        .filter((m): m is LiveFallbackPriorityMember => Boolean(m));
    },
    subscribeMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's per-workspace service map: each
// workspace's mirror filters broadcasts by `event.envelope.workspaceId`
// at the shared core (M-2) and fetches its bootstrap snapshot scoped via
// `oh.sync.snapshotFallbackPriority, { workspaceId }` (M-1).

const liveFallbackPrioritySyncMirrorRegistry = createWorkspaceMirrorRegistry<LiveFallbackPrioritySyncMirror>(
  (workspaceId) => createLiveFallbackPrioritySyncMirror(workspaceId),
);

export function getLiveFallbackPrioritySyncMirrorForWorkspace(workspaceId: string): LiveFallbackPrioritySyncMirror {
  return liveFallbackPrioritySyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeLiveFallbackPrioritySyncMirrorForWorkspace(workspaceId: string): void {
  liveFallbackPrioritySyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllLiveFallbackPrioritySyncMirrors(): void {
  liveFallbackPrioritySyncMirrorRegistry.disposeAll();
}

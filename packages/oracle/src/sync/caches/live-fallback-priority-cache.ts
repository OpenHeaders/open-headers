/**
 * Live-fallback-priority cache + persistence sink (WS-C C14).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Holds
 * the synced offline-fallback host ranking, persisted under its own
 * `oh.ws.<id>.liveFallbackPriority` key (unlike the live-value cache,
 * which has no key of its own — this one is the at-rest store the
 * scheduler reads its *frozen, last-synced* copy from once the backend
 * goes offline).
 *
 * Not sensitive — members carry a `Principal.id` plus a self-reported
 * host label, no secret, so the slot is plain JSON and the entity rides
 * the normal trust-zone-wide forwarder.
 */

import { LIVE_FALLBACK_PRIORITY_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  type LiveFallbackPrioritySnapshot,
  seedLiveFallbackPriority,
} from '@openheaders/core/sync-builders/projections/live-fallback-priority-projection';
import type { LiveFallbackPriorityMember } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import { projectLiveFallbackPrioritySingleton } from '../post-state/live-fallback-priority-post-state';
import type { EntityOracle } from '../oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from '../sw-context';

const EMPTY_SNAPSHOT: LiveFallbackPrioritySnapshot = { schemaVersion: 5, members: {} };

export type LiveFallbackPriorityCacheListener = () => void;

export interface LiveFallbackPriorityCache {
  readonly workspaceId: string;
  getSnapshot(): LiveFallbackPrioritySnapshot;
  seedFromPersistedFallbackPriority(snapshot: LiveFallbackPrioritySnapshot): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: LiveFallbackPriorityCacheListener): () => void;
  dispose(): void;
}

/** Defensively read the persisted snapshot, tolerating partial / legacy shapes. */
function normalizeSnapshot(raw: unknown): LiveFallbackPrioritySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawMembers = (raw as { members?: unknown }).members;
  if (!rawMembers || typeof rawMembers !== 'object') return null;
  const members: Record<string, LiveFallbackPriorityMember> = {};
  for (const [principalId, value] of Object.entries(rawMembers as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const order = (value as { order?: unknown }).order;
    if (typeof order !== 'number') continue;
    const rawLabel = (value as { label?: unknown }).label;
    const label = typeof rawLabel === 'string' ? rawLabel : '';
    members[principalId] = { principalId, order, label };
  }
  return { schemaVersion: 5, members };
}

export function createLiveFallbackPriorityCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveFallbackPriorityCache {
  const core: SingletonEntityCache<LiveFallbackPrioritySnapshot, LiveFallbackPrioritySnapshot> =
    createSingletonEntityCache(workspaceId, oracle, broadcast, contextFactory, {
      entityType: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      loggerTag: 'LiveFallbackPriorityCache',
      emptySnapshot: EMPTY_SNAPSHOT,
      project: (o, current) => {
        const projection = projectLiveFallbackPrioritySingleton(o);
        if (!projection) return null;
        return { schemaVersion: current.schemaVersion || 5, members: projection.members };
      },
      buildSeedBatch: (input, ctx) => seedLiveFallbackPriority(input, ctx),
      persist: (scope, snapshot) => hostStorage.set(wsKeys(scope).liveFallbackPriority, snapshot),
      loadFromStorage: async (scope) => normalizeSnapshot(await hostStorage.get(wsKeys(scope).liveFallbackPriority)),
    });

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedFallbackPriority: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

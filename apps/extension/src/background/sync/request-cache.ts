/**
 * Request cache + persistence sink.
 *
 * Sits at the seam between the local oracle and `request-store.ts`,
 * mirroring the rule-cache contract:
 *
 *   - Subscribes to the oracle's broadcast bus. Every committed
 *     envelope re-projects the oracle's full materialized state to a
 *     `V5.Request[]` and updates this module's in-memory cache.
 *   - Persists the projected `V5.Request[]` back to `chrome.storage.local`
 *     under `wsKeys(ws).requests` — the existing storage layout stays
 *     intact so other subsystems (request executor, exporter,
 *     history-tracker) continue reading from it without changes.
 *   - Notifies registered listeners after each cache update so
 *     `request-store.ts` can fan out `onStoreChange` (which drives the
 *     `requestsUpdated` bridge broadcast).
 *
 * Hydration: `seedFromPersistedRequests(requests)` walks each persisted
 * `V5.Request`, builds a `seedRequest` batch via the projection, and
 * applies it through the oracle. The broadcasts that fire during
 * hydration replay through this same sink.
 *
 * Workspace-switch contract: one cache per workspace
 * (`createRequestCache(workspaceId, oracle, broadcast, ctxFactory)`);
 * dispose the previous one. `getActiveRequestCache()` returns null
 * between dispose and re-init.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectRequest, seedRequest } from '@/shared/sync/request-projection';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCacheListener = () => void;

export interface RequestCache {
  readonly workspaceId: string;
  /** Snapshot of the cached requests in stable (uid) order. */
  getRequests(): V5.Request[];
  /** Replace the cache from a list of request snapshots and seed the
   *  oracle. Drives boot-time hydration and the workspace-switch path. */
  seedFromPersistedRequests(requests: V5.Request[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. Returns an unsubscribe function. */
  onChange(listener: RequestCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createRequestCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCache {
  let requests: V5.Request[] = [];
  const listeners = new Set<RequestCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllRequests(oracle.materializeAll());
    requests = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('RequestCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((_event: BroadcastEvent) => {
    refreshFromOracle();
  });

  return {
    workspaceId,
    getRequests: () => requests,

    async seedFromPersistedRequests(persisted: V5.Request[]): Promise<void> {
      for (const request of persisted) {
        const batch = seedRequest(request, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'RequestCache',
            `seedFromPersistedRequests: request ${request.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      // Last-line refresh — guards the zero-requests case where no
      // broadcast would fire to drive refreshFromOracle.
      refreshFromOracle();
      logger.info('RequestCache', `Seeded ${persisted.length} requests for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: RequestCache | null = null;

export function setActiveRequestCache(cache: RequestCache | null): void {
  active = cache;
}

export function getActiveRequestCache(): RequestCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAllRequests(materialized: MaterializedEntity[]): V5.Request[] {
  const out: V5.Request[] = [];
  for (const m of materialized) {
    if (m.type !== REQUEST_ENTITY_TYPE) continue;
    const request = projectRequest(m);
    if (request) out.push(request);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, requests: V5.Request[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).requests, requests);
  } catch (err) {
    logger.info('RequestCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

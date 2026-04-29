/**
 * Live-variable cache + persistence sink.
 *
 * Subscribes to the oracle's broadcast bus, re-projects every LV the
 * oracle holds on every committed envelope, and persists the projected
 * `V5.LiveVariable[]` back to `chrome.storage.local` under
 * `wsKeys(ws).liveVariables`.
 *
 * Hydration: `seedFromPersistedLiveVariables(items)` walks each
 * persisted LV, builds a `seedLiveVariable` batch via the projection,
 * and applies it through the oracle.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  projectLiveVariable,
  seedLiveVariable,
} from '@/shared/sync/live-variable-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveVariableCacheListener = () => void;

export interface LiveVariableCache {
  readonly workspaceId: string;
  getLiveVariables(): V5.LiveVariable[];
  seedFromPersistedLiveVariables(items: V5.LiveVariable[]): Promise<void>;
  onChange(listener: LiveVariableCacheListener): () => void;
  dispose(): void;
}

export function createLiveVariableCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveVariableCache {
  let liveVariables: V5.LiveVariable[] = [];
  const listeners = new Set<LiveVariableCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAll(oracle.materializeAll());
    liveVariables = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('LiveVariableCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== LIVE_VARIABLE_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getLiveVariables: () => liveVariables,

    async seedFromPersistedLiveVariables(persisted: V5.LiveVariable[]): Promise<void> {
      for (const lv of persisted) {
        const batch = seedLiveVariable(lv, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'LiveVariableCache',
            `seed: lv ${lv.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info('LiveVariableCache', `Seeded ${persisted.length} live variables for ws=${workspaceId}`);
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

let active: LiveVariableCache | null = null;

export function setActiveLiveVariableCache(cache: LiveVariableCache | null): void {
  active = cache;
}

export function getActiveLiveVariableCache(): LiveVariableCache | null {
  return active;
}

function projectAll(materialized: MaterializedEntity[]): V5.LiveVariable[] {
  const out: V5.LiveVariable[] = [];
  for (const m of materialized) {
    if (m.type !== LIVE_VARIABLE_ENTITY_TYPE) continue;
    const lv = projectLiveVariable(m);
    if (lv) out.push(lv);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, items: V5.LiveVariable[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).liveVariables, items);
  } catch (err) {
    logger.info('LiveVariableCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

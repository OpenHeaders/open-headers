/**
 * OAuth-bundle cache + persistence sink (Phase B).
 *
 * Mirrors `vault-cache.ts` for the singleton oauth-bundle entity.
 * Subscribes to the oracle's broadcast bus, re-projects the materialized
 * state on every committed oauth-bundle envelope, and persists the
 * projected blob back to `chrome.storage.local` under the workspace's
 * `oauth` key so legacy readers (request-executor, offscreen-host,
 * refresh-scheduler) keep working without change.
 *
 * Hydration: `seedFromPersistedOAuthBundle(snapshot)` applies one
 * `seedOAuthBundle` batch through the oracle. Boot-time replay through
 * this same sink is idempotent and byte-stable.
 *
 * The bundle is §12.1 schema-marked sensitive in full — this cache is
 * local-only by construction. Schema-marked sensitive payload never
 * leaves the device through any sync transport (§12.3 v1 commitment).
 */

import { OAUTH_BUNDLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  type OAuthBundleSnapshot,
  seedOAuthBundle,
} from '@/shared/sync/oauth-bundle-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import { projectOAuthBundleSingleton } from './oauth-bundle-post-state';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

const EMPTY_SNAPSHOT: OAuthBundleSnapshot = {
  schemaVersion: 5,
  tokens: {},
  configs: {},
  refreshErrors: {},
};

export type OAuthBundleCacheListener = () => void;

export interface OAuthBundleCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton record. Returns the empty default until
   *  the oracle's first commit lands. */
  getSnapshot(): OAuthBundleSnapshot;
  /** Replace the cache from a persisted singleton snapshot and seed the
   *  oracle. Drives boot-time hydration and the workspace-switch path. */
  seedFromPersistedOAuthBundle(snapshot: OAuthBundleSnapshot): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: OAuthBundleCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createOAuthBundleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): OAuthBundleCache {
  let snapshot: OAuthBundleSnapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<OAuthBundleCacheListener>();

  const refreshFromOracle = (): void => {
    const projection = projectOAuthBundleSingleton(oracle);
    snapshot = projection
      ? {
          schemaVersion: snapshot.schemaVersion || 5,
          tokens: projection.tokens,
          configs: projection.configs,
          refreshErrors: projection.refreshErrors,
        }
      : EMPTY_SNAPSHOT;
    void persist(workspaceId, snapshot);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('OAuthBundleCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== OAUTH_BUNDLE_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getSnapshot: () => snapshot,

    async seedFromPersistedOAuthBundle(persisted: OAuthBundleSnapshot): Promise<void> {
      snapshot = persisted; // remember schemaVersion across the seed
      const batch = seedOAuthBundle(persisted, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'OAuthBundleCache',
          `seedFromPersistedOAuthBundle failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('OAuthBundleCache', `Seeded singleton for ws=${workspaceId}`);
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

let active: OAuthBundleCache | null = null;

export function setActiveOAuthBundleCache(cache: OAuthBundleCache | null): void {
  active = cache;
}

export function getActiveOAuthBundleCache(): OAuthBundleCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

async function persist(workspaceId: string, snapshot: OAuthBundleSnapshot): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).oauth, snapshot);
  } catch (err) {
    logger.info('OAuthBundleCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

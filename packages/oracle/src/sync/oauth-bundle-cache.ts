/**
 * OAuth-bundle cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getSnapshot`, `seedFromPersistedOAuthBundle`)
 * so call sites (request-executor, offscreen-host, refresh-scheduler)
 * stay unchanged.
 *
 * The bundle is §12.1 schema-marked sensitive in full — local-only by
 * construction. Schema-marked sensitive payload never leaves the device
 * through any sync transport (§12.3 v1 commitment).
 *
 * Notable wrinkle: the post-state projection doesn't carry
 * `schemaVersion`, so the cache uses the `beforeSeed` hook to remember
 * the persisted version across the immediately-following refresh.
 */

import { OAUTH_BUNDLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { type OAuthBundleSnapshot, seedOAuthBundle } from '@openheaders/core/sync-builders/oauth-bundle-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectOAuthBundleSingleton } from './oauth-bundle-post-state';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
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
  getSnapshot(): OAuthBundleSnapshot;
  seedFromPersistedOAuthBundle(snapshot: OAuthBundleSnapshot): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: OAuthBundleCacheListener): () => void;
  dispose(): void;
}

function normalizeBlob(raw: unknown): OAuthBundleSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY_SNAPSHOT;
  const blob = raw as Partial<OAuthBundleSnapshot>;
  return {
    schemaVersion: typeof blob.schemaVersion === 'number' ? blob.schemaVersion : 5,
    tokens: (blob.tokens && typeof blob.tokens === 'object' ? blob.tokens : {}) as Record<string, unknown>,
    configs: (blob.configs && typeof blob.configs === 'object' ? blob.configs : {}) as Record<string, unknown>,
    refreshErrors: (blob.refreshErrors && typeof blob.refreshErrors === 'object' ? blob.refreshErrors : {}) as Record<
      string,
      unknown
    >,
  };
}

export function createOAuthBundleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): OAuthBundleCache {
  const core: SingletonEntityCache<OAuthBundleSnapshot, OAuthBundleSnapshot> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: OAUTH_BUNDLE_ENTITY_TYPE,
      loggerTag: 'OAuthBundleCache',
      emptySnapshot: EMPTY_SNAPSHOT,
      project: (o, current) => {
        const projection = projectOAuthBundleSingleton(o);
        if (!projection) return null;
        return {
          schemaVersion: current.schemaVersion || 5,
          tokens: projection.tokens,
          configs: projection.configs,
          refreshErrors: projection.refreshErrors,
        };
      },
      buildSeedBatch: (input, ctx) => seedOAuthBundle(input, ctx),
      persist: (scope, snap) => hostStorage.set(wsKeys(scope).oauth, snap),
      beforeSeed: (input) => input,
      loadFromStorage: async (scope) => {
        const raw = await hostStorage.get(wsKeys(scope).oauth);
        if (!raw) return null;
        return normalizeBlob(raw);
      },
    },
  );

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedOAuthBundle: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

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
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  type OAuthBundleSnapshot,
  seedOAuthBundle,
} from '@/shared/sync/oauth-bundle-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectOAuthBundleSingleton } from './oauth-bundle-post-state';
import type { EntityOracle } from './oracle';
import {
  createSingletonEntityCache,
  type SingletonEntityCache,
} from './singleton-entity-cache';
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
  onChange(listener: OAuthBundleCacheListener): () => void;
  dispose(): void;
}

export function createOAuthBundleCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): OAuthBundleCache {
  const core: SingletonEntityCache<OAuthBundleSnapshot, OAuthBundleSnapshot> =
    createSingletonEntityCache(workspaceId, oracle, broadcast, contextFactory, {
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
      persist: (scope, snap) => extensionStorage.set(wsKeys(scope).oauth, snap),
      beforeSeed: (input) => input,
    });

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedOAuthBundle: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
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

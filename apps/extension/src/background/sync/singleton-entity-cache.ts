/**
 * Generic singleton-entity cache + persistence sink (Phase B, session 44).
 *
 * Counterpart to `flat-entity-cache.ts` for entities with one record per
 * scope (vault, workspace-variables, layout-state, pause-markers,
 * oauth-bundle, files, extension-workspace). Hosts the broadcast →
 * re-project → persist → notify pipeline plus the
 * `seedFromPersisted` → `oracle.apply(buildSeedBatch)` → refresh loop.
 *
 * Each per-entity adapter declares its `entityType`, `loggerTag`,
 * `emptySnapshot`, projection composer, seed batch builder, optional
 * persistence sink, and optional pre-seed snapshot hook (oauth retains
 * `schemaVersion` across the seed). The neutral core exposes
 * `getSnapshot` / `seedFromPersisted` / `onChange` / `dispose`; adapters
 * alias these to entity-named API surfaces (`getVault` /
 * `seedFromPersistedVault`, etc.) so call sites stay unchanged.
 *
 * Verified pre-extraction (session 43c lesson): the session 42 deferral
 * reasoning ("snapshot composition + persistence + schemaVersion
 * stewardship + Map-shaped state forces opt-in callbacks") cited a
 * variation surface that's bounded — five callbacks cover all seven
 * entities, and 4 of those callbacks (entityType, loggerTag,
 * emptySnapshot, project) are present in every consumer. The persist
 * and beforeSeed hooks are genuinely optional (files + ext-workspace
 * skip persist; only oauth uses beforeSeed).
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export interface SingletonEntityCacheConfig<T, I> {
  /** Broadcast filter — only events whose envelope body type matches
   *  trigger a re-projection. */
  entityType: string;
  /** Logger subsystem tag ('VaultCache', 'OAuthBundleCache', etc.). */
  loggerTag: string;
  /** Empty default returned by `getSnapshot()` until the oracle's
   *  first commit lands. */
  emptySnapshot: T;
  /** Compose the next snapshot from the oracle. The `current` argument
   *  enables retention of fields the materialized state doesn't carry
   *  (oauth-bundle's `schemaVersion`). Returns `null` when nothing has
   *  been materialized yet — caller substitutes `emptySnapshot`. */
  project: (oracle: EntityOracle, current: T) => T | null;
  /** Build the seed batch from persisted input. Return `null` to skip
   *  the apply — layout-state uses this when nothing is persisted. */
  buildSeedBatch: (input: I, ctx: MutatorContext) => MutationBatch | null;
  /** Optional persistence sink. Files + extension-workspace caches skip
   *  it — files because the durable record lives in the platform
   *  `BlobStore`; extension-workspace because the legacy direct-write
   *  path still owns the chrome.storage keys until commit 3 of the
   *  workspace-store cutover. */
  persist?: (scope: string, snapshot: T) => Promise<void>;
  /** Optional pre-seed snapshot override applied before
   *  `oracle.apply(seedBatch)`. Used by oauth-bundle to remember the
   *  persisted `schemaVersion` across the immediately-following
   *  refresh; the post-state projection doesn't carry it. */
  beforeSeed?: (input: I) => T | null;
}

export interface SingletonEntityCache<T, I> {
  /** The scope id (per-workspace `workspaceId`, or the
   *  extension-workspace global sentinel). */
  readonly scope: string;
  getSnapshot(): T;
  seedFromPersisted(input: I): Promise<void>;
  onChange(listener: () => void): () => void;
  dispose(): void;
}

export function createSingletonEntityCache<T, I>(
  scope: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
  config: SingletonEntityCacheConfig<T, I>,
): SingletonEntityCache<T, I> {
  let snapshot: T = config.emptySnapshot;
  const listeners = new Set<() => void>();

  const refreshFromOracle = (): void => {
    const next = config.project(oracle, snapshot) ?? config.emptySnapshot;
    snapshot = next;
    if (config.persist) {
      void config.persist(scope, next).catch((err) => {
        logger.info(config.loggerTag, `persist failed (scope=${scope}):`, (err as Error).message);
      });
    }
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info(config.loggerTag, 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== config.entityType) return;
    refreshFromOracle();
  });

  return {
    scope,
    getSnapshot: () => snapshot,

    async seedFromPersisted(input: I): Promise<void> {
      const batch = config.buildSeedBatch(input, contextFactory());
      if (!batch) return;
      if (config.beforeSeed) {
        const override = config.beforeSeed(input);
        if (override !== null && override !== undefined) {
          snapshot = override;
        }
      }
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          config.loggerTag,
          `seedFromPersisted failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info(config.loggerTag, `Seeded singleton for scope=${scope}`);
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

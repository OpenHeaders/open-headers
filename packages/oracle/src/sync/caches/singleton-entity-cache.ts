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

import type { GuardedRead } from '@openheaders/core/storage';
import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import type { BroadcastEvent, InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import type { SwMutatorContextFactory } from '../sw-context';

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
  /**
   * Read this singleton's persisted projection for `scope` from
   * `chrome.storage.local`. Symmetric to {@link persist}. Used by
   * {@link SingletonEntityCache.hydrateFromStorage} to re-seed the
   * oracle when a per-workspace service is materialized lazily —
   * without this, a freshly built oracle starts blank even though
   * `wsKeys(scope).<key>` has the data on disk. Returns `null` when
   * nothing is persisted (the cache stays at `emptySnapshot`).
   */
  loadFromStorage?: (scope: string) => Promise<I | null>;
  /**
   * Guarded variant of {@link loadFromStorage}. When provided,
   * {@link SingletonEntityCache.hydrateFromStorage} uses it instead so a
   * present-but-undecryptable persisted blob — the at-rest key was lost out
   * from under the surviving ciphertext — is told apart from an absent slot.
   * On `undecryptable` the cache enters {@link SingletonEntityCache.isLocked}
   * and refuses to seed `emptySnapshot` over the unreadable ciphertext
   * (which would let a subsequent edit tombstone the orphaned secrets), then
   * surfaces the condition via `onChange` rather than masquerading as empty.
   * Only entities holding irreplaceable secrets (the vault) wire this.
   */
  loadGuardedFromStorage?: (scope: string) => Promise<GuardedRead<I>>;
  /**
   * Predicate paired with {@link loadGuardedFromStorage}: does this snapshot
   * carry no real content? It governs when the undecryptable-baseline lock
   * lifts. The lock holds while the snapshot stays empty — so a benign empty
   * re-seed (e.g. the active-mirror bridge seeding from a `null` read) cannot
   * clear it — and lifts the moment authoritative content lands (the user
   * re-enters and writes), after which deleting everything won't re-lock.
   * Required for the lock to ever clear; omit it and the entity never locks.
   */
  isEmptySnapshot?: (snapshot: T) => boolean;
}

export interface SingletonEntityCache<T, I> {
  /** The scope id (per-workspace `workspaceId`, or the
   *  extension-workspace global sentinel). */
  readonly scope: string;
  getSnapshot(): T;
  /**
   * True when {@link hydrateFromStorage} found a present-but-undecryptable
   * persisted blob and refused to seed empty over it (the at-rest key was
   * lost). The snapshot stays at `emptySnapshot`, but consumers must treat
   * this as "locked — secrets unreadable, re-entry required", NOT "empty".
   * Clears once authoritative content lands (the user re-enters and writes);
   * a benign empty re-seed leaves it locked (see {@link SingletonEntityCacheConfig.isEmptySnapshot}).
   */
  isLocked(): boolean;
  seedFromPersisted(input: I): Promise<void>;
  /**
   * Re-project from the oracle outside the broadcast pipeline. Needed
   * after store surgery that mints no envelope (workspace eviction) —
   * there is no broadcast to trigger the re-projection, but the
   * snapshot, persistence sink, and listeners must still converge.
   */
  refresh(): void;
  /**
   * Read this singleton's persisted projection from
   * `chrome.storage.local` (via the configured `loadFromStorage`) and
   * seed the oracle. No-op when no `loadFromStorage` is configured or
   * the load returns `null`. Called by {@link buildService}'s
   * `hydrated` promise so a freshly materialized per-workspace service
   * starts with this cache populated regardless of Active state.
   */
  hydrateFromStorage(): Promise<void>;
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
  let locked = false;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info(config.loggerTag, 'listener threw:', (err as Error).message);
      }
    }
  };

  const refreshFromOracle = (): void => {
    const next = config.project(oracle, snapshot) ?? config.emptySnapshot;
    snapshot = next;
    // The undecryptable-baseline lock lifts only when authoritative content
    // lands — NOT on a benign empty re-seed. Deriving from emptiness (rather
    // than "any broadcast") keeps the active-mirror bridge's empty seed from
    // clearing the lock, while a genuine re-entry clears it for good.
    if (locked && config.isEmptySnapshot && !config.isEmptySnapshot(next)) {
      locked = false;
    }
    if (config.persist) {
      void config.persist(scope, next).catch((err) => {
        logger.info(config.loggerTag, `persist failed (scope=${scope}):`, (err as Error).message);
      });
    }
    notify();
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== config.entityType) return;
    refreshFromOracle();
  });

  const seedFromPersisted = async (input: I): Promise<void> => {
    const batch = config.buildSeedBatch(input, contextFactory());
    if (!batch) return;
    if (config.beforeSeed) {
      const override = config.beforeSeed(input);
      if (override !== null && override !== undefined) {
        snapshot = override;
      }
    }
    const result = await oracle.apply(batch, [], 'inbound');
    if (!result.ok) {
      logger.info(
        config.loggerTag,
        `seedFromPersisted failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
      );
    }
    refreshFromOracle();
    logger.info(config.loggerTag, `Seeded singleton for scope=${scope}`);
  };

  return {
    scope,
    getSnapshot: () => snapshot,
    isLocked: () => locked,

    seedFromPersisted: (input) => seedFromPersisted(input),

    refresh: refreshFromOracle,

    async hydrateFromStorage(): Promise<void> {
      if (config.loadGuardedFromStorage) {
        try {
          const result = await config.loadGuardedFromStorage(scope);
          if (result.status === 'undecryptable') {
            locked = true;
            logger.warn(
              config.loggerTag,
              `persisted ${config.entityType} is present but undecryptable (scope=${scope}); ` +
                'refusing to seed empty over it — at-rest key lost, re-entry required',
            );
            notify();
            return;
          }
          if (result.status === 'absent' || result.value === null) return;
          await seedFromPersisted(result.value);
        } catch (err) {
          logger.info(config.loggerTag, `hydrateFromStorage(scope=${scope}) failed: ${(err as Error).message}`);
        }
        return;
      }
      if (!config.loadFromStorage) return;
      try {
        const persisted = await config.loadFromStorage(scope);
        if (persisted === null) return;
        await seedFromPersisted(persisted);
      } catch (err) {
        logger.info(config.loggerTag, `hydrateFromStorage(scope=${scope}) failed: ${(err as Error).message}`);
      }
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

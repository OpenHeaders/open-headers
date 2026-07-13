/**
 * Shared cache + persistence sink for flat-list entities.
 *
 * Eight per-entity caches (rule, request, template, environment,
 * live-variable, live-workflow, request-collection, template-collection)
 * shared the same broadcast → re-project → persist → notify pipeline,
 * differing only in the entity-type tag, the projector + seeder pair,
 * the storage key, and the logger tag. This module hosts the pipeline
 * once; per-entity files become thin adapters that pass their config
 * and rename the neutral methods (`getEntities`, `seedFromPersisted`)
 * to entity-named methods (`getRules`, `seedFromPersistedRules`) that
 * existing call sites already use.
 *
 * Singleton-shaped caches (vault, oauth-bundle, workspace-variables,
 * layout-state, files, pause-markers, extension-workspace) keep their
 * own factories — their projection paths fold to one record, not a
 * sorted array, and the differences aren't worth genericizing.
 */

import type { MaterializedEntity, MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { hostStorage, type StorageKey } from '@openheaders/oracle/storage';
import type { BroadcastEvent, InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import type { SwMutatorContextFactory } from '../sw-context';

export interface FlatEntityCacheConfig<E extends { uid: string }, T extends string> {
  entityType: T;
  /** Logger tag — also used for the seed-failure log message. */
  loggerTag: string;
  /** Resolves the chrome.storage key the projection persists to. */
  storageKey: (workspaceId: string) => StorageKey<E[]>;
  /**
   * Per-entity projector — returns null when the materialized entity
   * doesn't shape into a valid `E` (tombstoned mid-batch; foreign
   * fields the schema can't validate yet).
   */
  project: (materialized: MaterializedEntity) => E | null;
  /**
   * Per-entity seed-batch builder. Used during hydration to feed the
   * oracle from `chrome.storage.local`-persisted snapshots.
   */
  seed: (entity: E, ctx: MutatorContext) => MutationBatch;
  /**
   * If `true` (default), the broadcast subscription only re-projects
   * when the envelope's body type matches `entityType`. Set `false` for
   * caches that historically re-projected on every event (request,
   * rule) — re-projection is idempotent so the filter is the strict
   * generalization, but keeping the legacy "re-project on every event"
   * shape is safer than tightening the contract in a refactor commit.
   */
  filterBroadcastByType?: boolean;
  /**
   * Read this entity's persisted projection for `scope` from
   * `chrome.storage.local`. Symmetric to the implicit persist-on-refresh
   * write (callers wire it via the per-entity cache adapter, not this
   * core). Used by {@link FlatEntityCacheCore.hydrateFromStorage} to
   * re-seed the oracle when a per-workspace service is materialized
   * lazily — without this, a freshly built oracle starts blank even
   * though `wsKeys(scope).<key>` has the data on disk. Returns `[]`
   * when nothing is persisted.
   */
  loadFromStorage?: (scope: string) => Promise<readonly E[]>;
}

export interface FlatEntityCacheCore<E> {
  readonly workspaceId: string;
  getEntities(): E[];
  seedFromPersisted(entities: E[]): Promise<void>;
  /**
   * Read this entity's persisted projection from `chrome.storage.local`
   * (via the configured `loadFromStorage`) and seed the oracle. No-op
   * when no `loadFromStorage` is configured — the cache stays whatever
   * the broadcast pipeline produces. Called by
   * {@link buildService}'s `hydrated` promise so a freshly materialized
   * per-workspace service starts with its caches populated, regardless
   * of whether it is the runtime-Active workspace.
   */
  hydrateFromStorage(): Promise<void>;
  /** Force a re-project cycle. Used by tree-shaped caches that wrap
   *  this core and want to invalidate after parent-linkage changes. */
  refresh(): void;
  onChange(listener: () => void): () => void;
  dispose(): void;
}

export function createFlatEntityCache<E extends { uid: string }, T extends string>(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
  config: FlatEntityCacheConfig<E, T>,
): FlatEntityCacheCore<E> {
  let entities: E[] = [];
  let seeding = false;
  const listeners = new Set<() => void>();
  const filter = config.filterBroadcastByType ?? true;

  const refreshFromOracle = (): void => {
    entities = projectAll(oracle.materializeAll(), config);
    void persist(workspaceId, entities, config);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info(config.loggerTag, 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    // Broadcasts fire synchronously per applied mutation, so a bulk
    // seed would otherwise re-project + persist once per entity; the
    // seed loop's end-of-loop refresh covers everything applied
    // meanwhile (it projects the whole oracle).
    if (seeding) return;
    if (filter && event.envelope.body.type !== config.entityType) return;
    refreshFromOracle();
  });

  const seedFromPersisted = async (persisted: readonly E[]): Promise<void> => {
    seeding = true;
    try {
      for (const entity of persisted) {
        const batch = config.seed(entity, contextFactory());
        const result = await oracle.apply(batch, [], 'inbound');
        if (!result.ok) {
          logger.info(
            config.loggerTag,
            `seed: ${entity.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
    } finally {
      seeding = false;
    }
    // Last-line refresh — guards the zero-entities case where no
    // broadcast would fire to drive refreshFromOracle.
    refreshFromOracle();
    logger.info(config.loggerTag, `Seeded ${persisted.length} entities for ws=${workspaceId}`);
  };

  return {
    workspaceId,
    getEntities: () => entities,

    seedFromPersisted: (persisted) => seedFromPersisted(persisted),

    async hydrateFromStorage(): Promise<void> {
      if (!config.loadFromStorage) return;
      try {
        const persisted = await config.loadFromStorage(workspaceId);
        if (persisted.length === 0) {
          // Still refresh once so consumers see an empty (not stale)
          // snapshot — the listener-driven path only fires on broadcasts.
          refreshFromOracle();
          return;
        }
        await seedFromPersisted(persisted);
      } catch (err) {
        // Storage read failures (quota, schema drift) must not block
        // service materialization. The cache stays empty; the next
        // mutation broadcast will populate it. Drift recorders inside
        // `loadFromStorage` already log the structured failure.
        logger.info(config.loggerTag, `hydrateFromStorage(ws=${workspaceId}) failed: ${(err as Error).message}`);
      }
    },

    refresh: refreshFromOracle,

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

function projectAll<E extends { uid: string }, T extends string>(
  materialized: MaterializedEntity[],
  config: FlatEntityCacheConfig<E, T>,
): E[] {
  const out: E[] = [];
  for (const m of materialized) {
    if (m.type !== config.entityType) continue;
    const entity = config.project(m);
    if (entity) out.push(entity);
  }
  // Stable order by uid so consumers (badge, exporter, tests)
  // observe deterministic outputs across SW lifetimes.
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist<E extends { uid: string }, T extends string>(
  workspaceId: string,
  entities: E[],
  config: FlatEntityCacheConfig<E, T>,
): Promise<void> {
  try {
    await hostStorage.set(config.storageKey(workspaceId), entities);
  } catch (err) {
    // chrome.storage.local writes can fail under quota pressure or
    // during extension reload teardown. Log but don't throw — the
    // in-memory cache is still consistent; the next mutation will
    // attempt another write.
    logger.info(config.loggerTag, `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

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
   * fields the schema can't validate yet). Tree leaves read their live
   * parent path off the oracle here.
   */
  project: (materialized: MaterializedEntity, oracle: EntityOracle) => E | null;
  /**
   * Order of the projected array — the order the cache persists and
   * boot-time seeding replays. Default: stable uid order. Tree leaves
   * and collections pass tree / roots order so sibling order survives
   * a restart.
   */
  arrange?: (entities: E[], oracle: EntityOracle) => E[];
  /**
   * Per-entity seed-batch builder — the one-time migration's and the
   * import path's seeding bridges' way of committing a persisted
   * projection into the oracle.
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
   * Re-project on this predicate instead of the entity-type filter.
   * Tree leaves and collections re-project on their own envelopes AND
   * on the containment envelopes their paths / order depend on (a
   * parent's `folders` / `items` slots, the roots sets).
   */
  affects?: (event: BroadcastEvent) => boolean;
  /**
   * Read this entity's persisted projection for `scope` from
   * `chrome.storage.local`. Symmetric to the implicit persist-on-refresh
   * write (callers wire it via the per-entity cache adapter, not this
   * core). The one-time migration's input:
   * {@link FlatEntityCacheCore.hydrateFromStorage} seeds it into the
   * oracle only when the replayed log holds no row of this entity type.
   * Returns `[]` when nothing is persisted.
   */
  loadFromStorage?: (scope: string) => Promise<readonly E[]>;
}

export interface FlatEntityCacheCore<E> {
  readonly workspaceId: string;
  getEntities(): E[];
  /**
   * Seed the oracle from persisted projections as real commits (logged,
   * broadcast). The one-time migration's and the import path's seeding
   * bridges' mechanism; the boot pass never seeds over a log that
   * already holds the type.
   */
  seedFromPersisted(entities: E[]): Promise<void>;
  /**
   * The boot pass over the replayed oracle, run by {@link buildService}'s
   * `hydrated` promise: re-project from the oracle and persist (the
   * storage key is the write-through cache). When the log holds no row of
   * this entity type and `loadFromStorage` returns a non-empty projection,
   * migrate it once through {@link seedFromPersisted}. No-op when no
   * `loadFromStorage` is configured and the log holds nothing.
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
    entities = projectAll(oracle, config);
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
    if (config.affects) {
      if (!config.affects(event)) return;
    } else if (filter && event.envelope.body.type !== config.entityType) return;
    refreshFromOracle();
  });

  const seedFromPersisted = async (persisted: readonly E[]): Promise<void> => {
    seeding = true;
    try {
      for (const entity of persisted) {
        const batch = config.seed(entity, contextFactory());
        const result = await oracle.apply(batch, 'inbound');
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
      try {
        // The log is the source: a type the replay touched re-projects
        // from the oracle, whatever the stored key holds.
        if (oracle.hasEntityOfType(config.entityType)) {
          refreshFromOracle();
          return;
        }
        if (!config.loadFromStorage) return;
        // The log never mentions this type: the stored projection is the
        // one-time migration's input, committed through the seed path.
        const persisted = await config.loadFromStorage(workspaceId);
        if (persisted.length === 0) {
          // Still refresh once so consumers see an empty (not stale)
          // snapshot — the listener-driven path only fires on broadcasts.
          refreshFromOracle();
          return;
        }
        await seedFromPersisted(persisted);
      } catch (err) {
        // A projection or storage failure (quota, schema drift, a
        // malformed historical row) must not block service
        // materialization. The cache stays as it was; the next mutation
        // broadcast re-projects it. Drift recorders inside
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
  oracle: EntityOracle,
  config: FlatEntityCacheConfig<E, T>,
): E[] {
  const out: E[] = [];
  for (const m of oracle.materializeAll()) {
    if (m.type !== config.entityType) continue;
    const entity = config.project(m, oracle);
    if (entity) out.push(entity);
  }
  if (config.arrange) return config.arrange(out, oracle);
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

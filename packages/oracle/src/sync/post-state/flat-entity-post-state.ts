/**
 * Shared post-state core for flat (uid-keyed) entities.
 *
 * Every flat-entity post-state file repeats the same pipeline verbatim:
 *
 *   1. `projectXPostState(oracle, envelope)` — gates on
 *      `envelope.body.type`, delegates to the by-uid projector.
 *   2. `projectXByUid(oracle, uid)` — `materializeOne` → null check →
 *      domain `projectX` → null check → compose result with optional
 *      set-derived extras.
 *
 * The variation surface across the 9 adopters is bounded:
 *   - the entity-type tag (`RULE_ENTITY_TYPE`, `ENVIRONMENT_ENTITY_TYPE`, …)
 *   - the domain projector (`projectRule`, `projectEnvironment`, …)
 *   - whether the result carries set-derived extras and which shape:
 *       * `{ setItemIds, setOrderKeys }` for ordered-set entities
 *         (rule, request, template — synthesizer-driven write paths)
 *       * `{ varUids }` for identity-by-name set entities
 *         (env, collection — variable identity = name)
 *       * none for catalog-rename-only entities (live-variable,
 *         live-workflow, request-collection, template-collection)
 *   - the result key (`rule`, `environment`, `collection`, …)
 *
 * `makeFlatEntityProjectors` consumes a config and returns the two
 * named-export functions each adapter wraps. `buildSetMembersExtras` /
 * `buildVarNamesExtras` are the two reusable extras-builders the
 * non-bare adopters compose into their `composeResult` callback.
 *
 * Folder-tree post-state lives in its own shared module
 * (`folder-tree-post-state.ts`) — folders carry parent-walk path
 * assembly that doesn't fit the flat-uid model.
 */

import type { MaterializedEntity, MutationEnvelope } from '@openheaders/core/sync';
import type { EntityOracle } from '../oracle';

/** Minimum oracle surface every flat-entity projector needs. Extras
 *  builders widen this to include `liveSetItems` / `liveOrderedSetItems`
 *  per their own typing. */
type FlatProjectorReads = Pick<EntityOracle, 'materializeOne'>;

export interface SetMembersExtras {
  setItemIds: Record<string, string[]>;
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

/** Build the `{ setItemIds, setOrderKeys }` shape used by rule / request
 *  / template post-states. One ordered read per set path; the renderer's
 *  mirror needs both the bare itemId list (legacy enumeration) AND the
 *  per-itemId order keys (synthesizer-driven write paths). Computing
 *  both from the same ordered read keeps the two views byte-aligned. */
export function buildSetMembersExtras(
  oracle: Pick<EntityOracle, 'liveOrderedSetItems'>,
  entityType: string,
  uid: string,
  paths: ReadonlyArray<string>,
): SetMembersExtras {
  const setItemIds: Record<string, string[]> = {};
  const setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {};
  for (const path of paths) {
    const items = oracle.liveOrderedSetItems(entityType, uid, path);
    if (items.length === 0) continue;
    setItemIds[path] = items.map((entry) => entry.itemId);
    setOrderKeys[path] = items.map((entry) => ({ itemId: entry.itemId, orderKey: entry.key }));
  }
  return { setItemIds, setOrderKeys };
}

/** Build the `{ varUids }` shape used by env / collection /
 *  workspace-vars post-states. Variable identity is the variable name
 *  (see `mutators/environment/types.ts`), so the oracle's set-item
 *  itemIds are the canonical name list. */
export function buildVarNamesExtras(
  oracle: Pick<EntityOracle, 'liveSetItems'>,
  entityType: string,
  uid: string,
  varsPath: string,
): { varUids: string[] } {
  return {
    varUids: oracle.liveSetItems(entityType, uid, varsPath).map((entry) => entry.itemId),
  };
}

export interface FlatEntityProjectorConfig<O extends FlatProjectorReads, T, R> {
  entityType: string;
  project: (materialized: MaterializedEntity) => T | null;
  composeResult: (entity: T, oracle: O, uid: string) => R;
}

export interface FlatEntityProjectors<O extends FlatProjectorReads, R> {
  projectPostState: (oracle: O, envelope: MutationEnvelope) => R | null;
  projectByUid: (oracle: O, uid: string) => R | null;
}

export function makeFlatEntityProjectors<O extends FlatProjectorReads, T, R>(
  config: FlatEntityProjectorConfig<O, T, R>,
): FlatEntityProjectors<O, R> {
  const projectByUid = (oracle: O, uid: string): R | null => {
    const materialized = oracle.materializeOne(config.entityType, uid);
    if (!materialized) return null;
    const entity = config.project(materialized);
    if (!entity) return null;
    return config.composeResult(entity, oracle, uid);
  };

  const projectPostState = (oracle: O, envelope: MutationEnvelope): R | null => {
    if (envelope.body.type !== config.entityType) return null;
    return projectByUid(oracle, envelope.body.id);
  };

  return { projectPostState, projectByUid };
}

// ── Singleton variant ────────────────────────────────────────────────

export interface SingletonEntityProjectorConfig<O extends FlatProjectorReads, R> {
  entityType: string;
  /** Fixed id of the singleton record (`VAULT_ID`, `LAYOUT_STATE_ID`, …). */
  entityId: string;
  /** Compose the post-state from the materialized record + oracle.
   *  Adapters pull set-derived extras (varUids, secretUids, refs, …)
   *  via direct `liveSetItems` calls inside this callback because the
   *  shape varies per entity (typed slot validation, sort + sortIndex
   *  synthesis, multiple paths into one Record). */
  compose: (materialized: MaterializedEntity, oracle: O) => R | null;
}

export interface SingletonEntityProjectors<O extends FlatProjectorReads, R> {
  projectPostState: (oracle: O, envelope: MutationEnvelope) => R | null;
  projectSingleton: (oracle: O) => R | null;
}

export function makeSingletonEntityProjectors<O extends FlatProjectorReads, R>(
  config: SingletonEntityProjectorConfig<O, R>,
): SingletonEntityProjectors<O, R> {
  const projectSingleton = (oracle: O): R | null => {
    const materialized = oracle.materializeOne(config.entityType, config.entityId);
    if (!materialized) return null;
    return config.compose(materialized, oracle);
  };

  const projectPostState = (oracle: O, envelope: MutationEnvelope): R | null => {
    if (envelope.body.type !== config.entityType) return null;
    return projectSingleton(oracle);
  };

  return { projectPostState, projectSingleton };
}

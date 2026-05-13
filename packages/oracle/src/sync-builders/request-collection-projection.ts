/**
 * Request-collection projection — `Collection ⇄ MutationBatch /
 * MaterializedEntity` for the request-collection entity type.
 *
 * Mirrors `collection-projection.ts` (rule-collection side). The
 * oracle stores variables as set members at `variables` (set member
 * identity = `variable.uid`); persisted `Collection.variables` is a
 * plain array. `seedRequestCollection` strips the `variables` array off
 * the create payload and emits one `addToSet` per variable (itemId =
 * uid); `projectRequestCollection` is the inverse via the materialized
 * `data` blob the oracle composes back from set members at materialize
 * time.
 *
 * `pinnedEnvironmentIds` / `defaultEnvironmentId` stay on the scalar
 * shell — a future surface that exposes pinned-env editing for request
 * collections would peel them off into their own paths the same way.
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
/**
 * Convert a persisted `Collection` (under request-collection
 * routing) into a `MutationBatch` of one `create` for the scalar shell
 * plus one `addToSet` per variable. All-or-nothing under the oracle's
 * per-entity lock.
 */
export function seedRequestCollection(
  collection: Collection,
  ctx: MutatorContext,
): MutationBatch {
  const shell = stripVariables(collection);

  const bodies: MutationBody[] = [
    { kind: 'create', type: REQUEST_COLLECTION_ENTITY_TYPE, id: collection.uid, payload: shell },
  ];
  for (const variable of collection.variables) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: collection.uid,
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: variable.uid,
      item: variable,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-request-collection
 * snapshot) back into a `Collection`. Returns `null` when the
 * materialized data fails basic shape checks.
 */
export function projectRequestCollection(
  materialized: MaterializedEntity,
): Collection | null {
  if (materialized.type !== REQUEST_COLLECTION_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as Collection;
}

// ── internals ─────────────────────────────────────────────────────

function stripVariables(collection: Collection): unknown {
  const shell = JSON.parse(JSON.stringify(collection)) as Record<string, unknown>;
  delete shell.variables;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Collection projection — `Collection ⇄ MutationBatch / MaterializedEntity`.
 *
 * Mirrors `env-projection.ts` for the Collection entity. The oracle
 * stores variables as set members at `variables` (set member identity =
 * `variable.uid`); persisted `Collection.variables` is a plain array.
 * `seedCollection` strips the `variables` array off the create payload
 * and emits one `addToSet` per variable (itemId = uid); `projectCollection`
 * is the inverse.
 */

import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';

/**
 * Convert a persisted `Collection` into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per variable.
 * All-or-nothing under the oracle's per-entity lock.
 */
export function seedCollection(collection: Collection, ctx: MutatorContext): MutationBatch {
  const shell = stripVariables(collection);

  const bodies: MutationBody[] = [{ kind: 'create', type: COLLECTION_ENTITY_TYPE, id: collection.uid, payload: shell }];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break at
  // materialize time.
  const nextKey = orderKeyMinter();
  for (const variable of collection.variables) {
    bodies.push({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collection.uid,
      path: COLLECTION_VARS_PATH,
      itemId: variable.uid,
      item: variable,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-collection snapshot)
 * back into a `Collection`. Returns `null` when the materialized
 * data fails basic shape checks.
 */
export function projectCollection(materialized: MaterializedEntity): Collection | null {
  if (materialized.type !== COLLECTION_ENTITY_TYPE) return null;
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

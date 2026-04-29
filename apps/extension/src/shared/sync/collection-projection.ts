/**
 * Collection projection — `V5.Collection ⇄ MutationBatch / MaterializedEntity`.
 *
 * Mirrors `env-projection.ts` for the Collection entity. The oracle
 * stores variables as set members at `variables` (set member identity =
 * variable name); persisted `V5.Collection.variables` is a plain array.
 * `seedCollection` strips the `variables` array off the create payload
 * and emits one `addToSet` per variable (itemId = name); `projectCollection`
 * is the inverse.
 */

import type { V5 } from '@openheaders/core/types';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';

/**
 * Convert a persisted `V5.Collection` into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per variable.
 * All-or-nothing under the oracle's per-entity lock.
 */
export function seedCollection(collection: V5.Collection, ctx: MutatorContext): MutationBatch {
  const shell = stripVariables(collection);

  const bodies: MutationBody[] = [
    { kind: 'create', type: COLLECTION_ENTITY_TYPE, id: collection.uid, payload: shell },
  ];
  for (const variable of collection.variables) {
    bodies.push({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collection.uid,
      path: COLLECTION_VARS_PATH,
      itemId: variable.name,
      item: variable,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-collection snapshot)
 * back into a `V5.Collection`. Returns `null` when the materialized
 * data fails basic shape checks.
 */
export function projectCollection(materialized: MaterializedEntity): V5.Collection | null {
  if (materialized.type !== COLLECTION_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.Collection;
}

// ── internals ─────────────────────────────────────────────────────

function stripVariables(collection: V5.Collection): unknown {
  const shell = JSON.parse(JSON.stringify(collection)) as Record<string, unknown>;
  delete shell.variables;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

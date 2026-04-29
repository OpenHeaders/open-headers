/**
 * Request-collection projection — `V5.Collection ⇄ MutationBatch /
 * MaterializedEntity` for the request-collection entity type.
 *
 * Mirrors `collection-projection.ts` for the rule-collection side, but
 * the catalog ships rename-only at v1: renderer surfaces don't expose
 * collection-variable / pinned-environment editing for request
 * collections. The seed therefore preserves `variables` /
 * `pinnedEnvironmentIds` / `defaultEnvironmentId` opaquely on the
 * scalar create payload rather than flattening `variables` into one
 * `addToSet` per variable. If a future surface adds variable-editing
 * for request collections, copy the rule-collection shape verbatim
 * (strip → addToSet flatten + projector inverse).
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';

/**
 * Convert a persisted `V5.Collection` (under request-collection
 * routing) into a single-mutation create batch. Variables stay on the
 * scalar payload — see file header for the additive growth path.
 */
export function seedRequestCollection(
  collection: V5.Collection,
  ctx: MutatorContext,
): MutationBatch {
  const body: MutationBody = {
    kind: 'create',
    type: REQUEST_COLLECTION_ENTITY_TYPE,
    id: collection.uid,
    payload: collection,
  };
  return mintBatch(ctx, [body]);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-request-collection
 * snapshot) back into a `V5.Collection`. Returns `null` when the
 * materialized data fails basic shape checks.
 */
export function projectRequestCollection(
  materialized: MaterializedEntity,
): V5.Collection | null {
  if (materialized.type !== REQUEST_COLLECTION_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.Collection;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

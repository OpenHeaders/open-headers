/**
 * Template-collection projection — `V5.Collection ⇄ MutationBatch /
 * MaterializedEntity` for the template-collection entity type.
 *
 * Mirrors `request-collection-projection.ts`. The catalog ships
 * rename-only at v1: renderer surfaces don't expose collection-variable
 * / pinned-environment editing for template collections. The seed
 * preserves `variables` / `pinnedEnvironmentIds` / `defaultEnvironmentId`
 * opaquely on the scalar create payload rather than flattening
 * `variables` into one `addToSet` per variable. If a future surface adds
 * variable-editing for template collections, copy the rule-collection
 * shape verbatim (strip → addToSet flatten + projector inverse).
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';

/**
 * Convert a persisted `V5.Collection` (under template-collection
 * routing) into a single-mutation create batch. Variables stay on the
 * scalar payload — see file header for the additive growth path.
 */
export function seedTemplateCollection(
  collection: V5.Collection,
  ctx: MutatorContext,
): MutationBatch {
  const body: MutationBody = {
    kind: 'create',
    type: TEMPLATE_COLLECTION_ENTITY_TYPE,
    id: collection.uid,
    payload: collection,
  };
  return mintBatch(ctx, [body]);
}

/**
 * Convert a `MaterializedEntity` (the oracle's per-template-collection
 * snapshot) back into a `V5.Collection`. Returns `null` when the
 * materialized data fails basic shape checks.
 */
export function projectTemplateCollection(
  materialized: MaterializedEntity,
): V5.Collection | null {
  if (materialized.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.Collection;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Per-envelope request-collection post-state projection.
 *
 * Same shape as `collection-post-state.ts` but routed through the
 * request-collection entity type. Catalog ships rename-only at v1, so
 * variable names are absent from the projection — the post-state only
 * carries the materialized `V5.Collection`. If a future surface adds
 * variable-editing for request collections, copy the rule-collection
 * shape (live `varNames` from `liveSetItems`).
 */

import type { SyncRequestCollectionPostState } from '@openheaders/core/protocol';
import { type MutationEnvelope, REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectRequestCollection } from '@/shared/sync/request-collection-projection';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

/**
 * Build the request-collection post-state for `envelope`. Returns null
 * for non-request-collection envelopes, deletes (entity tombstoned),
 * and any envelope whose target collection fails to project.
 */
export function projectRequestCollectionPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncRequestCollectionPostState | null {
  if (envelope.body.type !== REQUEST_COLLECTION_ENTITY_TYPE) return null;
  return projectRequestCollectionByUid(oracle, envelope.body.id);
}

/**
 * Build the request-collection post-state for a known uid. Used by the
 * snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast.
 */
export function projectRequestCollectionByUid(
  oracle: Reads,
  collectionUid: string,
): SyncRequestCollectionPostState | null {
  const materialized = oracle.materializeOne(REQUEST_COLLECTION_ENTITY_TYPE, collectionUid);
  if (!materialized) return null;
  const collection = projectRequestCollection(materialized);
  if (!collection) return null;
  return { collection };
}

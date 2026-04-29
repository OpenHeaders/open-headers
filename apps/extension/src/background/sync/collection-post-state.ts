/**
 * Per-envelope collection post-state projection (Phase B).
 *
 * Same shape as `env-post-state.ts` for the Collection entity:
 * renderer-side write helpers need the live variable names before
 * they can emit matching `removeFromSet` envelopes (variable identity
 * = name).
 */

import type { SyncCollectionPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH } from '@openheaders/core/sync';
import { projectCollection } from '@/shared/sync/collection-projection';
import type { EntityOracle } from './oracle';

/**
 * Build the collection post-state for `envelope` using `oracle`.
 * Returns `null` for non-Collection envelopes, deletes (entity
 * tombstoned), and any envelope whose target collection fails to
 * project.
 */
export function projectCollectionPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncCollectionPostState | null {
  if (envelope.body.type !== COLLECTION_ENTITY_TYPE) return null;
  return projectCollectionByUid(oracle, envelope.body.id);
}

/**
 * Build the collection post-state for a known uid. Used by the
 * snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast.
 */
export function projectCollectionByUid(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  collectionUid: string,
): SyncCollectionPostState | null {
  const materialized = oracle.materializeOne(COLLECTION_ENTITY_TYPE, collectionUid);
  if (!materialized) return null;

  const collection = projectCollection(materialized);
  if (!collection) return null;

  const varNames = oracle
    .liveSetItems(COLLECTION_ENTITY_TYPE, collectionUid, COLLECTION_VARS_PATH)
    .map((entry) => entry.itemId);

  return { collection, varNames };
}

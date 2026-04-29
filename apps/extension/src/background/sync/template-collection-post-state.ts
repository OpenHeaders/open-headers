/**
 * Per-envelope template-collection post-state projection.
 *
 * Mirrors `request-collection-post-state.ts`. The catalog ships
 * rename-only at v1, so each post-state carries `{ collection }` only.
 */

import type { SyncTemplateCollectionPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectTemplateCollection } from '@/shared/sync/template-collection-projection';
import type { EntityOracle } from './oracle';

export function projectTemplateCollectionPostState(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  envelope: MutationEnvelope,
): SyncTemplateCollectionPostState | null {
  if (envelope.body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return null;
  return projectTemplateCollectionByUid(oracle, envelope.body.id);
}

export function projectTemplateCollectionByUid(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  collectionUid: string,
): SyncTemplateCollectionPostState | null {
  const materialized = oracle.materializeOne(TEMPLATE_COLLECTION_ENTITY_TYPE, collectionUid);
  if (!materialized) return null;
  const collection = projectTemplateCollection(materialized);
  if (!collection) return null;
  return { collection };
}

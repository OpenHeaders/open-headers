/**
 * Per-envelope template-collection post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Catalog ships
 * rename-only at v1, so each post-state carries `{ collection }` only.
 */

import type { SyncTemplateCollectionPostState } from '@openheaders/core/protocol';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectTemplateCollection } from '@/shared/sync/template-collection-projection';
import { makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, V5.Collection, SyncTemplateCollectionPostState>({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  project: projectTemplateCollection,
  composeResult: (collection) => ({ collection }),
});

export const projectTemplateCollectionPostState = projectors.projectPostState;
export const projectTemplateCollectionByUid = projectors.projectByUid;

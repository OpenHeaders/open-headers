/**
 * Per-envelope template-collection post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Carries the
 * materialized `Collection`, the live variable uids (set-member
 * identity for template-collection vars), and the parent-owned `folders`
 * set order keys.
 */

import type { SyncTemplateCollectionPostState } from '@openheaders/core/protocol';
import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  TEMPLATE_FOLDER_CHILDREN_PATH,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { projectTemplateCollection } from '@openheaders/core/sync-builders/template-collection-projection';
import { buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import { buildFolderChildrenOrderKeys } from './folder-children-order-keys';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Collection, SyncTemplateCollectionPostState>({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  project: projectTemplateCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, TEMPLATE_COLLECTION_ENTITY_TYPE, uid, TEMPLATE_COLLECTION_VARS_PATH),
    setOrderKeys: buildFolderChildrenOrderKeys(
      oracle,
      TEMPLATE_COLLECTION_ENTITY_TYPE,
      uid,
      TEMPLATE_FOLDER_CHILDREN_PATH,
    ),
  }),
});

export const projectTemplateCollectionPostState = projectors.projectPostState;
export const projectTemplateCollectionByUid = projectors.projectByUid;

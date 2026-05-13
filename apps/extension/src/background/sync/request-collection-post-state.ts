/**
 * Per-envelope request-collection post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Carries the
 * materialized `Collection`, the live variable uids (set-member
 * identity for request-collection vars), and the parent-owned `folders`
 * set order keys.
 */

import type { SyncRequestCollectionPostState } from '@openheaders/core/protocol';
import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  REQUEST_FOLDER_CHILDREN_PATH,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { projectRequestCollection } from '@/shared/sync/request-collection-projection';
import { buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import { buildFolderChildrenOrderKeys } from './folder-children-order-keys';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Collection, SyncRequestCollectionPostState>({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  project: projectRequestCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, REQUEST_COLLECTION_ENTITY_TYPE, uid, REQUEST_COLLECTION_VARS_PATH),
    setOrderKeys: buildFolderChildrenOrderKeys(
      oracle,
      REQUEST_COLLECTION_ENTITY_TYPE,
      uid,
      REQUEST_FOLDER_CHILDREN_PATH,
    ),
  }),
});

export const projectRequestCollectionPostState = projectors.projectPostState;
export const projectRequestCollectionByUid = projectors.projectByUid;

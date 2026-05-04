/**
 * Per-envelope collection post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers need the live variable uids before they can emit matching
 * `removeFromSet` envelopes (variable identity = name).
 */

import type { SyncCollectionPostState } from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  FOLDER_CHILDREN_PATH,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectCollection } from '@/shared/sync/collection-projection';
import {
  buildVarNamesExtras,
  makeFlatEntityProjectors,
} from './flat-entity-post-state';
import { buildFolderChildrenOrderKeys } from './folder-children-order-keys';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, V5.Collection, SyncCollectionPostState>({
  entityType: COLLECTION_ENTITY_TYPE,
  project: projectCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, COLLECTION_ENTITY_TYPE, uid, COLLECTION_VARS_PATH),
    setOrderKeys: buildFolderChildrenOrderKeys(oracle, COLLECTION_ENTITY_TYPE, uid, FOLDER_CHILDREN_PATH),
  }),
});

export const projectCollectionPostState = projectors.projectPostState;
export const projectCollectionByUid = projectors.projectByUid;

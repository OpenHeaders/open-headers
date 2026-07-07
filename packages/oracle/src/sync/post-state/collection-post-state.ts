/**
 * Per-envelope collection post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers need the live variable uids before they can emit matching
 * `removeFromSet` envelopes (variable identity = name).
 */

import type { SyncCollectionPostState } from '@openheaders/core/protocol';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH, FOLDER_CHILDREN_PATH } from '@openheaders/core/sync';
import { projectCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import type { Collection } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Collection, SyncCollectionPostState>({
  entityType: COLLECTION_ENTITY_TYPE,
  project: projectCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, COLLECTION_ENTITY_TYPE, uid, COLLECTION_VARS_PATH),
    // Order keys for BOTH the parent-owned `folders` set (sidebar tree /
    // dnd) and the `variables` set (editor's position-preserving Save).
    setOrderKeys: buildSetMembersExtras(oracle, COLLECTION_ENTITY_TYPE, uid, [
      FOLDER_CHILDREN_PATH,
      COLLECTION_VARS_PATH,
    ]).setOrderKeys,
  }),
});

export const projectCollectionPostState = projectors.projectPostState;
export const projectCollectionByUid = projectors.projectByUid;

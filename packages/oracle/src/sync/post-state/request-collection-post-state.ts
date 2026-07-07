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
import { projectRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Collection, SyncRequestCollectionPostState>({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  project: projectRequestCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, REQUEST_COLLECTION_ENTITY_TYPE, uid, REQUEST_COLLECTION_VARS_PATH),
    // Order keys for BOTH the parent-owned `folders` set and the
    // `variables` set (editor's position-preserving Save).
    setOrderKeys: buildSetMembersExtras(oracle, REQUEST_COLLECTION_ENTITY_TYPE, uid, [
      REQUEST_FOLDER_CHILDREN_PATH,
      REQUEST_COLLECTION_VARS_PATH,
    ]).setOrderKeys,
  }),
});

export const projectRequestCollectionPostState = projectors.projectPostState;
export const projectRequestCollectionByUid = projectors.projectByUid;

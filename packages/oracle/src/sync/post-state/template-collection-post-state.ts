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
import { projectTemplateCollection } from '@openheaders/core/sync-builders/projections/template-collection-projection';
import type { Collection } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Collection, SyncTemplateCollectionPostState>({
  entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  project: projectTemplateCollection,
  composeResult: (collection, oracle, uid) => ({
    collection,
    ...buildVarNamesExtras(oracle, TEMPLATE_COLLECTION_ENTITY_TYPE, uid, TEMPLATE_COLLECTION_VARS_PATH),
    // Order keys for BOTH the parent-owned `folders` set and the
    // `variables` set (editor's position-preserving Save).
    setOrderKeys: buildSetMembersExtras(oracle, TEMPLATE_COLLECTION_ENTITY_TYPE, uid, [
      TEMPLATE_FOLDER_CHILDREN_PATH,
      TEMPLATE_COLLECTION_VARS_PATH,
    ]).setOrderKeys,
  }),
});

export const projectTemplateCollectionPostState = projectors.projectPostState;
export const projectTemplateCollectionByUid = projectors.projectByUid;

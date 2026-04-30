/**
 * Per-envelope request-collection post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Catalog ships
 * rename-only at v1, so variable names are absent from the projection
 * — the post-state only carries the materialized `V5.Collection`. If a
 * future surface adds variable-editing for request collections, copy
 * the rule-collection shape (live `varNames` from `liveSetItems`).
 */

import type { SyncRequestCollectionPostState } from '@openheaders/core/protocol';
import { REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectRequestCollection } from '@/shared/sync/request-collection-projection';
import { makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, V5.Collection, SyncRequestCollectionPostState>({
  entityType: REQUEST_COLLECTION_ENTITY_TYPE,
  project: projectRequestCollection,
  composeResult: (collection) => ({ collection }),
});

export const projectRequestCollectionPostState = projectors.projectPostState;
export const projectRequestCollectionByUid = projectors.projectByUid;

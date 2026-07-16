/**
 * Per-envelope spec post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. The one set-modeled
 * path (`files`, identity = file uid) rides along as
 * `{ setItemIds, setOrderKeys }` so renderer-side mirrors can emit
 * position-preserving upserts (§23.5) without a round-trip.
 */

import type { SyncSpecPostState } from '@openheaders/core/protocol';
import { SPEC_ENTITY_TYPE, SPEC_FILES_PATH } from '@openheaders/core/sync';
import { projectSpec } from '@openheaders/core/sync-builders/projections/spec-projection';
import type { Spec } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Spec, SyncSpecPostState>({
  entityType: SPEC_ENTITY_TYPE,
  project: projectSpec,
  composeResult: (spec, oracle, uid) => ({
    spec,
    ...buildSetMembersExtras(oracle, SPEC_ENTITY_TYPE, uid, [SPEC_FILES_PATH]),
  }),
});

export const projectSpecPostState = projectors.projectPostState;
export const projectSpecByUid = projectors.projectByUid;

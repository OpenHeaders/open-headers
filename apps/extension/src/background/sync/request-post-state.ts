/**
 * Per-envelope request post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers need the live `(itemId, orderKey)` pairs at each set-modeled
 * path on a request before they can emit matching synthesizer envelopes
 * (§19.4 synchronous-render discipline).
 */

import type { SyncRequestPostState } from '@openheaders/core/protocol';
import { REQUEST_ENTITY_TYPE, REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH } from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { projectRequest } from '@openheaders/oracle/sync-builders/request-projection';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

/** Set-modeled paths on a Request — mirrors {@link request-projection}'s SET_PATHS. */
const REQUEST_SET_PATHS = [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH] as const;

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Request, SyncRequestPostState>({
  entityType: REQUEST_ENTITY_TYPE,
  project: projectRequest,
  composeResult: (request, oracle, uid) => ({
    request,
    ...buildSetMembersExtras(oracle, REQUEST_ENTITY_TYPE, uid, REQUEST_SET_PATHS),
  }),
});

export const projectRequestPostState = projectors.projectPostState;
export const projectRequestByUid = projectors.projectByUid;

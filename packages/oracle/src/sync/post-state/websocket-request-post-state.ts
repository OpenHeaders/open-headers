/**
 * Per-envelope WebSocketRequest post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `grpc-request-post-state.ts`. Renderer-side write helpers need the
 * live `(itemId, orderKey)` pairs at the set-modeled `headers` /
 * `params` paths before they can emit matching synthesizer envelopes
 * (§19.4).
 */

import type { SyncWebSocketRequestPostState } from '@openheaders/core/protocol';
import {
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
} from '@openheaders/core/sync';
import { projectWebSocketRequest } from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import type { WebSocketRequest } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

/** Set-modeled paths on a WebSocketRequest — mirrors the projection's set handling. */
const WEBSOCKET_REQUEST_SET_PATHS = [
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
  WEBSOCKET_REQUEST_EVENTS_PATH,
] as const;

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, WebSocketRequest, SyncWebSocketRequestPostState>({
  entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
  project: projectWebSocketRequest,
  composeResult: (websocketRequest, oracle, uid) => ({
    websocketRequest,
    ...buildSetMembersExtras(oracle, WEBSOCKET_REQUEST_ENTITY_TYPE, uid, WEBSOCKET_REQUEST_SET_PATHS),
  }),
});

export const projectWebSocketRequestPostState = projectors.projectPostState;
export const projectWebSocketRequestByUid = projectors.projectByUid;

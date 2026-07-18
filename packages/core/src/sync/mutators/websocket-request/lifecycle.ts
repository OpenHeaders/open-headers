/**
 * `deleteWebSocketRequest` — WebSocket request entity lifecycle.
 * Creation goes through the seed builder
 * (`sync-builders/projections/websocket-request-projection.ts`): the
 * create payload is the scalar shell and every header/param row lands
 * as an `addToSet`, so there is no whole-entity create factory here
 * (same posture as specs and environments).
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from './types';

export interface DeleteWebSocketRequestArgs {
  webSocketRequestUid: string;
}

/** Delete a WebSocket request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteWebSocketRequest(ctx: MutatorContext, args: DeleteWebSocketRequestArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: WEBSOCKET_REQUEST_ENTITY_TYPE, id: args.webSocketRequestUid }]);
  return { batch, sideEffects: [] };
}

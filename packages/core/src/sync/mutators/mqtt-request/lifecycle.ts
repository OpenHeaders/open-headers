/**
 * `deleteMqttRequest` — MQTT request entity lifecycle. Creation goes
 * through the seed builder
 * (`sync-builders/projections/mqtt-request-projection.ts`): the create
 * payload is the scalar shell and every topic/saved-message/
 * user-property row lands as an `addToSet`, so there is no
 * whole-entity create factory here (same posture as the WebSocket
 * request).
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { MQTT_REQUEST_ENTITY_TYPE } from './types';

export interface DeleteMqttRequestArgs {
  mqttRequestUid: string;
}

/** Delete an MQTT request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteMqttRequest(ctx: MutatorContext, args: DeleteMqttRequestArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: MQTT_REQUEST_ENTITY_TYPE, id: args.mqttRequestUid }]);
  return { batch, sideEffects: [] };
}

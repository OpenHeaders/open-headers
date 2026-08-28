/**
 * `createMqttRequest` + `deleteMqttRequest` + `moveMqttRequest` — MQTT
 * request entity lifecycle as a tree child. The parent (request
 * collection or request folder) owns the slot in its `items` set,
 * tagged `type: 'mqttRequest'`. Row seeding (`topics` /
 * `savedMessages` / `userProperties`) rides the seed builder
 * (`mqtt-request-projection.ts`), which appends the parent slot via
 * {@link mqttRequestChild.slotAdd} in the same batch.
 */

import {
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderItemSlot,
  type RequestFolderParentRef,
} from '../request-folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { MQTT_REQUEST_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the requests tree for this kind. */
export const mqttRequestChild = makeChildMutators<RequestFolderParentRef, RequestFolderItemSlot>({
  entityType: MQTT_REQUEST_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: MQTT_REQUEST_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateMqttRequestArgs {
  mqttRequestUid: string;
  parent: RequestFolderParentRef;
  /** Scalar shell as `MqttRequest` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  orderKey?: string;
}

export function createMqttRequest(ctx: MutatorContext, args: CreateMqttRequestArgs): MutatorIntent {
  return mqttRequestChild.create(ctx, {
    childUid: args.mqttRequestUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteMqttRequestArgs {
  mqttRequestUid: string;
  parent: RequestFolderParentRef;
}

/** Delete an MQTT request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteMqttRequest(ctx: MutatorContext, args: DeleteMqttRequestArgs): MutatorIntent {
  return mqttRequestChild.delete(ctx, { childUid: args.mqttRequestUid, parent: args.parent });
}

export interface MoveMqttRequestArgs {
  mqttRequestUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveMqttRequest(ctx: MutatorContext, args: MoveMqttRequestArgs): MutatorIntent {
  return mqttRequestChild.move(ctx, {
    childUid: args.mqttRequestUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}

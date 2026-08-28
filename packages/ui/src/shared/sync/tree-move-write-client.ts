/**
 * Renderer-side write client for tree moves — the sidebar's one
 * `moveChild` gesture over every child kind the containment model
 * knows: the six leaf kinds (rule, the four request kinds, template)
 * under a collection or folder, and the collections on their tree's
 * roots set. Folders keep their per-tree clients (`folder-write-client`
 * and siblings); this module covers what those do not.
 *
 * A move is the parent's business: same parent → one `moveBefore`
 * with the caller's fractional key; a new parent → `removeFromSet` +
 * `addToSet` in one all-or-nothing batch. `path` is a projection and
 * is never written here. The caller mints `orderKey` between the drop
 * neighbours' live keys off the parent mirror (`keyBetween`).
 */

import {
  type ChildMutators,
  collectionChild,
  GRPC_REQUEST_ENTITY_TYPE,
  grpcRequestChild,
  MQTT_REQUEST_ENTITY_TYPE,
  mqttRequestChild,
  type ParentRefShape,
  REQUEST_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  requestChild,
  requestCollectionChild,
  ruleChild,
  TEMPLATE_ENTITY_TYPE,
  templateChild,
  templateCollectionChild,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WORKSPACE_ROOTS_REF,
  webSocketRequestChild,
} from '@openheaders/core/sync';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

/** The leaf kinds a tree `items` set holds, as spelled in the slot's `type`. */
export type TreeLeafEntityType =
  | typeof RULE_ENTITY_TYPE
  | typeof REQUEST_ENTITY_TYPE
  | typeof GRPC_REQUEST_ENTITY_TYPE
  | typeof WEBSOCKET_REQUEST_ENTITY_TYPE
  | typeof MQTT_REQUEST_ENTITY_TYPE
  | typeof TEMPLATE_ENTITY_TYPE;

export type TreeId = 'rules' | 'requests' | 'templates';

const LEAF_CHILD: Record<TreeLeafEntityType, ChildMutators<ParentRefShape>> = {
  [RULE_ENTITY_TYPE]: ruleChild,
  [REQUEST_ENTITY_TYPE]: requestChild,
  [GRPC_REQUEST_ENTITY_TYPE]: grpcRequestChild,
  [WEBSOCKET_REQUEST_ENTITY_TYPE]: webSocketRequestChild,
  [MQTT_REQUEST_ENTITY_TYPE]: mqttRequestChild,
  [TEMPLATE_ENTITY_TYPE]: templateChild,
};

const COLLECTION_CHILD: Record<TreeId, ChildMutators<ParentRefShape>> = {
  rules: collectionChild,
  requests: requestCollectionChild,
  templates: templateCollectionChild,
};

export type TreeMoveWriteOptions = BaseSyncWriteOptions;

export interface ApplyTreeLeafMoveInput {
  entityType: TreeLeafEntityType;
  uid: string;
  newParent: ParentRefShape;
  orderKey: string;
  /** Omit for a same-parent reorder. */
  oldParent?: ParentRefShape;
}

export async function applyTreeLeafMove(
  input: ApplyTreeLeafMoveInput,
  opts: TreeMoveWriteOptions,
): Promise<SyncSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `tree-move-${input.uid}` },
  );
  return applySyncPayload(
    LEAF_CHILD[input.entityType].move(ctx, {
      childUid: input.uid,
      newParent: input.newParent,
      orderKey: input.orderKey,
      oldParent: input.oldParent,
    }),
  );
}

export interface ApplyTreeCollectionMoveInput {
  tree: TreeId;
  uid: string;
  orderKey: string;
}

/** Collections reorder on their tree's roots set; they never nest. */
export async function applyTreeCollectionMove(
  input: ApplyTreeCollectionMoveInput,
  opts: TreeMoveWriteOptions,
): Promise<SyncSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `tree-move-${input.uid}` },
  );
  return applySyncPayload(
    COLLECTION_CHILD[input.tree].move(ctx, {
      childUid: input.uid,
      newParent: WORKSPACE_ROOTS_REF,
      orderKey: input.orderKey,
    }),
  );
}

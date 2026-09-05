// ── Container cascade ───────────────────────────────────────────────
//
// A deleted collection or folder takes everything under it. "Under
// it" is the parent-owned sets, not a path prefix: the oracle's
// `treeDescendants` walks the container's `folders` and `items` slots
// (every request kind — the slot marker names the catalog) and
// counts a slot-less leaf under the container its stored path names.
// A leaf's examples go first, then the leaf, then folders
// deepest-first, the container last, each as a bare entity tombstone
// (the container's own tombstone covers the slots).

import {
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutationBatch,
  type MutatorContext,
  type ParentRefShape,
  REQUEST_ENTITY_TYPE,
  type SideEffectIntent,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildGraphqlDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/graphql-request-mutations';
import { buildGrpcDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import { buildMqttDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import { buildDeleteRequestFolderEntityBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { buildWebSocketDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import { logger } from '@openheaders/core/utils';
import { REQUEST_TREE } from '@openheaders/oracle/sync/post-state/request-folder-post-state';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { treeDescendants } from '@openheaders/oracle/sync/tree-descendants';
import { applyRequestFolderMutationOrThrow, applyRequestMutationOrThrow } from './apply';
import { deleteExamples } from './response-examples';

type LeafTombstone = (uid: string, ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] };

const LEAF_TOMBSTONES: Record<string, LeafTombstone> = {
  [REQUEST_ENTITY_TYPE]: buildDeleteEntityBatch,
  [GRPC_REQUEST_ENTITY_TYPE]: buildGrpcDeleteEntityBatch,
  [WEBSOCKET_REQUEST_ENTITY_TYPE]: buildWebSocketDeleteEntityBatch,
  [MQTT_REQUEST_ENTITY_TYPE]: buildMqttDeleteEntityBatch,
  [GRAPHQL_REQUEST_ENTITY_TYPE]: buildGraphqlDeleteEntityBatch,
};

/** Tombstone everything under `parent` on the request tree: each leaf's examples, the leaf, then folders deepest-first. */
export async function deleteRequestTreeDescendants(parent: ParentRefShape, op: string): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  if (!oracle) throw new Error(`RequestStore.${op}: sync service not initialized`);
  const { folders, leaves } = treeDescendants(oracle, REQUEST_TREE, parent);
  for (const leaf of leaves) {
    await deleteExamples(leaf.examples, op);
    const tombstone = LEAF_TOMBSTONES[leaf.type];
    if (!tombstone) {
      logger.info('RequestStore', `${op}: ${leaf.type} ${leaf.uid} has no request catalog — left in place`);
      continue;
    }
    await applyRequestMutationOrThrow((ctx) => tombstone(leaf.uid, ctx), `${op}-cascade-${leaf.type}`);
  }
  for (const folderUid of folders) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
      `${op}-cascade-folder`,
    );
  }
}

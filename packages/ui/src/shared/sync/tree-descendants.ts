/**
 * What is under a request-tree container, read the way the oracle
 * reads it: the parent-owned `folders` and `items` sets, walked
 * recursively — never a path prefix. A leaf mirror entry updates only
 * on its own envelopes and a drop emits envelopes on the containers,
 * so a leaf's mirror `path` is stale after every drag; the container
 * mirrors' slots are fresh on the same drop. A slot-less leaf (an
 * old-client create the reconciler has not reached) counts under the
 * container its stored path names, as the readers render it.
 *
 * The cascade tombstones what the walk found: leaves first by kind,
 * folders deepest-first, one bare entity tombstone per batch (the
 * container's own tombstone covers the slots) — the shape the SW
 * store's cascade applies, so a container delete lands the same from
 * either surface.
 */

import {
  GRPC_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutatorContext,
  REQUEST_ENTITY_TYPE,
  type RequestFolderParentRef,
  type RequestItemType,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildGrpcDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import { buildMqttDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import { buildDeleteRequestFolderEntityBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { buildWebSocketDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import { parentPathOf } from '@openheaders/core/utils';
import {
  type GrpcRequestSyncMirror,
  getGrpcRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-request-sync-mirror';
import {
  getMqttRequestSyncMirrorForWorkspace,
  type MqttRequestSyncMirror,
} from '../../context/mirrors/mqtt-request-sync-mirror';
import { getRequestSyncMirrorForWorkspace, type RequestSyncMirror } from '../../context/mirrors/request-sync-mirror';
import {
  getWebSocketRequestSyncMirrorForWorkspace,
  type WebSocketRequestSyncMirror,
} from '../../context/mirrors/websocket-request-sync-mirror';
import type { RendererContextHandle } from '../../context/renderer-mutator-context';
import { applySyncPayload, type SyncMutationPayload, type SyncSimpleResult } from './apply-payload';
import type { RequestTreeMirrors } from './tree-placement';

/** The four leaf mirrors of the request tree. */
export interface RequestLeafMirrors {
  requestMirror: RequestSyncMirror;
  grpcMirror: GrpcRequestSyncMirror;
  websocketMirror: WebSocketRequestSyncMirror;
  mqttMirror: MqttRequestSyncMirror;
}

/** Test overrides for the four leaf mirrors a cascade reads. */
export type RequestLeafMirrorOverrides = Partial<RequestLeafMirrors>;

export function requestLeafMirrors(workspaceId: string, overrides: RequestLeafMirrorOverrides): RequestLeafMirrors {
  return {
    requestMirror: overrides.requestMirror ?? getRequestSyncMirrorForWorkspace(workspaceId),
    grpcMirror: overrides.grpcMirror ?? getGrpcRequestSyncMirrorForWorkspace(workspaceId),
    websocketMirror: overrides.websocketMirror ?? getWebSocketRequestSyncMirrorForWorkspace(workspaceId),
    mqttMirror: overrides.mqttMirror ?? getMqttRequestSyncMirrorForWorkspace(workspaceId),
  };
}

export interface RequestTreeDescendants {
  /** Folder uids under the container, deepest first. */
  folders: string[];
  /** Leaves of every kind under the container, each with the catalog its mirror names. */
  leaves: Array<{ type: RequestItemType; uid: string }>;
}

/** Everything under `parent`: its slotted subtree plus the slot-less leaves whose stored path lands in it. */
export async function requestTreeDescendants(
  tree: RequestTreeMirrors,
  leafMirrors: RequestLeafMirrors,
  parent: RequestFolderParentRef,
): Promise<RequestTreeDescendants> {
  await Promise.all([
    tree.collectionMirror.hydrated,
    tree.folderMirror.hydrated,
    ...leafKinds(leafMirrors).map((kind) => kind.hydrated),
  ]);
  const folderPaths = new Map(tree.listFolders().map((folder) => [folder.uid, folder.path]));
  const rootPath =
    parent.type === tree.kinds.collectionType
      ? tree.listCollections().find((collection) => collection.uid === parent.uid)?.path
      : folderPaths.get(parent.uid);
  const folders: string[] = [];
  const leaves: RequestTreeDescendants['leaves'] = [];
  if (rootPath === undefined) return { folders, leaves };

  const slotted = new Set<string>();
  const subtreePaths = new Set<string>([rootPath]);
  const walk = (node: RequestFolderParentRef): void => {
    const mirror = node.type === tree.kinds.collectionType ? tree.collectionMirror : tree.folderMirror;
    for (const slot of mirror.liveOrderedSetItems(node.uid, tree.childrenPath)) {
      const childPath = folderPaths.get(slot.itemId);
      if (childPath === undefined) continue;
      subtreePaths.add(childPath);
      walk({ type: tree.kinds.folderType, uid: slot.itemId });
      folders.push(slot.itemId);
    }
    for (const slot of mirror.liveOrderedSetItems(node.uid, tree.itemsPath)) {
      const kind = leafKinds(leafMirrors).find((candidate) => candidate.has(slot.itemId));
      if (!kind || slotted.has(slot.itemId)) continue;
      slotted.add(slot.itemId);
      leaves.push({ type: kind.type, uid: slot.itemId });
    }
  };
  walk(parent);

  // The by-path net for slot-less leaves: slotted anywhere means the
  // slot decides, so every container's `items` set is consulted.
  const containers: RequestFolderParentRef[] = [
    ...tree.listCollections().map((c) => ({ type: tree.kinds.collectionType, uid: c.uid })),
    ...tree.listFolders().map((f) => ({ type: tree.kinds.folderType, uid: f.uid })),
  ];
  for (const container of containers) {
    const mirror = container.type === tree.kinds.collectionType ? tree.collectionMirror : tree.folderMirror;
    for (const slot of mirror.liveOrderedSetItems(container.uid, tree.itemsPath)) slotted.add(slot.itemId);
  }
  for (const kind of leafKinds(leafMirrors)) {
    for (const leaf of kind.list()) {
      if (slotted.has(leaf.uid)) continue;
      const storedParent = parentPathOf(leaf.path);
      if (storedParent !== null && subtreePaths.has(storedParent)) leaves.push({ type: kind.type, uid: leaf.uid });
    }
  }
  return { folders, leaves };
}

interface LeafKind {
  type: RequestItemType;
  hydrated: Promise<void>;
  has: (uid: string) => boolean;
  list: () => ReadonlyArray<{ uid: string; path: string }>;
}

function leafKinds(mirrors: RequestLeafMirrors): LeafKind[] {
  return [
    {
      type: REQUEST_ENTITY_TYPE,
      hydrated: mirrors.requestMirror.hydrated,
      has: (uid) => mirrors.requestMirror.getRequestMirror(uid) !== null,
      list: () => mirrors.requestMirror.listRequests(),
    },
    {
      type: GRPC_REQUEST_ENTITY_TYPE,
      hydrated: mirrors.grpcMirror.hydrated,
      has: (uid) => mirrors.grpcMirror.getGrpcRequestMirror(uid) !== null,
      list: () => mirrors.grpcMirror.listGrpcRequests(),
    },
    {
      type: WEBSOCKET_REQUEST_ENTITY_TYPE,
      hydrated: mirrors.websocketMirror.hydrated,
      has: (uid) => mirrors.websocketMirror.getWebSocketRequestMirror(uid) !== null,
      list: () => mirrors.websocketMirror.listWebSocketRequests(),
    },
    {
      type: MQTT_REQUEST_ENTITY_TYPE,
      hydrated: mirrors.mqttMirror.hydrated,
      has: (uid) => mirrors.mqttMirror.getMqttRequestMirror(uid) !== null,
      list: () => mirrors.mqttMirror.listMqttRequests(),
    },
  ];
}

const LEAF_TOMBSTONES: Record<RequestItemType, (uid: string, ctx: MutatorContext) => SyncMutationPayload> = {
  [REQUEST_ENTITY_TYPE]: buildDeleteEntityBatch,
  [GRPC_REQUEST_ENTITY_TYPE]: buildGrpcDeleteEntityBatch,
  [WEBSOCKET_REQUEST_ENTITY_TYPE]: buildWebSocketDeleteEntityBatch,
  [MQTT_REQUEST_ENTITY_TYPE]: buildMqttDeleteEntityBatch,
};

/**
 * Tombstone every descendant — leaves first, folders deepest-first —
 * each on its own `<batchPrefix>-<kind>-<uid>` batch. Stops at the
 * first rejected batch and returns it.
 */
export async function applyRequestTreeDescendantDeletes(
  descendants: RequestTreeDescendants,
  handle: RendererContextHandle,
  batchPrefix: string,
): Promise<SyncSimpleResult> {
  for (const leaf of descendants.leaves) {
    const ctx = handle.next({ batchId: `${batchPrefix}-${leaf.type}-${leaf.uid}` });
    const ack = await applySyncPayload(LEAF_TOMBSTONES[leaf.type](leaf.uid, ctx));
    if (!ack.ok) return ack;
  }
  for (const folderUid of descendants.folders) {
    const ctx = handle.next({ batchId: `${batchPrefix}-folder-${folderUid}` });
    const ack = await applySyncPayload({ batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx), sideEffects: [] });
    if (!ack.ok) return ack;
  }
  return { ok: true };
}

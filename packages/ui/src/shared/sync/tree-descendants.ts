/**
 * What is under a node of the request tree, read the way the oracle
 * reads it: the parent-owned sets, walked — never a path prefix. A
 * leaf mirror entry updates only on its own envelopes and a drop
 * emits envelopes on the containers, so a leaf's mirror `path` is
 * stale after every drag; the container mirrors' slots are fresh on
 * the same drop, and a request mirror's `examples` slots are fresh on
 * every example create / delete (examples never move). A slot-less
 * child (an old-client create the reconciler has not reached) counts
 * under the parent its stored linkage names — the path's parent for
 * a leaf, the parent-uid field for an example — as the readers
 * render it, and only when no slot anywhere claims it.
 *
 * The cascade tombstones what the walk found, child before parent: a
 * leaf's examples, the leaf, then folders deepest-first, one bare
 * entity tombstone per batch (the parent's own tombstone covers the
 * slots) — the shape the SW store's cascade applies, so a delete
 * lands the same from either surface. Every request-delete path — a
 * single request, a folder, a collection — routes through here.
 */

import {
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_EXAMPLES_PATH,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_EXAMPLES_PATH,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MutatorContext,
  type ParentRefShape,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  type RequestFolderParentRef,
  type RequestItemType,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EXAMPLES_PATH,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { buildGrpcDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import { buildDeleteGrpcResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/grpc-response-example-mutations';
import { buildMqttDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import { buildDeleteMqttResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/mqtt-response-example-mutations';
import { buildDeleteRequestFolderEntityBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { buildDeleteResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import { buildWebSocketDeleteEntityBatch } from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import { buildDeleteWsResponseExampleEntityBatch } from '@openheaders/core/sync-builders/mutations/ws-response-example-mutations';
import { parentPathOf } from '@openheaders/core/utils';
import {
  type GrpcRequestSyncMirror,
  getGrpcRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-request-sync-mirror';
import {
  type GrpcResponseExampleSyncMirror,
  getGrpcResponseExampleSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-response-example-sync-mirror';
import {
  getMqttRequestSyncMirrorForWorkspace,
  type MqttRequestSyncMirror,
} from '../../context/mirrors/mqtt-request-sync-mirror';
import {
  getMqttResponseExampleSyncMirrorForWorkspace,
  type MqttResponseExampleSyncMirror,
} from '../../context/mirrors/mqtt-response-example-sync-mirror';
import { getRequestSyncMirrorForWorkspace, type RequestSyncMirror } from '../../context/mirrors/request-sync-mirror';
import {
  getResponseExampleSyncMirrorForWorkspace,
  type ResponseExampleSyncMirror,
} from '../../context/mirrors/response-example-sync-mirror';
import {
  getWebSocketRequestSyncMirrorForWorkspace,
  type WebSocketRequestSyncMirror,
} from '../../context/mirrors/websocket-request-sync-mirror';
import {
  getWsResponseExampleSyncMirrorForWorkspace,
  type WsResponseExampleSyncMirror,
} from '../../context/mirrors/ws-response-example-sync-mirror';
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

/** The four example mirrors, one per leaf kind. */
export interface RequestExampleMirrors {
  responseExampleMirror: ResponseExampleSyncMirror;
  grpcExampleMirror: GrpcResponseExampleSyncMirror;
  wsExampleMirror: WsResponseExampleSyncMirror;
  mqttExampleMirror: MqttResponseExampleSyncMirror;
}

/** Test overrides for the mirrors a cascade reads; an absent mirror is the workspace singleton, resolved only when its kind is read. */
export type RequestLeafMirrorOverrides = Partial<RequestLeafMirrors>;
export type RequestExampleMirrorOverrides = Partial<RequestExampleMirrors>;
export type RequestTreeMirrorOverrides = RequestLeafMirrorOverrides & RequestExampleMirrorOverrides;

export function requestLeafMirrors(workspaceId: string, overrides: RequestLeafMirrorOverrides): RequestLeafMirrors {
  return {
    requestMirror: overrides.requestMirror ?? getRequestSyncMirrorForWorkspace(workspaceId),
    grpcMirror: overrides.grpcMirror ?? getGrpcRequestSyncMirrorForWorkspace(workspaceId),
    websocketMirror: overrides.websocketMirror ?? getWebSocketRequestSyncMirrorForWorkspace(workspaceId),
    mqttMirror: overrides.mqttMirror ?? getMqttRequestSyncMirrorForWorkspace(workspaceId),
  };
}

/** A leaf under a container, with the examples it owns (child before parent in a cascade). */
export interface RequestLeafDescendant {
  type: RequestItemType;
  uid: string;
  examples: ParentRefShape[];
}

export interface RequestTreeDescendants {
  /** Folder uids under the container, deepest first. */
  folders: string[];
  /** Leaves of every kind under the container, each with the catalog its mirror names and its examples. */
  leaves: RequestLeafDescendant[];
}

/** Everything under `parent`: its slotted subtree, the slot-less leaves whose stored path lands in it, each leaf's examples. */
export async function requestTreeDescendants(
  tree: RequestTreeMirrors,
  workspaceId: string,
  mirrors: RequestTreeMirrorOverrides,
  parent: RequestFolderParentRef,
): Promise<RequestTreeDescendants> {
  const leafMirrors = requestLeafMirrors(workspaceId, mirrors);
  const kinds = leafKinds(leafMirrors);
  await Promise.all([tree.collectionMirror.hydrated, tree.folderMirror.hydrated, ...kinds.map((k) => k.hydrated)]);
  const folderPaths = new Map(tree.listFolders().map((folder) => [folder.uid, folder.path]));
  const rootPath =
    parent.type === tree.kinds.collectionType
      ? tree.listCollections().find((collection) => collection.uid === parent.uid)?.path
      : folderPaths.get(parent.uid);
  const folders: string[] = [];
  const found: Array<{ type: RequestItemType; uid: string }> = [];
  if (rootPath === undefined) return { folders, leaves: [] };

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
      const kind = kinds.find((candidate) => candidate.has(slot.itemId));
      if (!kind || slotted.has(slot.itemId)) continue;
      slotted.add(slot.itemId);
      found.push({ type: kind.type, uid: slot.itemId });
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
  for (const kind of kinds) {
    for (const leaf of kind.list()) {
      if (slotted.has(leaf.uid)) continue;
      const storedParent = parentPathOf(leaf.path);
      if (storedParent !== null && subtreePaths.has(storedParent)) found.push({ type: kind.type, uid: leaf.uid });
    }
  }

  const withMirrors = { ...mirrors, ...leafMirrors };
  const leaves: RequestLeafDescendant[] = [];
  for (const leaf of found) {
    leaves.push({ ...leaf, examples: await requestExamples(workspaceId, withMirrors, leaf) });
  }
  return { folders, leaves };
}

/**
 * The examples a request owns: the live ones its mirror's `examples`
 * slots name, plus the slot-less ones whose stored parent-uid field
 * names it and that no request's slots claim. Only the request's own
 * kind of mirrors is resolved. Empty for a type that holds no
 * examples.
 */
export async function requestExamples(
  workspaceId: string,
  mirrors: RequestTreeMirrorOverrides,
  request: ParentRefShape,
): Promise<ParentRefShape[]> {
  const kind = EXAMPLE_KINDS.find((candidate) => candidate.requestType === request.type);
  if (!kind) return [];
  const leaf = kind.leaf(workspaceId, mirrors);
  const examples = kind.examples(workspaceId, mirrors);
  await Promise.all([leaf.hydrated, examples.hydrated]);
  const out: ParentRefShape[] = [];
  const taken = new Set<string>();
  for (const slot of leaf.liveOrderedSetItems(request.uid, kind.examplesPath)) {
    if (!examples.has(slot.itemId) || taken.has(slot.itemId)) continue;
    taken.add(slot.itemId);
    out.push({ type: kind.exampleType, uid: slot.itemId });
  }
  const slottedAnywhere = new Set<string>();
  for (const holder of leaf.list()) {
    for (const slot of leaf.liveOrderedSetItems(holder.uid, kind.examplesPath)) slottedAnywhere.add(slot.itemId);
  }
  for (const example of examples.list()) {
    if (taken.has(example.uid) || slottedAnywhere.has(example.uid) || example.parentUid !== request.uid) continue;
    out.push({ type: kind.exampleType, uid: example.uid });
  }
  return out;
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

/** The request mirror slice an example walk reads: the `examples` slots per request, the requests of the kind. */
interface ExampleHolderReader {
  hydrated: Promise<void>;
  liveOrderedSetItems: (uid: string, setPath: string) => Array<{ itemId: string; orderKey: string }>;
  list: () => ReadonlyArray<{ uid: string }>;
}

/** The example mirror slice: live membership and the stored parent uid per example. */
interface ExampleReader {
  hydrated: Promise<void>;
  has: (uid: string) => boolean;
  list: () => ReadonlyArray<{ uid: string; parentUid: string }>;
}

interface ExampleKind {
  requestType: RequestItemType;
  exampleType: string;
  examplesPath: string;
  leaf: (workspaceId: string, mirrors: RequestLeafMirrorOverrides) => ExampleHolderReader;
  examples: (workspaceId: string, mirrors: RequestExampleMirrorOverrides) => ExampleReader;
}

const EXAMPLE_KINDS: ReadonlyArray<ExampleKind> = [
  {
    requestType: REQUEST_ENTITY_TYPE,
    exampleType: RESPONSE_EXAMPLE_ENTITY_TYPE,
    examplesPath: REQUEST_EXAMPLES_PATH,
    leaf: (workspaceId, mirrors) => {
      const mirror = mirrors.requestMirror ?? getRequestSyncMirrorForWorkspace(workspaceId);
      return { hydrated: mirror.hydrated, liveOrderedSetItems: mirror.liveOrderedSetItems, list: mirror.listRequests };
    },
    examples: (workspaceId, mirrors) => {
      const mirror = mirrors.responseExampleMirror ?? getResponseExampleSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        has: (uid) => mirror.getResponseExampleMirror(uid) !== null,
        list: () => mirror.listResponseExamples().map((e) => ({ uid: e.uid, parentUid: e.requestUid })),
      };
    },
  },
  {
    requestType: GRPC_REQUEST_ENTITY_TYPE,
    exampleType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
    examplesPath: GRPC_REQUEST_EXAMPLES_PATH,
    leaf: (workspaceId, mirrors) => {
      const mirror = mirrors.grpcMirror ?? getGrpcRequestSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        liveOrderedSetItems: mirror.liveOrderedSetItems,
        list: mirror.listGrpcRequests,
      };
    },
    examples: (workspaceId, mirrors) => {
      const mirror = mirrors.grpcExampleMirror ?? getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        has: (uid) => mirror.getGrpcResponseExampleMirror(uid) !== null,
        list: () => mirror.listGrpcResponseExamples().map((e) => ({ uid: e.uid, parentUid: e.grpcRequestUid })),
      };
    },
  },
  {
    requestType: WEBSOCKET_REQUEST_ENTITY_TYPE,
    exampleType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
    examplesPath: WEBSOCKET_REQUEST_EXAMPLES_PATH,
    leaf: (workspaceId, mirrors) => {
      const mirror = mirrors.websocketMirror ?? getWebSocketRequestSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        liveOrderedSetItems: mirror.liveOrderedSetItems,
        list: mirror.listWebSocketRequests,
      };
    },
    examples: (workspaceId, mirrors) => {
      const mirror = mirrors.wsExampleMirror ?? getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        has: (uid) => mirror.getWsResponseExampleMirror(uid) !== null,
        list: () => mirror.listWsResponseExamples().map((e) => ({ uid: e.uid, parentUid: e.websocketRequestUid })),
      };
    },
  },
  {
    requestType: MQTT_REQUEST_ENTITY_TYPE,
    exampleType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
    examplesPath: MQTT_REQUEST_EXAMPLES_PATH,
    leaf: (workspaceId, mirrors) => {
      const mirror = mirrors.mqttMirror ?? getMqttRequestSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        liveOrderedSetItems: mirror.liveOrderedSetItems,
        list: mirror.listMqttRequests,
      };
    },
    examples: (workspaceId, mirrors) => {
      const mirror = mirrors.mqttExampleMirror ?? getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
      return {
        hydrated: mirror.hydrated,
        has: (uid) => mirror.getMqttResponseExampleMirror(uid) !== null,
        list: () => mirror.listMqttResponseExamples().map((e) => ({ uid: e.uid, parentUid: e.mqttRequestUid })),
      };
    },
  },
];

type Tombstone = (uid: string, ctx: MutatorContext) => SyncMutationPayload;

const LEAF_TOMBSTONES: Record<RequestItemType, Tombstone> = {
  [REQUEST_ENTITY_TYPE]: buildDeleteEntityBatch,
  [GRPC_REQUEST_ENTITY_TYPE]: buildGrpcDeleteEntityBatch,
  [WEBSOCKET_REQUEST_ENTITY_TYPE]: buildWebSocketDeleteEntityBatch,
  [MQTT_REQUEST_ENTITY_TYPE]: buildMqttDeleteEntityBatch,
};

const EXAMPLE_TOMBSTONES: Record<string, Tombstone> = {
  [RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteResponseExampleEntityBatch,
  [GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteGrpcResponseExampleEntityBatch,
  [WS_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteWsResponseExampleEntityBatch,
  [MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE]: buildDeleteMqttResponseExampleEntityBatch,
};

/** Tombstone the given examples, one `<batchPrefix>-<kind>-<uid>` batch each; stops at the first rejected batch. */
export async function applyRequestExampleDeletes(
  examples: ReadonlyArray<ParentRefShape>,
  handle: RendererContextHandle,
  batchPrefix: string,
): Promise<SyncSimpleResult> {
  for (const example of examples) {
    const tombstone = EXAMPLE_TOMBSTONES[example.type];
    if (!tombstone) continue;
    const ctx = handle.next({ batchId: `${batchPrefix}-${example.type}-${example.uid}` });
    const ack = await applySyncPayload(tombstone(example.uid, ctx));
    if (!ack.ok) return ack;
  }
  return { ok: true };
}

/**
 * Tombstone every descendant, child before parent — each leaf's
 * examples then the leaf, then folders deepest-first — one
 * `<batchPrefix>-<kind>-<uid>` batch each. Stops at the first rejected
 * batch and returns it.
 */
export async function applyRequestTreeDescendantDeletes(
  descendants: RequestTreeDescendants,
  handle: RendererContextHandle,
  batchPrefix: string,
): Promise<SyncSimpleResult> {
  for (const leaf of descendants.leaves) {
    const examples = await applyRequestExampleDeletes(leaf.examples, handle, batchPrefix);
    if (!examples.ok) return examples;
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

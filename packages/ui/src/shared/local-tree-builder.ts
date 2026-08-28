/**
 * Local tree composition for diverged-tab read paths.
 *
 * The SW's rule-store / template-store maintain in-memory caches scoped
 * to the active workspace + an oracle running for that workspace; they
 * compose `CollectionTree[]` with `oracle.liveOrderedSetItems(...)` for
 * fractional-index-driven ordering. Diverged tabs in MWPT per-tab mode
 * read a different workspace's data — there is no live oracle for it,
 * so the renderer composes trees from the persisted arrays directly.
 *
 * The persisted arrays under `wsKeys(id).*` are written by the cache
 * layer in tree order (collections in roots order, folders and leaves
 * each in their parent's slot order), but a container's children are
 * ONE order — folders and leaves interleaved — and the arrays keep the
 * kinds apart, so every tree reads the interleave from its container
 * mirrors' `folders` + `items` slots merged by key (`slotsOf`), with
 * the arrays as the by-path net (`orderedChildren`).
 */

import type { PersistedLocalFolder } from '@openheaders/core/storage';
import { mergeOrderedEntries } from '@openheaders/core/sync';
import type {
  Collection,
  CollectionTree,
  GrpcRequest,
  MqttRequest,
  Request,
  Rule,
  Template,
  TreeNode,
  WebSocketRequest,
} from '@openheaders/core/types';
import { type ContainerSlots, indexTreeChildren, orderedChildren, type TreeChildIndex } from '@openheaders/core/utils';

/** A container's live child slots, both kinds merged by key — `null` when the reader has no slot source. */
export type ContainerSlotReader = (parent: { type: 'collection' | 'folder'; uid: string }) => ContainerSlots | null;

const NO_SLOTS: ContainerSlotReader = () => null;

/** The slice of a container mirror a slot reader needs. */
export interface SlotMirror {
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
}

/** A slot reader over a tree's collection + folder mirrors: each container's `folders` and `items` merged by key. */
export function mirrorSlotReader(
  collectionMirror: SlotMirror,
  folderMirror: SlotMirror,
  childrenPath: string,
  itemsPath: string,
): ContainerSlotReader {
  return (parent) => {
    const mirror = parent.type === 'collection' ? collectionMirror : folderMirror;
    return mergeOrderedEntries(
      mirror.liveOrderedSetItems(parent.uid, childrenPath),
      mirror.liveOrderedSetItems(parent.uid, itemsPath),
      (slot) => slot.orderKey,
      (slot) => slot.itemId,
    ).map((slot) => slot.itemId);
  };
}

function buildFolderChildren<TLeaf extends { uid: string }>(
  index: TreeChildIndex<PersistedLocalFolder, TLeaf>,
  parent: { type: 'collection' | 'folder'; uid: string; path: string },
  slotsOf: ContainerSlotReader,
  emitLeaf: (leaf: TLeaf) => TreeNode,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const child of orderedChildren(index, parent.path, slotsOf(parent))) {
    if (child.kind === 'leaf') {
      nodes.push(emitLeaf(child.entity));
      continue;
    }
    const folder = child.entity;
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildFolderChildren(index, { type: 'folder', uid: folder.uid, path: folder.path }, slotsOf, emitLeaf),
    });
  }
  return nodes;
}

function buildTrees<TLeaf extends { uid: string }>(
  collections: Collection[],
  folders: PersistedLocalFolder[],
  leaves: TLeaf[],
  leafPathOf: (leaf: TLeaf) => string,
  emitLeaf: (leaf: TLeaf) => TreeNode,
  slotsOf: ContainerSlotReader,
): CollectionTree[] {
  const index = indexTreeChildren(folders, leaves, (f) => f.path, leafPathOf);
  return collections.map((collection) => ({
    ...collection,
    tree: buildFolderChildren(
      index,
      { type: 'collection', uid: collection.uid, path: collection.path },
      slotsOf,
      emitLeaf,
    ),
  }));
}

export function buildLocalCollectionTrees(
  collections: Collection[],
  folders: PersistedLocalFolder[],
  rules: Rule[],
  slotsOf: ContainerSlotReader = NO_SLOTS,
): CollectionTree[] {
  return buildTrees(
    collections,
    folders,
    rules,
    (r) => r.path,
    (r) => ({ type: 'rule', uid: r.uid, name: r.name, path: r.path, ruleType: r.type, enabled: r.enabled }),
    slotsOf,
  );
}

export function buildRequestCollectionTrees(
  collections: Collection[],
  folders: PersistedLocalFolder[],
  requests: Request[],
  grpcRequests: GrpcRequest[] = [],
  websocketRequests: WebSocketRequest[] = [],
  mqttRequests: MqttRequest[] = [],
  slotsOf: ContainerSlotReader = NO_SLOTS,
): CollectionTree[] {
  // All request kinds share the collection tree (S8 scope law:
  // collections hold every request family). Children are merged per
  // parent in the parent's slot order when `slotsOf` has it; the
  // by-path net runs folders, then HTTP requests, then gRPC, then
  // WebSocket, then MQTT, each in array order.
  type RequestLeaf =
    | { kind: 'http'; uid: string; entity: Request }
    | { kind: 'grpc'; uid: string; entity: GrpcRequest }
    | { kind: 'websocket'; uid: string; entity: WebSocketRequest }
    | { kind: 'mqtt'; uid: string; entity: MqttRequest };
  const leaves: RequestLeaf[] = [
    ...requests.map((entity): RequestLeaf => ({ kind: 'http', uid: entity.uid, entity })),
    ...grpcRequests.map((entity): RequestLeaf => ({ kind: 'grpc', uid: entity.uid, entity })),
    ...websocketRequests.map((entity): RequestLeaf => ({ kind: 'websocket', uid: entity.uid, entity })),
    ...mqttRequests.map((entity): RequestLeaf => ({ kind: 'mqtt', uid: entity.uid, entity })),
  ];
  return buildTrees(
    collections,
    folders,
    leaves,
    (leaf) => leaf.entity.path,
    (leaf) =>
      leaf.kind === 'http'
        ? {
            type: 'request',
            uid: leaf.entity.uid,
            name: leaf.entity.name,
            path: leaf.entity.path,
            method: leaf.entity.method,
          }
        : leaf.kind === 'grpc'
          ? { type: 'grpc-request', uid: leaf.entity.uid, name: leaf.entity.name, path: leaf.entity.path }
          : leaf.kind === 'websocket'
            ? {
                type: 'websocket-request',
                uid: leaf.entity.uid,
                name: leaf.entity.name,
                path: leaf.entity.path,
                flavor: leaf.entity.flavor,
              }
            : { type: 'mqtt-request', uid: leaf.entity.uid, name: leaf.entity.name, path: leaf.entity.path },
    slotsOf,
  );
}

export function buildTemplateCollectionTrees(
  templateCollections: Collection[],
  templateFolders: PersistedLocalFolder[],
  templates: Template[],
  slotsOf: ContainerSlotReader = NO_SLOTS,
): CollectionTree[] {
  return buildTrees(
    templateCollections,
    templateFolders,
    templates,
    (t) => t.path,
    (t) => ({ type: 'template', uid: t.uid, name: t.name, path: t.path, ruleType: t.ruleType, icon: t.icon }),
    slotsOf,
  );
}

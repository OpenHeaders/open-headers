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
 * in their parent's slot order), so a single-kind tree reads its order
 * off the arrays alone. The requests tree holds four leaf kinds in ONE
 * `items` set and is persisted as four arrays; its cross-kind order
 * comes from the container mirrors' `items` slots (`slotsOf`), with
 * the arrays as the by-path net (`orderedChildren`).
 */

import type { PersistedLocalFolder } from '@openheaders/core/storage';
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

/** A container's live child slots, per set — `null` when the reader has no slot source. */
export type ContainerSlotReader = (parent: { type: 'collection' | 'folder'; uid: string }) => ContainerSlots | null;

const NO_SLOTS: ContainerSlotReader = () => null;

function buildFolderChildren<TLeaf extends { uid: string }>(
  index: TreeChildIndex<PersistedLocalFolder, TLeaf>,
  parent: { type: 'collection' | 'folder'; uid: string; path: string },
  slotsOf: ContainerSlotReader,
  emitLeaf: (leaf: TLeaf) => TreeNode,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const children = orderedChildren(index, parent.path, slotsOf(parent));
  for (const folder of children.folders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildFolderChildren(index, { type: 'folder', uid: folder.uid, path: folder.path }, slotsOf, emitLeaf),
    });
  }
  for (const leaf of children.leaves) nodes.push(emitLeaf(leaf));
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
  // collections hold every request family). Leaves are merged per
  // parent in the parent's `items` slot order when `slotsOf` has it;
  // the by-path net runs HTTP requests first, then gRPC, then
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

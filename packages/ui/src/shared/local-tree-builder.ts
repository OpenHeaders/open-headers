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
 * The persisted `folders` / `collections` / `templates` arrays under
 * `wsKeys(id).*` are written by the cache layer in response to oracle
 * broadcasts, so their array order already reflects the projected
 * orderedSet. The boot-fallback path in `rule-store.buildTreeForParent`
 * (when `slots.length === 0` during the SW wake → hydrate window) uses
 * the same path-string parent filter we use here.
 */

import type { PersistedLocalFolder } from '@openheaders/core/storage';
import type {
  Collection,
  CollectionTree,
  GrpcRequest,
  Request,
  Rule,
  Template,
  TreeNode,
  WebSocketRequest,
} from '@openheaders/core/types';

function parentPathOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(0, slash) : '';
}

function buildFolderChildren<TLeaf>(
  parentPath: string,
  folders: PersistedLocalFolder[],
  leaves: TLeaf[],
  leafPathOf: (leaf: TLeaf) => string,
  emitLeaf: (leaf: TLeaf) => TreeNode,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const folder of folders) {
    if (parentPathOf(folder.path) !== parentPath) continue;
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildFolderChildren(folder.path, folders, leaves, leafPathOf, emitLeaf),
    });
  }
  for (const leaf of leaves) {
    if (parentPathOf(leafPathOf(leaf)) !== parentPath) continue;
    nodes.push(emitLeaf(leaf));
  }
  return nodes;
}

export function buildLocalCollectionTrees(
  collections: Collection[],
  folders: PersistedLocalFolder[],
  rules: Rule[],
): CollectionTree[] {
  return collections.map((collection) => ({
    ...collection,
    tree: buildFolderChildren(
      collection.path,
      folders,
      rules,
      (r) => r.path,
      (r) => ({ type: 'rule', uid: r.uid, name: r.name, path: r.path, ruleType: r.type, enabled: r.enabled }),
    ),
  }));
}

export function buildRequestCollectionTrees(
  collections: Collection[],
  folders: PersistedLocalFolder[],
  requests: Request[],
  grpcRequests: GrpcRequest[] = [],
  websocketRequests: WebSocketRequest[] = [],
): CollectionTree[] {
  // All request kinds share the collection tree (S8 scope law:
  // collections hold every request family). Leaves are merged per
  // parent — HTTP requests first, then gRPC, then WebSocket, each in
  // array order.
  type RequestLeaf =
    | { kind: 'http'; entity: Request }
    | { kind: 'grpc'; entity: GrpcRequest }
    | { kind: 'websocket'; entity: WebSocketRequest };
  const leaves: RequestLeaf[] = [
    ...requests.map((entity): RequestLeaf => ({ kind: 'http', entity })),
    ...grpcRequests.map((entity): RequestLeaf => ({ kind: 'grpc', entity })),
    ...websocketRequests.map((entity): RequestLeaf => ({ kind: 'websocket', entity })),
  ];
  return collections.map((collection) => ({
    ...collection,
    tree: buildFolderChildren(
      collection.path,
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
            : {
                type: 'websocket-request',
                uid: leaf.entity.uid,
                name: leaf.entity.name,
                path: leaf.entity.path,
                flavor: leaf.entity.flavor,
              },
    ),
  }));
}

export function buildTemplateCollectionTrees(
  templateCollections: Collection[],
  templateFolders: PersistedLocalFolder[],
  templates: Template[],
): CollectionTree[] {
  return templateCollections.map((collection) => ({
    ...collection,
    tree: buildFolderChildren(
      collection.path,
      templateFolders,
      templates,
      (t) => t.path,
      (t) => ({ type: 'template', uid: t.uid, name: t.name, path: t.path, ruleType: t.ruleType, icon: t.icon }),
    ),
  }));
}

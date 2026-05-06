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

import type { V5 } from '@openheaders/core/types';
import type { PersistedLocalFolder } from './storage';

function parentPathOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(0, slash) : '';
}

function buildFolderChildren<TLeaf>(
  parentPath: string,
  folders: PersistedLocalFolder[],
  leaves: TLeaf[],
  leafPathOf: (leaf: TLeaf) => string,
  emitLeaf: (leaf: TLeaf) => V5.TreeNode,
): V5.TreeNode[] {
  const nodes: V5.TreeNode[] = [];
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
  collections: V5.Collection[],
  folders: PersistedLocalFolder[],
  rules: V5.Rule[],
): V5.CollectionTree[] {
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
  collections: V5.Collection[],
  folders: PersistedLocalFolder[],
  requests: V5.Request[],
): V5.CollectionTree[] {
  return collections.map((collection) => ({
    ...collection,
    tree: buildFolderChildren(
      collection.path,
      folders,
      requests,
      (r) => r.path,
      (r) => ({ type: 'request', uid: r.uid, name: r.name, path: r.path, method: r.method }),
    ),
  }));
}

export function buildTemplateCollectionTrees(
  templateCollections: V5.Collection[],
  templateFolders: PersistedLocalFolder[],
  templates: V5.Template[],
): V5.CollectionTree[] {
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

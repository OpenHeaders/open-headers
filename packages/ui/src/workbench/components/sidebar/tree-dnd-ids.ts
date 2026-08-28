/**
 * tree-dnd-ids — id-prefix helpers shared across the tree dnd surface.
 *
 * Sidebar tree nodes carry composed ids (`col-<uid>`, `req-folder-<uid>`,
 * `tpl-col-<uid>`, `rule-<uid>`, `grpc-request-<uid>`, …) so a single
 * flat `TreeNode[]` can host three trees side by side without uid
 * collisions. The dnd surface only needs to know which ids belong to
 * ITS tree — its collection prefix, folder prefix and leaf-kind
 * prefixes; other ids (system rows, environment leaves, response
 * examples, drafts, foreign-tree rows) pass through and are never
 * drag sources or drop targets.
 *
 * A leaf prefix is matched together with the node's `kind`, because
 * `tpl-` is also the head of `tpl-col-` and `tpl-folder-`.
 */

import type { TreeLeafEntityType } from '@openheaders/ui/shared/sync/tree-move-write-client';
import type { TreeNode } from './types';

export interface TreeDndParent {
  kind: 'collection' | 'folder';
  uid: string;
}

export interface TreeDndLeafKind {
  idPrefix: string;
  /** The slot `type` — the entity type as spelled in code. */
  entityType: TreeLeafEntityType;
}

export interface TreeDndIdConfig {
  collectionIdPrefix: string;
  folderIdPrefix: string;
  leafKinds: ReadonlyArray<TreeDndLeafKind>;
}

/** What a row is to its tree's dnd surface. */
export type TreeDndRole =
  | { role: 'collection'; uid: string }
  | { role: 'folder'; uid: string }
  | { role: 'leaf'; uid: string; entityType: TreeLeafEntityType };

export function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

export function parentFromId(id: string, config: TreeDndIdConfig): TreeDndParent | null {
  const collectionUid = stripPrefix(id, config.collectionIdPrefix);
  if (collectionUid) return { kind: 'collection', uid: collectionUid };
  const folderUid = stripPrefix(id, config.folderIdPrefix);
  if (folderUid) return { kind: 'folder', uid: folderUid };
  return null;
}

/** The node's role in this tree, `null` for a non-participant. */
export function roleOf(node: TreeNode, config: TreeDndIdConfig): TreeDndRole | null {
  if (node.kind === 'group') {
    const uid = stripPrefix(node.id, config.collectionIdPrefix);
    return uid ? { role: 'collection', uid } : null;
  }
  if (node.kind === 'folder') {
    const uid = stripPrefix(node.id, config.folderIdPrefix);
    return uid ? { role: 'folder', uid } : null;
  }
  if (node.kind === 'leaf') {
    for (const kind of config.leafKinds) {
      const uid = stripPrefix(node.id, kind.idPrefix);
      if (uid) return { role: 'leaf', uid, entityType: kind.entityType };
    }
  }
  return null;
}

/** The parent ref of a participant row from its `parentId`. */
export function parentOf(node: TreeNode, config: TreeDndIdConfig): TreeDndParent | null {
  return node.parentId ? parentFromId(node.parentId, config) : null;
}

export function sameParent(a: TreeDndParent, b: TreeDndParent): boolean {
  return a.kind === b.kind && a.uid === b.uid;
}

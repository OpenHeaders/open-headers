/**
 * folder-dnd-ids — id-prefix helpers shared across the folder-dnd
 * surface.
 *
 * Sidebar tree nodes carry composed ids (`col-<uid>`, `req-folder-<uid>`,
 * `tpl-col-<uid>`, …) so a single flat `TreeNode[]` can host three
 * trees side by side without uid collisions. The dnd surface only
 * needs to know which ids belong to ITS tree (matching its
 * `collectionIdPrefix` / `folderIdPrefix`); other ids — system rows,
 * environment leaves, foreign-tree folder rows — pass through and are
 * never sortable / droppable participants.
 *
 * Lifted out of FolderDndTree.tsx so the placement helper can reuse
 * the same logic without a circular import.
 */

export interface FolderDndParent {
  kind: 'collection' | 'folder';
  uid: string;
}

export interface FolderDndIdConfig {
  collectionIdPrefix: string;
  folderIdPrefix: string;
}

export function stripPrefix(id: string, prefix: string): string | null {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

export function parentFromId(id: string, config: FolderDndIdConfig): FolderDndParent | null {
  const collectionUid = stripPrefix(id, config.collectionIdPrefix);
  if (collectionUid) return { kind: 'collection', uid: collectionUid };
  const folderUid = stripPrefix(id, config.folderIdPrefix);
  if (folderUid) return { kind: 'folder', uid: folderUid };
  return null;
}

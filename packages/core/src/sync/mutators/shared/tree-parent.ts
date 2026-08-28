/**
 * Parent-ref resolution for tree write sites.
 *
 * Creates and deletes carry a parent `{ type, uid }` so the slot lands
 * on the right ordered set; the surfaces that mint them still speak in
 * parent PATHS (`rules/<col>/<folder>`), so every write site needs the
 * same path → ref lookup. Authoritative answer first — the caller's
 * live collection / folder lists matched by exact path; then the path's
 * own `<slug>-<uid>` tail, which every in-app path carries by
 * construction (`toFolderName`) and which closes the gap between a
 * parent's create ack and the mirror broadcast that follows it. `null`
 * only when neither the lists nor the segment know the parent.
 */

import { extractUid, isUid, lastPathSegment } from '../../../utils/workspace';

/** Per-tree parent vocabulary: the tree's on-disk prefix and its two container kinds. */
export interface TreeParentKinds<C extends string, F extends string> {
  treePrefix: string;
  collectionType: C;
  folderType: F;
}

export interface TreeParentRef<C extends string, F extends string> {
  type: C | F;
  uid: string;
}

export interface TreeParentLookup {
  collections: ReadonlyArray<{ uid: string; path: string }>;
  folders: ReadonlyArray<{ uid: string; path: string }>;
}

export function resolveTreeParent<C extends string, F extends string>(
  parentPath: string,
  lookup: TreeParentLookup,
  kinds: TreeParentKinds<C, F>,
): TreeParentRef<C, F> | null {
  const collection = lookup.collections.find((c) => c.path === parentPath);
  if (collection) return { type: kinds.collectionType, uid: collection.uid };
  const folder = lookup.folders.find((f) => f.path === parentPath);
  if (folder) return { type: kinds.folderType, uid: folder.uid };

  const segments = parentPath.split('/');
  if (segments.length < 2 || segments[0] !== kinds.treePrefix) return null;
  const segment = lastPathSegment(parentPath);
  if (segment === null) return null;
  const uid = extractUid(segment);
  if (!isUid(uid)) return null;
  return { type: segments.length === 2 ? kinds.collectionType : kinds.folderType, uid };
}

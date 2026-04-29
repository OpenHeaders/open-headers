/**
 * Folder mutator catalog — routing constants.
 *
 * Folder is its own entity (uid + name) but sibling order does not live
 * on the folder. Per §23.5 the parent owns child ordering — concretely,
 * the parent collection (or parent folder) carries a `folders` set whose
 * members are slot markers keyed by child folder uid. The slot's
 * fractional-indexing key drives the sibling sort.
 *
 * Two parent types exist — `collection` and `folder` — so factories
 * accept a `{ type, uid }` discriminator for parent linkage. Reparent
 * lands as `removeFromSet(oldParent) + addToSet(newParent)`; intra-parent
 * reorder lands as a single `moveBefore` on the parent's `folders` path.
 *
 * No variables, no pinned-envs, no resolver-invalidate: a folder rename
 * or move never changes variable resolution downstream. Side effects
 * are empty.
 */

import { COLLECTION_ENTITY_TYPE } from '../collection/types';

/** Routing key carried on every folder mutation envelope. */
export const FOLDER_ENTITY_TYPE = 'folder';

/**
 * Set path on a parent (collection or folder) holding the ordered
 * child-folder slots. Each member's itemId is the child folder uid;
 * the member's item is an existence marker — folder data itself lives
 * on the folder entity, not on the parent slot.
 */
export const FOLDER_CHILDREN_PATH = 'folders';

/** Discriminator for the two parent kinds that can hold a folder. */
export type FolderParentType = typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE;

export interface FolderParentRef {
  type: FolderParentType;
  uid: string;
}

/**
 * Slot marker stored under `parent.folders[folderUid]`. The folder's
 * own state holds the name + schema version; the slot just records
 * "this folder belongs under this parent" so the projection layer can
 * walk parent → children deterministically.
 */
export interface FolderSlot {
  uid: string;
}

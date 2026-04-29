/**
 * Request-folder mutator catalog — routing constants.
 *
 * Mirrors the rule-side {@link FOLDER_ENTITY_TYPE} shape but routes to
 * its own entity type. The two folder namespaces (rule folders vs.
 * request folders) live under different storage keys
 * (`oh.ws.<id>.folders` vs `oh.ws.<id>.requestFolders`) and are owned
 * by different stores. Distinct entity types keep the sync engine's
 * `(workspaceId, type, id)` triple unambiguous at every layer.
 *
 * Sibling order lives on the parent (request collection or request
 * folder) under the `folders` set path; each member's itemId is the
 * child folder uid and the slot item is an existence marker. Reorder
 * is `moveBefore` on the parent's `folders` path; reparent is
 * `removeFromSet(oldParent) + addToSet(newParent)` as one atomic batch.
 *
 * No variables, no pinned-envs, no resolver-invalidate: a request-folder
 * rename or move never changes variable resolution downstream. Side
 * effects are empty.
 */

import { REQUEST_COLLECTION_ENTITY_TYPE } from '../request-collection/types';

/** Routing key carried on every request-folder mutation envelope. */
export const REQUEST_FOLDER_ENTITY_TYPE = 'request-folder';

/**
 * Set path on a parent (request collection or request folder) holding
 * the ordered child-folder slots. Same name as the rule-folder children
 * path; the entity-type discriminator distinguishes the two trees.
 */
export const REQUEST_FOLDER_CHILDREN_PATH = 'folders';

/** Discriminator for the two parent kinds that can hold a request-folder. */
export type RequestFolderParentType =
  | typeof REQUEST_COLLECTION_ENTITY_TYPE
  | typeof REQUEST_FOLDER_ENTITY_TYPE;

export interface RequestFolderParentRef {
  type: RequestFolderParentType;
  uid: string;
}

/**
 * Slot marker stored under `parent.folders[folderUid]`. The folder's
 * own state holds the name + schema version; the slot just records
 * "this folder belongs under this parent" so the projection layer can
 * walk parent → children deterministically.
 */
export interface RequestFolderSlot {
  uid: string;
}

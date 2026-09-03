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

import type { GRPC_REQUEST_ENTITY_TYPE } from '../grpc-request/types';
import type { MQTT_REQUEST_ENTITY_TYPE } from '../mqtt-request/types';
import type { REQUEST_ENTITY_TYPE } from '../request/types';
import { REQUEST_COLLECTION_ENTITY_TYPE } from '../request-collection/types';
import type { TreeParentKinds } from '../shared/tree-parent';
import type { WEBSOCKET_REQUEST_ENTITY_TYPE } from '../websocket-request/types';

/** Routing key carried on every request-folder mutation envelope. */
export const REQUEST_FOLDER_ENTITY_TYPE = 'request-folder';

/**
 * Set path on a parent (request collection or request folder) holding
 * the ordered child-folder slots. Same name as the rule-folder children
 * path; the entity-type discriminator distinguishes the two trees.
 */
export const REQUEST_FOLDER_CHILDREN_PATH = 'folders';

/**
 * Set path on a parent (request collection or request folder) holding
 * the ordered leaf slots — the four request kinds under it, in one
 * set. Folders render first, then items; the two sets never interleave.
 */
export const REQUEST_FOLDER_ITEMS_PATH = 'items';

/** Set path holding the auth pool on a request-folder entity — the collection's contract. */
export const REQUEST_FOLDER_AUTHS_PATH = 'auths';

/** Scalar field naming the folder pool's default entry; absent = the first entry. */
export const REQUEST_FOLDER_DEFAULT_AUTH_PATH = 'defaultAuthUid';

/** Nested object holding the inheritable request settings — the collection's contract. */
export const REQUEST_FOLDER_SETTINGS_PATH = 'settings';

/** Discriminator for the two parent kinds that can hold a request-folder. */
export type RequestFolderParentType = typeof REQUEST_COLLECTION_ENTITY_TYPE | typeof REQUEST_FOLDER_ENTITY_TYPE;

export interface RequestFolderParentRef {
  type: RequestFolderParentType;
  uid: string;
}

/** The requests tree's parent vocabulary for path → parent-ref resolution. */
export const REQUEST_FOLDER_TREE_KINDS: TreeParentKinds<
  typeof REQUEST_COLLECTION_ENTITY_TYPE,
  typeof REQUEST_FOLDER_ENTITY_TYPE
> = {
  treePrefix: 'requests',
  collectionType: REQUEST_COLLECTION_ENTITY_TYPE,
  folderType: REQUEST_FOLDER_ENTITY_TYPE,
};

/** The leaf kinds a request parent's `items` set can hold. */
export type RequestItemType =
  | typeof REQUEST_ENTITY_TYPE
  | typeof GRPC_REQUEST_ENTITY_TYPE
  | typeof WEBSOCKET_REQUEST_ENTITY_TYPE
  | typeof MQTT_REQUEST_ENTITY_TYPE;

/**
 * Slot marker stored under `parent.items[requestUid]`. The `type`
 * names which request catalog owns the leaf so a reader can resolve
 * the slot without probing four stores.
 */
export interface RequestFolderItemSlot {
  uid: string;
  type: RequestItemType;
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

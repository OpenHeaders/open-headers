/**
 * Template-folder mutator catalog — routing constants.
 *
 * Mirrors the rule-side {@link FOLDER_ENTITY_TYPE} and request-side
 * {@link REQUEST_FOLDER_ENTITY_TYPE} shapes but routes to its own
 * entity type. The three folder namespaces (rule / request / template
 * folders) live under different storage keys (`oh.ws.<id>.folders` vs
 * `oh.ws.<id>.requestFolders` vs `oh.ws.<id>.templateFolders`) and are
 * owned by different stores. Distinct entity types keep the sync
 * engine's `(workspaceId, type, id)` triple unambiguous at every layer.
 *
 * Sibling order lives on the parent (template collection or template
 * folder) under the `folders` set path; each member's itemId is the
 * child folder uid and the slot item is an existence marker. Reorder
 * is `moveBefore` on the parent's `folders` path; reparent is
 * `removeFromSet(oldParent) + addToSet(newParent)` as one atomic batch.
 *
 * No variables, no pinned-envs, no resolver-invalidate: a template-folder
 * rename or move never changes variable resolution downstream. Side
 * effects are empty.
 */

import type { TreeParentKinds } from '../shared/tree-parent';
import type { TEMPLATE_ENTITY_TYPE } from '../template/types';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '../template-collection/types';

/** Routing key carried on every template-folder mutation envelope. */
export const TEMPLATE_FOLDER_ENTITY_TYPE = 'template-folder';

/**
 * Set path on a parent (template collection or template folder) holding
 * the ordered child-folder slots. Same name as the rule-folder children
 * path; the entity-type discriminator distinguishes the three trees.
 */
export const TEMPLATE_FOLDER_CHILDREN_PATH = 'folders';

/**
 * Set path on a parent (template collection or template folder) holding
 * the ordered leaf slots — the templates under it. Folders render
 * first, then items; the two sets never interleave.
 */
export const TEMPLATE_FOLDER_ITEMS_PATH = 'items';

/** Discriminator for the two parent kinds that can hold a template-folder. */
export type TemplateFolderParentType = typeof TEMPLATE_COLLECTION_ENTITY_TYPE | typeof TEMPLATE_FOLDER_ENTITY_TYPE;

export interface TemplateFolderParentRef {
  type: TemplateFolderParentType;
  uid: string;
}

/** The templates tree's parent vocabulary for path → parent-ref resolution. */
export const TEMPLATE_FOLDER_TREE_KINDS: TreeParentKinds<
  typeof TEMPLATE_COLLECTION_ENTITY_TYPE,
  typeof TEMPLATE_FOLDER_ENTITY_TYPE
> = {
  treePrefix: 'templates',
  collectionType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
};

/** Slot marker stored under `parent.items[templateUid]`. */
export interface TemplateFolderItemSlot {
  uid: string;
  type: typeof TEMPLATE_ENTITY_TYPE;
}

/**
 * Slot marker stored under `parent.folders[folderUid]`. The folder's
 * own state holds the name + schema version; the slot just records
 * "this folder belongs under this parent" so the projection layer can
 * walk parent → children deterministically.
 */
export interface TemplateFolderSlot {
  uid: string;
}

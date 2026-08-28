/**
 * Workspace roots — the top of every tree.
 *
 * Collections are the top-level children of a tree, and a child's
 * order lives on its parent. The workspace has no entity of its own on
 * the per-workspace plane, so the roots are a well-known singleton
 * (fixed id, like `workspace-variables`) that owns one ordered set per
 * tree: rule collections, request collections, template collections.
 * Collections reorder only — they never nest — so each set is flat and
 * its slot marker is the bare `{ uid }`.
 *
 * No catalog of its own: the collection catalogs mint the slot bodies
 * under their own mutator versions (the same way a folder create carries
 * the parent collection's `addToSet`), so every envelope that touches a
 * roots set still routes by the child collection's kind.
 */

/** Routing key carried on every workspace-roots set mutation. */
export const WORKSPACE_ROOTS_ENTITY_TYPE = 'workspace-roots';

/** Fixed singleton id — every workspace has exactly one of these. */
export const WORKSPACE_ROOTS_ID = 'workspace-roots';

/** Set path holding the ordered rule-collection slots. */
export const WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH = 'ruleCollections';

/** Set path holding the ordered request-collection slots. */
export const WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH = 'requestCollections';

/** Set path holding the ordered template-collection slots. */
export const WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH = 'templateCollections';

export interface WorkspaceRootsRef {
  type: typeof WORKSPACE_ROOTS_ENTITY_TYPE;
  uid: typeof WORKSPACE_ROOTS_ID;
}

/** The one parent every collection slot hangs from. */
export const WORKSPACE_ROOTS_REF: WorkspaceRootsRef = {
  type: WORKSPACE_ROOTS_ENTITY_TYPE,
  uid: WORKSPACE_ROOTS_ID,
};

/**
 * Slot marker stored under `workspace-roots.<tree>Collections[uid]`.
 * The collection's own state holds its name + variables; the slot just
 * records "this collection is a root of this tree, at this position".
 */
export interface CollectionSlot {
  uid: string;
}

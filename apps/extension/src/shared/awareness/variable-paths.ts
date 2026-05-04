/**
 * Canonical schema-aligned field-path generators for variable rows
 * inside any variable-bearing entity (Environment, WorkspaceVariables,
 * Collection / RequestCollection / TemplateCollection).
 *
 * Set rows are uid-keyed (post-session-66): `variable.uid` is the
 * sync engine's set-member itemId. Awareness publishing + per-row
 * conflict tracking key off these strings; peers must agree on the
 * encoding for chips to render. Index-based row paths would shift on
 * reorder + collide across surfaces under concurrent rename (the bug
 * uid identity was introduced to fix); uid-based paths preserve
 * identity through reorder, rename, and type-toggle.
 *
 * The path prefix matches the entity's `varsPath` constant
 * (`ENV_VARS_PATH`, `WORKSPACE_VARIABLES_PATH`, `COLLECTION_VARS_PATH`,
 * etc. — all currently `'variables'`). If a future scope diverges, mint
 * a separate bundle there and override the prefix.
 *
 * Vault rows skip per-field awareness per §14.4 of the sync design
 * (sensitive entities use entity-level-only awareness).
 */

export type VariableLeaf = 'name' | 'value' | 'type';

export interface VariablePathBundle {
  /** Set root — used for path-prefix presence + set-level conflict keys. */
  set: string;
  /** Per-row generator. `uid` is the variable's persisted uid. */
  row(uid: string, leaf: VariableLeaf): string;
}

export const VARIABLE_PATHS: VariablePathBundle = {
  set: 'variables',
  row: (uid, leaf) => `variables.${uid}.${leaf}`,
};

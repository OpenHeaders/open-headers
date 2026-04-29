/**
 * Workspace-variables mutator catalog — routing constants.
 *
 * Singleton entity. There is exactly one WorkspaceVariables record per
 * workspace, addressed by the fixed id `WORKSPACE_VARIABLES_ID`. The
 * factory context (`MutatorContext`) and return shape (`MutatorIntent`)
 * live in the parent `mutators/types.ts` because they're identical
 * across every entity type — same authorship metadata, same return
 * shape.
 *
 * Set member identity for workspace variables is the variable NAME,
 * matching environment + collection. Two devices independently adding
 * `API_KEY` converge to one entry under per-(setPath, name) LWW; the
 * §8 atomic-rename gesture ships as `removeFromSet(old) +
 * addToSet(new)` under one batchId.
 */

/** Routing key carried on every workspace-variables mutation envelope. */
export const WORKSPACE_VARIABLES_ENTITY_TYPE = 'workspace-variables';

/** Set path holding the variable list on the workspace-variables entity. */
export const WORKSPACE_VARIABLES_PATH = 'variables';

/** Fixed singleton id — every workspace has exactly one of these. */
export const WORKSPACE_VARIABLES_ID = 'workspace-vars';

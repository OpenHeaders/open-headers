/**
 * Global-scope classification.
 *
 * The `__global__` scope (`EXTENSION_WORKSPACE_GLOBAL_SCOPE`) holds the
 * entities that live ABOVE any single workspace: the workspace list
 * (`extensionWorkspace`, replicated per Org) and this host's active
 * pointer (`active-workspace`, host-local). Everything else keys by a
 * real workspace id. This module is the single source of truth for
 * "does this entity type route to the global oracle" — the apply
 * router, the global cache, its projector, the renderer mirror and the
 * coord runner all consult it so a commit of either type reaches every
 * consumer of the composed workspace-list post-state.
 */

import { ACTIVE_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_ENTITY_TYPE } from './mutators';

const GLOBAL_SCOPE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  ACTIVE_WORKSPACE_ENTITY_TYPE,
]);

/** True when mutations of `entityType` live in the `__global__` scope. */
export function isGlobalScopeEntityType(entityType: string): boolean {
  return GLOBAL_SCOPE_ENTITY_TYPES.has(entityType);
}

/**
 * Side-effect intent factories for workspace-variables mutations.
 *
 * Workspace variables feed the same variable resolver as environments
 * and collections; an edit invalidates the resolver cache + recompiles
 * downstream rules whose templates reference the affected variable.
 * Reuses the `INVALIDATE_RESOLVER` intent kind so a single shared
 * runner handles every variable scope (env, collection, workspace,
 * vault) with one Set<EntityType> filter.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import { WORKSPACE_VARIABLES_ID } from './types';

export { INVALIDATE_RESOLVER };

/**
 * Intent: flush the SW's variable-resolver cache for workspace
 * variables (and recompile downstream rules). The coalescing key is
 * the singleton id so every variable edit on the workspace-vars entity
 * collapses into one invalidation per HLC tick.
 */
export function invalidateResolverIntent(hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: WORKSPACE_VARIABLES_ID, hlc };
}

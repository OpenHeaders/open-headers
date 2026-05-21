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

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import type { SideEffectIntent } from '../types';
import { WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_ID, WORKSPACE_VARIABLES_PATH } from './types';

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

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed workspace-variables envelope. Every variable edit (any op
 * at the `variables` set path) invalidates the resolver, keyed by the
 * singleton id.
 *
 * Used in both directions — mint-side by the workspace-variables
 * mutators, receive-side by `deriveSideEffectsForEnvelope` — so an
 * inbound variable edit flushes the resolver on every host that
 * applies it.
 */
export function deriveWorkspaceVariablesSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return [];
  if ('path' in body && body.path === WORKSPACE_VARIABLES_PATH) {
    return [invalidateResolverIntent(hlc)];
  }
  return [];
}

/**
 * Side-effect intent factories for vault mutations.
 *
 * Vault entries feed the same variable resolver as environments,
 * collections, and workspace variables (priority: vault > env >
 * collection > workspace, see `types/v5/variable.ts`); an edit
 * invalidates the resolver cache + recompiles downstream rules whose
 * templates reference the affected vault entry. Reuses the
 * `INVALIDATE_RESOLVER` intent kind so the single shared runner handles
 * every variable scope with one Set<EntityType> filter.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import { VAULT_ID } from './types';

export { INVALIDATE_RESOLVER };

/**
 * Intent: flush the SW's variable-resolver cache for vault entries
 * (and recompile downstream rules). The coalescing key is the singleton
 * id so every vault edit collapses into one invalidation per HLC tick.
 */
export function invalidateResolverIntent(hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc };
}

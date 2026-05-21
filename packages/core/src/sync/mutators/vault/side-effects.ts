/**
 * Side-effect intent factories for vault mutations.
 *
 * Vault entries feed the same variable resolver as environments,
 * collections, and workspace variables (priority: vault > env >
 * collection > workspace, see `types/variable.ts`); an edit
 * invalidates the resolver cache + recompiles downstream rules whose
 * templates reference the affected vault entry. Reuses the
 * `INVALIDATE_RESOLVER` intent kind so the single shared runner handles
 * every variable scope with one Set<EntityType> filter.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';
import type { SideEffectIntent } from '../types';
import { VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH } from './types';

export { INVALIDATE_RESOLVER };

/**
 * Intent: flush the SW's variable-resolver cache for vault entries
 * (and recompile downstream rules). The coalescing key is the singleton
 * id so every vault edit collapses into one invalidation per HLC tick.
 */
export function invalidateResolverIntent(hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed vault envelope. Every secret edit (any op at the `secrets`
 * set path) invalidates the resolver, keyed by the singleton id.
 *
 * Used in both directions — mint-side by the vault mutators,
 * receive-side by `deriveSideEffectsForEnvelope` — so an inbound vault
 * edit flushes the resolver on every host that applies it.
 */
export function deriveVaultSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== VAULT_ENTITY_TYPE) return [];
  if ('path' in body && body.path === VAULT_PATH) {
    return [invalidateResolverIntent(hlc)];
  }
  return [];
}

/**
 * Side-effect intent factories for environment mutations.
 *
 * Environment edits invalidate the variable-resolver cache + every
 * downstream rule whose template references the affected variable.
 * The intent + runner shape mirrors `rule/side-effects.ts` — the
 * runner coalesces by `(kind, key)` with latest-HLC wins and reads
 * the materialized snapshot at execution time, so multiple edits to
 * one environment converge to one resolver flush + one DNR recompile.
 *
 * Rename-environment edits do NOT invalidate the resolver (a
 * display-name change doesn't change variable resolution). A
 * variable-set edit does, and so does a whole-environment `delete` —
 * removing the environment drops its variables from scope.
 * `deriveEnvironmentSideEffects` encodes that condition.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from './types';

export const INVALIDATE_RESOLVER = 'invalidate-resolver';

/**
 * Intent: flush the SW's variable-resolver cache for `envId` (and
 * recompile downstream rules). Coalescing key is `envId` so a flurry
 * of variable edits in one environment collapses into one
 * invalidation.
 */
export function invalidateResolverIntent(envId: string, hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: envId, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed environment envelope. A variable edit (any op at the
 * `variables` set path) or a whole-environment `delete` invalidates
 * the resolver, keyed by the environment id; a rename does not. (A
 * `create` carries no variables — the seed builder splits them into
 * separate `addToSet` envelopes — so a bare create-shell derives
 * nothing.)
 *
 * Used in both directions — mint-side by the environment mutators,
 * receive-side by `deriveSideEffectsForEnvelope` — so an inbound
 * variable edit or delete flushes the resolver on every host that
 * applies it.
 */
export function deriveEnvironmentSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== ENVIRONMENT_ENTITY_TYPE) return [];
  if (body.kind === 'delete' || ('path' in body && body.path === ENV_VARS_PATH)) {
    return [invalidateResolverIntent(body.id, hlc)];
  }
  return [];
}

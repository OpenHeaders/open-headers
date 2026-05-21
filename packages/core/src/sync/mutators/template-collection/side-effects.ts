/**
 * Side-effect intent factories for template-collection mutations.
 *
 * Template-collection variables feed the same variable resolver that
 * environment + rule-collection + request-collection scopes feed. We
 * reuse the existing `INVALIDATE_RESOLVER` kind so the SW-side
 * resolver-invalidate runner drains template-collection envelopes via
 * the same broadcast loop — no second runner.
 *
 * Coalescing key is the template-collection uid; safe alongside the
 * other variable scopes (even on the unlikely uid collision the same
 * recompile fires).
 *
 * Rename-collection edits do NOT invalidate the resolver (display-name
 * changes don't change variable resolution). A variable-set edit does,
 * and so does a whole-collection `delete` — removing the collection
 * drops its variables from scope. `deriveTemplateCollectionSideEffects`
 * encodes that condition.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { TEMPLATE_COLLECTION_ENTITY_TYPE, TEMPLATE_COLLECTION_VARS_PATH } from './types';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

import { INVALIDATE_RESOLVER as ENV_INVALIDATE_RESOLVER } from '../environment/side-effects';

/**
 * Intent: flush the SW's variable-resolver cache for `templateCollectionUid`
 * (and recompile downstream consumers). Coalescing key is the
 * template-collection uid so a flurry of variable edits inside one
 * template collection collapses into one invalidation.
 */
export function invalidateResolverIntent(templateCollectionUid: string, hlc: HLC): SideEffectIntent {
  return { kind: ENV_INVALIDATE_RESOLVER, key: templateCollectionUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed template-collection envelope. A variable edit (any op at
 * the `variables` set path) or a whole-collection `delete` invalidates
 * the resolver, keyed by the template-collection uid; a rename does
 * not. (A `create` carries no variables — the seed builder splits them
 * into separate `addToSet` envelopes — so a bare create-shell derives
 * nothing.)
 *
 * Used in both directions — mint-side by the template-collection
 * mutators, receive-side by `deriveSideEffectsForEnvelope` — so an
 * inbound variable edit or delete flushes the resolver on every host
 * that applies it.
 */
export function deriveTemplateCollectionSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return [];
  if (body.kind === 'delete' || ('path' in body && body.path === TEMPLATE_COLLECTION_VARS_PATH)) {
    return [invalidateResolverIntent(body.id, hlc)];
  }
  return [];
}

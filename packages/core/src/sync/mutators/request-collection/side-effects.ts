/**
 * Side-effect intent factories for request-collection mutations.
 *
 * Request-collection variables feed the same variable resolver that
 * environment + rule-collection scopes feed. We reuse the existing
 * `INVALIDATE_RESOLVER` kind (originally defined alongside the
 * environment catalog) so the SW-side resolver-invalidate runner
 * drains request-collection envelopes via the same broadcast loop —
 * no second runner.
 *
 * The runner coalesces by `(kind, key)` with latest-HLC wins. Using
 * the request-collection `uid` as the key is safe alongside env +
 * rule-collection invalidations: even on the unlikely uid collision,
 * both invalidations resolve to the same `recompile('rules')` action
 * — semantic loss is zero.
 *
 * Rename-collection edits do NOT invalidate the resolver (display-name
 * changes don't change variable resolution). A variable-set edit does,
 * and so does a whole-collection `delete` — removing the collection
 * drops its variables from scope. `deriveRequestCollectionSideEffects`
 * encodes that condition.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_COLLECTION_VARS_PATH } from './types';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

import { INVALIDATE_RESOLVER as ENV_INVALIDATE_RESOLVER } from '../environment/side-effects';

/**
 * Intent: flush the SW's variable-resolver cache for `requestCollectionUid`
 * (and recompile downstream consumers). Coalescing key is the
 * request-collection uid so a flurry of variable edits inside one
 * request collection collapses into one invalidation.
 */
export function invalidateResolverIntent(requestCollectionUid: string, hlc: HLC): SideEffectIntent {
  return { kind: ENV_INVALIDATE_RESOLVER, key: requestCollectionUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed request-collection envelope. A variable edit (any op at
 * the `variables` set path) or a whole-collection `delete` invalidates
 * the resolver, keyed by the request-collection uid; a rename does
 * not. (A `create` carries no variables — the seed builder splits them
 * into separate `addToSet` envelopes — so a bare create-shell derives
 * nothing.)
 *
 * Used in both directions — mint-side by the request-collection
 * mutators, receive-side by `deriveSideEffectsForEnvelope` — so an
 * inbound variable edit or delete flushes the resolver on every host
 * that applies it.
 */
export function deriveRequestCollectionSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== REQUEST_COLLECTION_ENTITY_TYPE) return [];
  if (body.kind === 'delete' || ('path' in body && body.path === REQUEST_COLLECTION_VARS_PATH)) {
    return [invalidateResolverIntent(body.id, hlc)];
  }
  return [];
}

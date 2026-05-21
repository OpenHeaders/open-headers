/**
 * Side-effect intent factories for collection mutations.
 *
 * Collection-scoped variables feed the same variable resolver
 * environment/workspace/vault scopes feed; an edit invalidates the
 * downstream rules' DNR output exactly the way an env edit does. We
 * reuse the existing `INVALIDATE_RESOLVER` kind from the environment
 * catalog so the SW-side runner ({@link resolver-invalidate-runner})
 * drains collection envelopes via the same drain-on-broadcast loop
 * without a second runner module.
 *
 * The runner coalesces by `(kind, key)` with latest-HLC wins. Using
 * the collection `uid` as the key keeps env-scoped invalidations and
 * collection-scoped invalidations from clobbering each other — they
 * key on different ids inside the same kind, the same way two distinct
 * environments do today.
 *
 * Pinned-environments + default-environment + rename-collection edits
 * do NOT invalidate the resolver (display-name changes don't change
 * variable resolution; pinned/default-env affect editor selection
 * defaults, not resolved output until a rule actually runs). A
 * variable-set edit does, and so does a whole-collection `delete` —
 * removing the collection drops its variables from scope.
 * `deriveCollectionSideEffects` encodes that condition.
 */

import type { MutationEnvelope } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH } from './types';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

import { INVALIDATE_RESOLVER as ENV_INVALIDATE_RESOLVER } from '../environment/side-effects';

/**
 * Intent: flush the SW's variable-resolver cache for `collectionUid`
 * (and recompile downstream rules). Coalescing key is the collection
 * uid so a flurry of variable edits inside one collection collapses
 * into one invalidation.
 */
export function invalidateResolverIntent(collectionUid: string, hlc: HLC): SideEffectIntent {
  return { kind: ENV_INVALIDATE_RESOLVER, key: collectionUid, hlc };
}

/**
 * Pure derivation: the side-effect intents a host must enqueue for a
 * committed collection envelope. A variable edit (any op at the
 * `variables` set path) or a whole-collection `delete` invalidates the
 * resolver, keyed by the collection uid; a rename / pinned-env /
 * default-env edit does not. (A `create` carries no variables — the
 * seed builder splits them into separate `addToSet` envelopes — so a
 * bare create-shell derives nothing.)
 *
 * Used in both directions — mint-side, the collection mutators call it
 * on their minted envelope; receive-side, `deriveSideEffectsForEnvelope`
 * routes peer-applied envelopes through the same function so an inbound
 * variable edit or delete flushes the resolver on every host that
 * applies it.
 */
export function deriveCollectionSideEffects(envelope: MutationEnvelope): SideEffectIntent[] {
  const { body, hlc } = envelope;
  if (body.type !== COLLECTION_ENTITY_TYPE) return [];
  if (body.kind === 'delete' || ('path' in body && body.path === COLLECTION_VARS_PATH)) {
    return [invalidateResolverIntent(body.id, hlc)];
  }
  return [];
}

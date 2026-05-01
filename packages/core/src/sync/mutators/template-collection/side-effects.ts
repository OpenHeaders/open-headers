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
 * changes don't change variable resolution).
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

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

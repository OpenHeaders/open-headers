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
 * changes don't change variable resolution).
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

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

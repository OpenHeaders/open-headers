/**
 * Side-effect intent factory for live-variable mutations.
 *
 * Every LV edit invalidates the variable-resolver cache for the
 * affected key. Reuses the existing `INVALIDATE_RESOLVER` kind so the
 * SW runner stays a single drain pipeline; the runner coalesces by
 * `(kind, key)` with latest-HLC wins.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

export function invalidateResolverIntent(liveVariableUid: string, hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: liveVariableUid, hlc };
}

/**
 * Side-effect intent factory for live-workflow mutations.
 *
 * Workflow `enabled` flips, refresh-policy swaps, and step-list
 * replacements can all change resolution outcomes for any LV bound to
 * the workflow. Reuses the existing `INVALIDATE_RESOLVER` kind so the
 * SW runner stays a single drain pipeline; the runner coalesces by
 * `(kind, key)` with latest-HLC wins.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';
import { INVALIDATE_RESOLVER } from '../environment/side-effects';

export { INVALIDATE_RESOLVER } from '../environment/side-effects';

export function invalidateResolverIntent(workflowUid: string, hlc: HLC): SideEffectIntent {
  return { kind: INVALIDATE_RESOLVER, key: workflowUid, hlc };
}

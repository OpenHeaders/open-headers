/**
 * Side-effect intent factories for environment mutations.
 *
 * Environment edits invalidate the variable-resolver cache + every
 * downstream rule whose template references the affected variable.
 * The intent + runner shape mirrors `rule/side-effects.ts` — the
 * runner coalesces by `(kind, key)` with latest-HLC wins and reads
 * the materialized snapshot at execution time, so multiple edits to
 * one environment converge to one resolver flush + one DNR recompile.
 */

import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

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

/**
 * Side-effect derivation for trusted-roots mutations.
 *
 * A root edit has no host-local side effect: the executors read the
 * workspace list from the store at send time (seam discipline — the
 * transport is handed PEM strings per dial), so there is no cache to
 * flush and nothing to recompile. Kept as an explicit derivation so
 * the catalog stays uniform and a future intent has one home.
 */

import type { MutationEnvelope } from '../../envelope';
import type { SideEffectIntent } from '../types';

export function deriveTrustedRootsSideEffects(_envelope: MutationEnvelope): SideEffectIntent[] {
  return [];
}

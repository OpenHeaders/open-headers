/**
 * Envelope → side-effect derivation dispatcher.
 *
 * Side effects (DNR rebuild, store swap, resolver-cache invalidation,
 * per-workspace data purge) are HOST-LOCAL runtime concerns that need
 * to fire on every host that applies a given envelope — not just the
 * host that originally minted it. The convergence model (§3.2) says
 * every host runs the same engine code, so each host derives the
 * intents independently from the envelope it just applied.
 *
 * Per-entity-type derivation functions live next to their intent
 * factories (e.g. `extension-workspace/side-effects.ts` exports
 * `deriveExtensionWorkspaceSideEffects`). This dispatcher routes by
 * `envelope.body.type` to the right one.
 *
 * Mutator functions use these derivations at MINT time on their own
 * minted envelope so there is exactly one mapping from
 * `(body, hlc)` → `SideEffectIntent[]` — used in both directions.
 *
 * Adding a new entity:
 *   1. Add a `deriveFooSideEffects(envelope) -> SideEffectIntent[]`
 *      next to `foo/side-effects.ts`.
 *   2. Have `foo`'s mutator functions call it from their minted
 *      envelope (replacing any inline intent emission).
 *   3. Register here.
 *
 * Receiver-side wiring is in
 * `packages/oracle/src/sync/mutation-stream-bridge.ts` —
 * `applyInboundMutationBatch` flat-maps every envelope through this
 * dispatcher and passes the result to `applySyncRequest({ sideEffects })`.
 */

import type { MutationEnvelope } from '../envelope';
import { deriveExtensionWorkspaceSideEffects } from './extension-workspace/side-effects';
import { EXTENSION_WORKSPACE_ENTITY_TYPE } from './extension-workspace/types';
import type { SideEffectIntent } from './types';

export function deriveSideEffectsForEnvelope(envelope: MutationEnvelope): SideEffectIntent[] {
  if (envelope.body.type === EXTENSION_WORKSPACE_ENTITY_TYPE) {
    return deriveExtensionWorkspaceSideEffects(envelope);
  }
  // Other entity types have no cross-host side effects yet. Their
  // host-local side effects (DNR recompile on rule edits, resolver
  // invalidation on collection edits) currently ride local broadcast
  // subscribers, not pending-intents, so peer-applied envelopes
  // already drive them via the broadcast pipeline.
  return [];
}

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
 * "Emits at mint but not at receive" is therefore structurally
 * impossible: there is no second emission site to drift from.
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
import { deriveCollectionSideEffects } from './collection/side-effects';
import { COLLECTION_ENTITY_TYPE } from './collection/types';
import { deriveEnvironmentSideEffects } from './environment/side-effects';
import { ENVIRONMENT_ENTITY_TYPE } from './environment/types';
import { deriveExtensionWorkspaceSideEffects } from './extension-workspace/side-effects';
import { EXTENSION_WORKSPACE_ENTITY_TYPE } from './extension-workspace/types';
import { deriveLiveVariableSideEffects } from './live-variable/side-effects';
import { LIVE_VARIABLE_ENTITY_TYPE } from './live-variable/types';
import { deriveLiveWorkflowSideEffects } from './live-workflow/side-effects';
import { LIVE_WORKFLOW_ENTITY_TYPE } from './live-workflow/types';
import { derivePauseMarkersSideEffects } from './pause-markers/side-effects';
import { PAUSE_MARKERS_ENTITY_TYPE } from './pause-markers/types';
import { deriveRequestCollectionSideEffects } from './request-collection/side-effects';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './request-collection/types';
import { deriveRuleSideEffects } from './rule/side-effects';
import { RULE_ENTITY_TYPE } from './rule/types';
import { deriveTemplateCollectionSideEffects } from './template-collection/side-effects';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from './template-collection/types';
import type { SideEffectIntent } from './types';
import { deriveVaultSideEffects } from './vault/side-effects';
import { VAULT_ENTITY_TYPE } from './vault/types';
import { deriveWorkspaceVariablesSideEffects } from './workspace-variables/side-effects';
import { WORKSPACE_VARIABLES_ENTITY_TYPE } from './workspace-variables/types';

export function deriveSideEffectsForEnvelope(envelope: MutationEnvelope): SideEffectIntent[] {
  switch (envelope.body.type) {
    case EXTENSION_WORKSPACE_ENTITY_TYPE:
      return deriveExtensionWorkspaceSideEffects(envelope);
    // A rule / pause-marker edit reshapes the effective DNR rule set; the
    // intent must be enqueued on every host that applies the envelope so
    // the dnr-intent runner recompiles. Without this, a peer-synced rule
    // edit updates the store + editor but never reaches the browser's
    // declarativeNetRequest rules.
    case RULE_ENTITY_TYPE:
      return deriveRuleSideEffects(envelope);
    case PAUSE_MARKERS_ENTITY_TYPE:
      return derivePauseMarkersSideEffects(envelope);
    // A variable-scope edit (collection / environment / live-* / vault /
    // workspace-variables / *-collection) invalidates the variable
    // resolver cache; the intent must be enqueued on every host that
    // applies the envelope so the resolver-invalidate runner flushes.
    // Without this, a peer-synced variable edit updates the store but
    // downstream rules keep resolving the stale value.
    case COLLECTION_ENTITY_TYPE:
      return deriveCollectionSideEffects(envelope);
    case ENVIRONMENT_ENTITY_TYPE:
      return deriveEnvironmentSideEffects(envelope);
    case LIVE_VARIABLE_ENTITY_TYPE:
      return deriveLiveVariableSideEffects(envelope);
    case LIVE_WORKFLOW_ENTITY_TYPE:
      return deriveLiveWorkflowSideEffects(envelope);
    case VAULT_ENTITY_TYPE:
      return deriveVaultSideEffects(envelope);
    case WORKSPACE_VARIABLES_ENTITY_TYPE:
      return deriveWorkspaceVariablesSideEffects(envelope);
    case TEMPLATE_COLLECTION_ENTITY_TYPE:
      return deriveTemplateCollectionSideEffects(envelope);
    case REQUEST_COLLECTION_ENTITY_TYPE:
      return deriveRequestCollectionSideEffects(envelope);
    default:
      // Entity types with no host-local side effect (folder, request,
      // template, files, oauth-bundle, layout-state) map to no intents.
      return [];
  }
}

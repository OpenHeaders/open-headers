/**
 * Sync bridge — adapts `SyncApplyRequest` / `SyncBroadcastEvent` from
 * `@openheaders/core/protocol` to the {@link EntityOracle} (Phase A R4).
 *
 * This module is the seam between the platform RPC layer
 * (chrome.runtime / desktop bridge / direct in-memory transport for
 * tests) and the oracle. The handler is pure: it never reaches into
 * chrome.runtime directly, so it's testable without any browser
 * fixtures. Surfaces register the oracle's broadcast subscription
 * with their preferred transport (`onBroadcast` / `subscribe`).
 *
 * Production wiring lives one layer up — registering the handler in
 * `message-handler.ts` and the broadcast adapter on `chrome.runtime`.
 * Phase A's W-series consumes that.
 */

import type { SyncApplyRequest, SyncApplyResponse, SyncBroadcastEvent } from '@openheaders/core/protocol';
import { SYNC_BROADCAST_TYPE } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import type { BroadcastEvent, MutationBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';

/**
 * Per-envelope post-state attachment a projector contributes to a
 * broadcast event. Each entity type owns its own optional field on
 * {@link SyncBroadcastEvent} (`rulePostState`, `environmentPostState`,
 * …); the projector registry composes per-entity projectors into one
 * pipeline that runs every projector and shallow-merges their outputs
 * onto the wire event.
 */
export type EntityPostState = Partial<
  Pick<
    SyncBroadcastEvent,
    | 'rulePostState'
    | 'environmentPostState'
    | 'collectionPostState'
    | 'workspaceVariablesPostState'
    | 'vaultPostState'
    | 'folderPostState'
    | 'requestPostState'
    | 'grpcRequestPostState'
    | 'websocketRequestPostState'
    | 'requestCollectionPostState'
    | 'requestFolderPostState'
    | 'templatePostState'
    | 'templateCollectionPostState'
    | 'templateFolderPostState'
    | 'liveVariablePostState'
    | 'liveWorkflowPostState'
    | 'scriptPackagePostState'
    | 'responseExamplePostState'
    | 'grpcResponseExamplePostState'
    | 'wsResponseExamplePostState'
    | 'specPostState'
    | 'liveValuePostState'
    | 'liveFallbackPriorityPostState'
    | 'oauthBundlePostState'
    | 'pauseMarkersPostState'
    | 'layoutStatePostState'
    | 'filesPostState'
    | 'extensionWorkspacePostState'
  >
>;

/**
 * Optional per-envelope projection. Returns the post-commit slice for
 * the entity it owns, or `null` for envelopes it doesn't recognize.
 * Throws are caught by the caller — projection failure must never
 * tear down the broadcast.
 */
export type BroadcastProjector = (envelope: MutationEnvelope) => EntityPostState | null;

/**
 * Compose per-entity projectors into one pipeline. Outputs are
 * shallow-merged so each entity's slice lands in its own field of the
 * broadcast event; per-projector throws are isolated.
 */
export function composeProjectors(...projectors: BroadcastProjector[]): BroadcastProjector {
  return (envelope) => {
    let merged: EntityPostState | null = null;
    for (const project of projectors) {
      let part: EntityPostState | null;
      try {
        part = project(envelope);
      } catch {
        part = null;
      }
      if (!part) continue;
      merged = { ...(merged ?? {}), ...part };
    }
    return merged;
  };
}

/** Glue: oracle apply result → on-the-wire {@link SyncApplyResponse}. */
export async function handleSyncApply(oracle: EntityOracle, request: SyncApplyRequest): Promise<SyncApplyResponse> {
  const result = await oracle.apply(request.batch, request.sideEffects, request.applyOrigin);
  if (result.ok) {
    return { ok: true, outcomes: result.outcomes };
  }
  if (!result.failure) {
    // The oracle promises to populate `failure` on `ok === false`; if
    // it didn't, surface a structured error rather than coerce.
    throw new Error('oracle returned ok=false without a failure record');
  }
  return { ok: false, outcomes: result.outcomes, failure: result.failure };
}

/**
 * Wrap a {@link MutationBroadcast} so every published event is also
 * delivered as a wire {@link SyncBroadcastEvent} on `sink`. Returns an
 * unsubscribe function the caller invokes on shutdown.
 */
export function wireBroadcastToSink(
  broadcast: MutationBroadcast & { subscribe?: (l: (e: BroadcastEvent) => void) => () => void },
  sink: (event: SyncBroadcastEvent) => void,
  projector?: BroadcastProjector,
): () => void {
  if (typeof broadcast.subscribe !== 'function') {
    throw new Error('wireBroadcastToSink requires a broadcast that exposes subscribe()');
  }
  return broadcast.subscribe((e) => {
    let projected: EntityPostState | null = null;
    if (projector) {
      try {
        projected = projector(e.envelope);
      } catch {
        // Projection failure must not tear down the broadcast — every
        // surface still needs the (envelope, outcome) tuple even when
        // the projection couldn't be computed.
        projected = null;
      }
    }
    sink({
      type: SYNC_BROADCAST_TYPE,
      envelope: e.envelope,
      outcome: e.outcome,
      batchId: e.batchId,
      applyOrigin: e.applyOrigin,
      ...(projected ?? {}),
    });
  });
}

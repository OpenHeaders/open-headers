/**
 * Sync bridge — adapts `SyncApplyRequest` / `SyncBroadcastEvent` from
 * `@openheaders/core/protocol` to the {@link RuleOracle} (Phase A R4).
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

import type {
  SyncApplyRequest,
  SyncApplyResponse,
  SyncBroadcastEvent,
} from '@openheaders/core/protocol';
import { SYNC_BROADCAST_TYPE } from '@openheaders/core/protocol';
import type { BroadcastEvent, MutationBroadcast } from './broadcast';
import type { RuleOracle } from './oracle';

/** Glue: oracle apply result → on-the-wire {@link SyncApplyResponse}. */
export async function handleSyncApply(
  oracle: RuleOracle,
  request: SyncApplyRequest,
): Promise<SyncApplyResponse> {
  const result = await oracle.apply(request.batch, request.sideEffects);
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
): () => void {
  if (typeof broadcast.subscribe !== 'function') {
    throw new Error('wireBroadcastToSink requires a broadcast that exposes subscribe()');
  }
  return broadcast.subscribe((e) => {
    sink({
      type: SYNC_BROADCAST_TYPE,
      envelope: e.envelope,
      outcome: e.outcome,
      batchId: e.batchId,
    });
  });
}

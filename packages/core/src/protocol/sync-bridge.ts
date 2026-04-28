/**
 * Sync bridge protocol — wire shapes for `apply(MutationBatch)` requests
 * the oracle accepts, ack responses it returns, and broadcast events it
 * emits to subscribed surfaces (Phase A R4).
 *
 * These types live in core so every node — extension surfaces, the SW
 * oracle, the desktop's main process, and the CLI — speaks the same
 * shape. Registering them with the platform-specific RPC layer
 * (chrome.runtime, the desktop bridge, …) happens in each app: the
 * shared contract is here.
 */

import type { MutationBatch, MutationEnvelope, MutatorOutcome, SideEffectIntent } from '../sync';

/** Surface → oracle: apply this batch all-or-nothing under the per-entity lock. */
export interface SyncApplyRequest {
  type: 'oh.sync.apply';
  batch: MutationBatch;
  /**
   * Side-effect intents emitted by the rule mutator factories. The
   * oracle enqueues them only on a successful commit; rolled-back
   * batches drop them along with the state delta.
   */
  sideEffects: SideEffectIntent[];
}

export interface SyncApplyAckOk {
  ok: true;
  /** Per-envelope outcomes in the same order as `request.batch.mutations`. */
  outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }>;
}

export interface SyncApplyAckErr {
  ok: false;
  outcomes: Array<{ envelope: MutationEnvelope; outcome: MutatorOutcome }>;
  failure: { mutationId: string; status: MutatorOutcome['status']; detail?: string };
}

export type SyncApplyResponse = SyncApplyAckOk | SyncApplyAckErr;

/** Oracle → surfaces: a committed envelope, broadcast for ack + replay. */
export interface SyncBroadcastEvent {
  type: 'oh.sync.broadcast';
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  batchId?: string;
}

/** Single union surface code can switch over without importing five types. */
export type SyncBridgeMessage = SyncApplyRequest | SyncBroadcastEvent;

export const SYNC_APPLY_TYPE = 'oh.sync.apply' as const;
export const SYNC_BROADCAST_TYPE = 'oh.sync.broadcast' as const;

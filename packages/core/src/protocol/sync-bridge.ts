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
import type { V5 } from '../types';

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

/**
 * Post-commit projection for a Rule envelope. Carries the materialized
 * V5.Rule and the live itemIds the oracle holds at each set-modeled
 * path, so renderer-side mirrors can:
 *
 *   1. Track the canonical rule shape without round-tripping back to
 *      the SW (synchronous-render discipline, §19.4).
 *   2. Enumerate the itemIds `removeFromSet` envelopes need to target —
 *      the materialized shape strips them, so a write helper that wants
 *      to replace a set has to learn them from somewhere.
 *
 * Optional + entity-typed: only Rule envelopes carry it for now. When
 * Phase B widens the sync engine to additional entities, this either
 * grows per-entity payload variants or wraps in a discriminated union.
 * Defer that decision until a second entity actually needs it.
 */
export interface SyncRulePostState {
  rule: V5.Rule;
  /** Map keyed by set path (e.g. `conditions`, `action.requestHeaders`). */
  setItemIds: Record<string, string[]>;
}

/**
 * Post-commit projection for an Environment envelope. Carries the
 * materialized {@link V5.Environment} plus the live variable names
 * (set member identity = name, see env mutators). Renderer-side
 * mirrors fold this in lockstep with the SW oracle so they can read
 * post-commit state without a round-trip.
 */
export interface SyncEnvironmentPostState {
  environment: V5.Environment;
  /** Live variable names — the set-member identity for env vars. */
  varNames: string[];
}

/** Oracle → surfaces: a committed envelope, broadcast for ack + replay. */
export interface SyncBroadcastEvent {
  type: 'oh.sync.broadcast';
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  batchId?: string;
  /**
   * Populated for Rule envelopes whose batch left a materialized rule
   * in place (i.e. not a `delete`). Other entity types and rolled-back
   * batches leave it `undefined`.
   */
  rulePostState?: SyncRulePostState;
  /**
   * Populated for Environment envelopes whose batch left a materialized
   * environment in place. Tombstoned environments and rolled-back
   * batches leave it `undefined`.
   */
  environmentPostState?: SyncEnvironmentPostState;
}

/** Single union surface code can switch over without importing five types. */
export type SyncBridgeMessage = SyncApplyRequest | SyncBroadcastEvent;

export const SYNC_APPLY_TYPE = 'oh.sync.apply' as const;
export const SYNC_BROADCAST_TYPE = 'oh.sync.broadcast' as const;

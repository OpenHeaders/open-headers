/**
 * Mutation streaming wire types — Phase C C7-C10.
 *
 * Carries committed {@link MutationEnvelope}s between peers in two
 * flavors:
 *
 * - **Single-envelope** ({@link SYNC_MUTATION_TYPE}). Emitted for each
 *   envelope the local oracle commits. Used for live streaming after
 *   the handshake completes — one envelope per WS frame keeps each
 *   forward cheap and lets the receiver dedup + apply incrementally.
 *
 * - **Batch** ({@link SYNC_MUTATION_BATCH_TYPE}). Carries a full
 *   `MutationBatch` so the receiver can preserve the all-or-nothing
 *   semantics of a single user gesture. Used by the C15 reconnect-
 *   flush path (where a pending-out queue replays batches the peer
 *   didn't see during the disconnect) and by the C5/C4 catch-up path
 *   (state-vector exchange → snapshot or delta-stream).
 *
 * Live mode and catch-up modes share the same two message types so
 * the receive-side handler stays uniform: parse → dedup by
 * `mutationId` (C11) → route into the local oracle via
 * `applySyncRequest`. No mode flag in the wire shape — atomicity is
 * declared by which message kind the sender used.
 *
 * **Origin echo.** The receiver MUST drop envelopes whose
 * `origin.deviceId` matches its own (or whose `mutationId` is already
 * known via the seen-set the C11 dedup layer maintains). Cross-host
 * echo would re-apply the envelope, redundantly broadcast it, and —
 * worst — synthesize a second outbound forward, causing a feedback
 * loop. The dedup-at-receive contract is non-negotiable; declared
 * here so transports can't accidentally skip it.
 */

import * as v from 'valibot';

import type { MutationBatch, MutationEnvelope } from '../sync';

export const SYNC_MUTATION_TYPE = 'oh.sync.mutation' as const;
export const SYNC_MUTATION_BATCH_TYPE = 'oh.sync.mutationBatch' as const;

export interface SyncMutationMessage {
  type: typeof SYNC_MUTATION_TYPE;
  /** Workspace this envelope belongs to. Receiver routes by id. */
  workspaceId: string;
  envelope: MutationEnvelope;
}

export interface SyncMutationBatchMessage {
  type: typeof SYNC_MUTATION_BATCH_TYPE;
  workspaceId: string;
  batch: MutationBatch;
}

export type SyncMutationStreamMessage = SyncMutationMessage | SyncMutationBatchMessage;

// ── Schemas ───────────────────────────────────────────────────────────
//
// The envelope payload is opaque at the transport boundary — per-entity
// validation runs at the mutator layer when the receiver applies the
// batch. Schema-level checks here are the bare structural shape: the
// discriminator + workspaceId + a typed envelope/batch carrier. Doing
// more would couple this file to every entity schema for no gain.

const HlcShape = v.object({
  physicalMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  logical: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nodeId: v.pipe(v.string(), v.minLength(1)),
});

const MutationOriginShape = v.object({
  surfaceId: v.string(),
  deviceId: v.string(),
  userId: v.optional(v.string()),
});

const MutationEnvelopeShape = v.object({
  mutationId: v.pipe(v.string(), v.minLength(1)),
  hlc: HlcShape,
  origin: MutationOriginShape,
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  mutatorVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  body: v.looseObject({ kind: v.string() }),
});

export const SyncMutationMessageSchema = v.object({
  type: v.literal(SYNC_MUTATION_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  envelope: MutationEnvelopeShape,
});

export const SyncMutationBatchMessageSchema = v.object({
  type: v.literal(SYNC_MUTATION_BATCH_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  batch: v.object({
    batchId: v.pipe(v.string(), v.minLength(1)),
    mutations: v.array(MutationEnvelopeShape),
  }),
});

export const SyncMutationStreamMessageSchema = v.variant('type', [
  SyncMutationMessageSchema,
  SyncMutationBatchMessageSchema,
]);

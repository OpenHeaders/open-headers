/**
 * Inbound mutation receiver — Phase C C8.
 *
 * Parses {@link SYNC_MUTATION_TYPE} / {@link SYNC_MUTATION_BATCH_TYPE}
 * frames arriving over the backend WS and feeds them into the local
 * SW oracle via `applySyncRequest`. Symmetric to the C7 forwarder on
 * the outbound path; together they form the live data plane within
 * the trust zone (extension ↔ desktop / daemon).
 *
 * **Single-envelope frames** are wrapped into a synthetic one-mutation
 * `MutationBatch` before apply. The oracle's all-or-nothing semantics
 * are identical for a one-element batch and a multi-element one — the
 * synthetic `batchId` preserves traceability without forcing the
 * sender to bundle.
 *
 * **Validation.** Frames are parsed against the wire-shape valibot
 * schema at boundary. Failures log + drop; we don't tear the socket
 * down on a single malformed message because a future newer-protocol
 * sender might be sending us a frame kind we don't yet understand
 * (additive evolution of the protocol — see `version.ts`).
 *
 * **Echo prevention.** The receiver maintains a "recently seen
 * mutationId" set so a frame that originated locally and bounced
 * back from the peer (because the peer re-broadcasts everything it
 * applies) doesn't get re-applied + re-forwarded. Cleared once the
 * mutationId ages out of the window. The seen-set is the same data
 * the C11 dedup layer needs on the outbound forwarder; this module
 * registers itself with the forwarder so both sides share one
 * source of truth.
 */

import {
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SyncMutationBatchMessageSchema,
  SyncMutationMessageSchema,
} from '@openheaders/core/protocol';
import type { MutationBatch, MutationEnvelope } from '@openheaders/core/sync';
import * as v from 'valibot';

import { logger } from '@utils/logger';
import { applySyncRequest } from '@openheaders/oracle/sync/service';

const SCOPE = 'SyncReceiver';

/**
 * Recently-seen mutationIds — populated by every successful apply
 * (whether the envelope originated locally or arrived from the peer).
 * Read by the outbound forwarder (via {@link hasRecentlyApplied}) to
 * skip re-broadcasting the same envelope back to its source.
 *
 * Cap is generous: a typical user gesture is 1-20 envelopes; ten
 * thousand entries covers ≈500 large gestures while bounding memory
 * at well under 1MB on a typical SW.
 */
const SEEN_MUTATION_IDS = new Set<string>();
const SEEN_CAP = 10_000;

function rememberApplied(envelope: MutationEnvelope): void {
  SEEN_MUTATION_IDS.add(envelope.mutationId);
  if (SEEN_MUTATION_IDS.size > SEEN_CAP) {
    // Drop the oldest insertion. JS Set preserves insertion order;
    // we lean on that for O(1) eviction without a parallel queue.
    const first = SEEN_MUTATION_IDS.values().next().value;
    if (first !== undefined) SEEN_MUTATION_IDS.delete(first);
  }
}

/** True if this mutationId was applied within the seen-set window. */
export function hasRecentlyApplied(mutationId: string): boolean {
  return SEEN_MUTATION_IDS.has(mutationId);
}

/** Test-only — clear state between cases. */
export function __resetMutationReceiverForTests(): void {
  SEEN_MUTATION_IDS.clear();
}

/** Test-only — peek the seen set. */
export function __seenMutationCountForTests(): number {
  return SEEN_MUTATION_IDS.size;
}

/**
 * Attempt to handle one parsed WS message. Returns `true` if the
 * message matched a known mutation-stream kind (and was either
 * applied or dropped as a duplicate), `false` otherwise so the
 * caller can route to other handlers.
 */
export async function handleIncomingMutationFrame(raw: unknown): Promise<boolean> {
  if (!isMutationStreamFrame(raw)) return false;

  if (raw.type === SYNC_MUTATION_TYPE) {
    const parsed = parseOrLog(SyncMutationMessageSchema, raw, 'oh.sync.mutation');
    if (!parsed) return true;
    await applySingleEnvelope(parsed.envelope as unknown as MutationEnvelope);
    return true;
  }

  const parsed = parseOrLog(SyncMutationBatchMessageSchema, raw, 'oh.sync.mutationBatch');
  if (!parsed) return true;
  await applyBatch(parsed.batch as unknown as MutationBatch);
  return true;
}

function isMutationStreamFrame(raw: unknown): raw is { type: string } {
  if (!raw || typeof raw !== 'object') return false;
  const t = (raw as { type?: unknown }).type;
  return t === SYNC_MUTATION_TYPE || t === SYNC_MUTATION_BATCH_TYPE;
}

function parseOrLog<TSchema extends v.GenericSchema>(
  schema: TSchema,
  raw: unknown,
  label: string,
): v.InferOutput<TSchema> | null {
  const result = v.safeParse(schema, raw);
  if (!result.success) {
    logger.warn(SCOPE, `dropping malformed ${label} frame`, result.issues);
    return null;
  }
  return result.output;
}

async function applySingleEnvelope(envelope: MutationEnvelope): Promise<void> {
  if (SEEN_MUTATION_IDS.has(envelope.mutationId)) {
    // C11 dedup at receive — own-echo or replay. The oracle's mutator
    // commit path is also idempotent, but skipping early avoids the
    // round-trip + redundant broadcast.
    return;
  }
  const batch: MutationBatch = { batchId: `wire-${envelope.mutationId}`, mutations: [envelope] };
  await applyAndRemember(batch);
}

async function applyBatch(batch: MutationBatch): Promise<void> {
  // A batch is all-or-nothing; if every envelope in it is already
  // known we can short-circuit. Mixed batches go through apply — the
  // oracle's per-envelope idempotency handles the dup envelopes.
  const allKnown = batch.mutations.every((e) => SEEN_MUTATION_IDS.has(e.mutationId));
  if (allKnown) return;
  await applyAndRemember(batch);
}

async function applyAndRemember(batch: MutationBatch): Promise<void> {
  try {
    const response = await applySyncRequest({
      type: 'oh.sync.apply',
      batch,
      sideEffects: [],
    });
    if (!response.ok) {
      logger.warn(SCOPE, `inbound batch ${batch.batchId} rejected`, response.failure);
      return;
    }
    for (const env of batch.mutations) rememberApplied(env);
  } catch (err) {
    logger.warn(SCOPE, `apply failed for ${batch.batchId}`, err);
  }
}

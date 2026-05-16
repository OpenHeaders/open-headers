/**
 * Host-neutral inbound bridge for `oh.sync.mutation` /
 * `oh.sync.mutationBatch` frames (Phase C C8 / C9).
 *
 * Lives in oracle (not in either app) so the extension SW, desktop
 * main, and the future daemon share one source of truth for:
 *
 *   - **Dedup state** — the seen-mutationId set that breaks echo
 *     loops between two peers that both apply + re-broadcast every
 *     envelope they see.
 *   - **Apply contract** — single envelopes wrap into a synthetic
 *     one-mutation batch so the oracle's all-or-nothing semantics
 *     fire identically for both wire shapes.
 *
 * The seen-set is process-wide. That's correct because a single host
 * has a single oracle today and either everything routes through it
 * or nothing does. The cap is generous (10k entries ≈ 500 typical
 * gestures); eviction is FIFO via `Set` insertion order.
 *
 * **What this file does NOT do:**
 *   - parse the wire frame (the caller already did)
 *   - decide whether to forward the resulting broadcast back out
 *     over WS — that's the per-host forwarder's call, using
 *     {@link hasRecentlyApplied} to skip echoes
 *   - apply the seen-set to outbound. Outbound forwarders consult
 *     {@link hasRecentlyApplied} themselves.
 *
 * **C11 dedup contract — three layers, all idempotent:**
 *
 *   1. **This bridge** — early return on `hasRecentlyApplied`. Avoids
 *      the round-trip into `applySyncRequest` + the redundant
 *      broadcast cascade. Wire-level (this is the only layer that
 *      knows about transport echo).
 *   2. **Document store** (`core/sync/store`) — its own
 *      `appliedMutationIds` set; `apply()` short-circuits on a
 *      known id and returns the prior outcome. Store-level.
 *   3. **Mutation log** (`oracle/sync/mutation-log`) — `append` and
 *      `appendAll` are dedup-safe via the log's own seen set. Storage-
 *      level, also feeds `MutationLog.hasMutation()` for cheap "did we
 *      already see this?" queries from any transport.
 *
 * Any redelivery path — wire echo, multi-transport, reconnect replay,
 * snapshot+delta overlap — is a no-op by composition: even if one
 * layer is bypassed (e.g. a unit test calls `oracle.apply` directly),
 * the next one catches the duplicate. Non-negotiable per the design
 * doc; tests in `mutation-id-dedup.test.ts` pin the WS-redelivery path.
 */
import type { MutationBatch, MutationEnvelope } from '@openheaders/core/sync';

import { applySyncRequest } from './service';

const SEEN_MUTATION_IDS = new Set<string>();
const SEEN_CAP = 10_000;

function rememberApplied(envelope: MutationEnvelope): void {
  SEEN_MUTATION_IDS.add(envelope.mutationId);
  if (SEEN_MUTATION_IDS.size > SEEN_CAP) {
    const first = SEEN_MUTATION_IDS.values().next().value;
    if (first !== undefined) SEEN_MUTATION_IDS.delete(first);
  }
}

/** True if this mutationId is in the per-host receive-side seen set. */
export function hasRecentlyApplied(mutationId: string): boolean {
  return SEEN_MUTATION_IDS.has(mutationId);
}

/** Test-only — clear state between cases. */
export function __resetMutationStreamBridgeForTests(): void {
  SEEN_MUTATION_IDS.clear();
}

/** Test-only — peek the seen set. */
export function __seenMutationStreamCountForTests(): number {
  return SEEN_MUTATION_IDS.size;
}

/**
 * Apply a peer-sourced single envelope. Idempotent: a second call
 * with the same mutationId is a no-op (the oracle's commit path is
 * also idempotent at apply time, but the early return saves the
 * round-trip + redundant broadcast).
 */
export async function applyInboundMutationEnvelope(envelope: MutationEnvelope): Promise<void> {
  if (SEEN_MUTATION_IDS.has(envelope.mutationId)) return;
  const batch: MutationBatch = { batchId: `wire-${envelope.mutationId}`, mutations: [envelope] };
  await applyInboundMutationBatch(batch);
}

/**
 * Apply a peer-sourced batch. Short-circuits when every envelope is
 * already known. Successful apply records each envelope in the seen
 * set; a failed apply leaves the seen set untouched so a subsequent
 * redelivery can retry.
 */
export async function applyInboundMutationBatch(batch: MutationBatch): Promise<void> {
  const allKnown = batch.mutations.every((e) => SEEN_MUTATION_IDS.has(e.mutationId));
  if (allKnown) return;
  const response = await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [] });
  if (!response.ok) return;
  for (const env of batch.mutations) rememberApplied(env);
}

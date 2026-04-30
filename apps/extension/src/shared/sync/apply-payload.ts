/**
 * Shared `oh.sync.apply` invocation + ack-shape adapter for renderer-side
 * write-clients.
 *
 * Every entity's write-client (rule, template, request, env, vault,
 * collection, folder, …) emits a `(batch, sideEffects)` pair and
 * collapses the bridge response into a uniform structured result. The
 * shape was duplicated verbatim across 17 write-clients before this
 * extraction; consolidating here keeps the `oh.sync.apply` contract in
 * one place and removes ~220 lines of pure copy-paste.
 *
 * Per-entity `MutationResult` shapes that extend the simple result with
 * an entity-specific success payload (e.g. `{ ok: true, rule: V5.Rule }`)
 * stay in their write-client — only the simple ack adapter is shared.
 */

import type { MutationBatch, SideEffectIntent } from '@openheaders/core/sync';
import { call } from '@utils/bridge';

/**
 * Uniform structured result for sync writes. Every entity's
 * `XSimpleResult` is a structural alias of this — keeping per-entity
 * names in the write-client API while sharing the implementation.
 */
export type SyncSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface SyncMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Fire `oh.sync.apply` for a built batch + side-effect intents.
 *
 * - Empty-batch short-circuit returns `{ ok: true }` without firing the
 *   bridge — every entity's `buildUpdateBatch` may emit zero envelopes
 *   for a no-op patch (byte-identical save), and that's success.
 * - Bridge transport rejections collapse onto
 *   `{ ok: false, reason: 'other', message }` — see §oracle for the
 *   `failure.detail` shape.
 * - Thrown errors (bridge dead, runtime disconnect) likewise collapse
 *   to `'other'` with the error message.
 */
export async function applySyncPayload(payload: SyncMutationPayload): Promise<SyncSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', {
      batch: payload.batch,
      sideEffects: payload.sideEffects,
    });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

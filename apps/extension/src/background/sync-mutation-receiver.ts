/**
 * Inbound mutation-stream wire boundary — Phase C C8.
 *
 * Parses {@link SYNC_MUTATION_TYPE} / {@link SYNC_MUTATION_BATCH_TYPE}
 * frames arriving over the backend WS, then hands the typed envelope /
 * batch to the host-neutral inbound bridge
 * ({@link applyInboundMutationEnvelope} / {@link applyInboundMutationBatch})
 * in `@openheaders/oracle`.
 *
 * The bridge owns the apply pipeline shared by every host (extension
 * SW, desktop main, future daemon) — the seen-set echo dedup, the
 * receiver-side org filter, the `workspace.write` gate, side-effect
 * derivation, and the C12 HLC fold. This module is purely the extension
 * SW's WS boundary: validate the frame shape, then delegate. Keeping the
 * apply pipeline in one place is what stops the two hosts' receivers
 * from drifting apart (they previously each re-implemented the seen-set
 * + filters independently).
 *
 * **Validation.** Frames are parsed against the wire-shape valibot
 * schema at boundary. Failures log + drop; we don't tear the socket
 * down on a single malformed message because a future newer-protocol
 * sender might be sending us a frame kind we don't yet understand
 * (additive evolution of the protocol — see `version.ts`).
 */

import {
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SyncMutationBatchMessageSchema,
  SyncMutationMessageSchema,
} from '@openheaders/core/protocol';
import type { MutationBatch, MutationEnvelope } from '@openheaders/core/sync';
import { applyInboundMutationBatch, applyInboundMutationEnvelope } from '@openheaders/oracle/sync';
import { logger } from '@utils/logger';
import * as v from 'valibot';

const SCOPE = 'SyncReceiver';

/**
 * Attempt to handle one parsed WS message. Returns `true` if the
 * message matched a known mutation-stream kind (and was either
 * delegated to the bridge or dropped after a parse failure), `false`
 * otherwise so the caller can route to other handlers.
 */
export async function handleIncomingMutationFrame(raw: unknown): Promise<boolean> {
  if (!isMutationStreamFrame(raw)) return false;

  if (raw.type === SYNC_MUTATION_TYPE) {
    const parsed = parseOrLog(SyncMutationMessageSchema, raw, 'oh.sync.mutation');
    if (!parsed) return true;
    await applyInboundMutationEnvelope(parsed.envelope as unknown as MutationEnvelope);
    return true;
  }

  const parsed = parseOrLog(SyncMutationBatchMessageSchema, raw, 'oh.sync.mutationBatch');
  if (!parsed) return true;
  await applyInboundMutationBatch(parsed.batch as unknown as MutationBatch);
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

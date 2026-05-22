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
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  type MutationBatch,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import { applyInboundMutationBatch, applyInboundMutationEnvelope } from '@openheaders/oracle/sync';
import { logger } from '@utils/logger';
import * as v from 'valibot';
import { isLoopbackBackend } from './backend-target';

const SCOPE = 'SyncReceiver';

/**
 * True for the `extensionWorkspace` singleton's `activeId` `setField` —
 * the active-workspace pointer. The active pointer is a per-device
 * operative-view preference: it mirrors down from a loopback desktop
 * (same machine) but must never be moved by a LAN/WAN peer. The
 * loopback gate below drops these envelopes when the backend is remote;
 * every other `extensionWorkspace` mutation (the `workspaces` set) keeps
 * syncing regardless.
 */
function isActivePointerEnvelope(env: MutationEnvelope): boolean {
  const b = env.body;
  return (
    b.kind === 'setField' &&
    b.type === EXTENSION_WORKSPACE_ENTITY_TYPE &&
    b.id === EXTENSION_WORKSPACE_ID &&
    b.path === EXTENSION_WORKSPACE_ACTIVE_ID_PATH
  );
}

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
    const envelope = parsed.envelope as unknown as MutationEnvelope;
    if (isActivePointerEnvelope(envelope) && !isLoopbackBackend()) {
      logger.debug(SCOPE, 'dropped inbound active-workspace pointer from a non-loopback backend');
      return true;
    }
    await applyInboundMutationEnvelope(envelope);
    return true;
  }

  const parsed = parseOrLog(SyncMutationBatchMessageSchema, raw, 'oh.sync.mutationBatch');
  if (!parsed) return true;
  const gated = gateActivePointer(parsed.batch as unknown as MutationBatch);
  if (gated.mutations.length === 0) return true;
  await applyInboundMutationBatch(gated);
  return true;
}

/**
 * Strip active-workspace pointer envelopes from an inbound batch when
 * the backend is not on loopback — a LAN/WAN peer must never move this
 * browser's operative-view selection. A loopback desktop's batch passes
 * through untouched; so does any batch carrying no pointer envelope.
 */
function gateActivePointer(batch: MutationBatch): MutationBatch {
  if (isLoopbackBackend()) return batch;
  const kept = batch.mutations.filter((e) => !isActivePointerEnvelope(e));
  if (kept.length === batch.mutations.length) return batch;
  logger.debug(
    SCOPE,
    `dropped ${batch.mutations.length - kept.length} inbound active-workspace pointer mutation(s) from a non-loopback backend`,
  );
  return { batchId: batch.batchId, mutations: kept };
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

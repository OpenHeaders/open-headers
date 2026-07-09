/**
 * Inbound mutation-stream wire boundary — Phase C C8.
 *
 * Parses {@link SYNC_MUTATION_TYPE} / {@link SYNC_MUTATION_BATCH_TYPE}
 * frames arriving over a backend WS, then hands the typed envelope /
 * batch to the host-neutral inbound bridge
 * ({@link applyInboundMutationEnvelope} / {@link applyInboundMutationBatch})
 * in `@openheaders/oracle`.
 *
 * The bridge owns the apply pipeline shared by every host (extension
 * SW, desktop main, future daemon) — the seen-set echo dedup, the
 * receiver-side org filter, the `workspace.write` gate, side-effect
 * derivation, and the C12 HLC fold. This module is purely the extension
 * SW's WS boundary: validate the frame shape, gate it against the
 * delivering connection, then delegate.
 *
 * **Per-connection gates** (MULTI_BACKEND_PLAN.md §3, invariants 2 + 4):
 *
 *   - **Org ownership** — a connection delivers only envelopes stamped
 *     with an Org *bound to that backend* (`getOrgBackendBindings`).
 *     Tightened from "any authorized Org": a misbehaving backend cannot
 *     inject data into another backend's Orgs or the home Org. The
 *     resolver-side filter in the bridge stays as defense-in-depth.
 *   - **Local-only** — the active-workspace pointer and same-device-only
 *     root secrets pass only over a loopback connection, evaluated on
 *     the wire that actually delivered the frame.
 *
 * **Validation.** Frames are parsed against the wire-shape valibot
 * schema at boundary. Failures log + drop; we don't tear the socket
 * down on a single malformed message because a future newer-protocol
 * sender might be sending us a frame kind we don't yet understand
 * (additive evolution of the protocol — see `version.ts`).
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
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
  isSameDeviceOnlyMutation,
  type MutationBatch,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';
import { applyInboundMutationBatch, applyInboundMutationEnvelope } from '../mutation-stream-bridge';
import type { BackendWireHandle } from './backend-connection-manager';

const SCOPE = 'SyncReceiver';

/**
 * True for the `extensionWorkspace` singleton's `activeId` `setField` —
 * the active-workspace pointer. The active pointer is a per-device
 * operative-view preference: it mirrors down from a loopback desktop
 * (same machine) but must never be moved by a LAN/WAN peer. The
 * loopback gate below drops these envelopes when the delivering backend
 * is remote; every other `extensionWorkspace` mutation (the
 * `workspaces` set) keeps syncing regardless.
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
 * Inbound envelopes a non-loopback backend must never deliver to this
 * browser: the per-device active-workspace pointer (an operative-view
 * preference, not synced identity state) and same-device-only root
 * secrets (the vault — WS-B B8 defense-in-depth). The backend already
 * strips the vault host-side on every egress path; this is the
 * receive-side mirror so a buggy or hostile LAN/WAN backend can't push a
 * seed down for this host to re-seal. A loopback backend is the same
 * device — both kinds pass through untouched.
 */
function isLocalOnlyInbound(env: MutationEnvelope): boolean {
  return isActivePointerEnvelope(env) || isSameDeviceOnlyMutation(env);
}

/** The envelope's Org is bound to the delivering connection's backend. */
function isOwnedByWire(env: MutationEnvelope, wire: BackendWireHandle): boolean {
  return getOrgBackendBindings().get(env.orgId) === wire.backendId;
}

/**
 * Attempt to handle one parsed WS message from `wire`. Returns `true`
 * if the message matched a known mutation-stream kind (and was either
 * delegated to the bridge or dropped by a gate / parse failure),
 * `false` otherwise so the caller can route to other handlers.
 */
export async function handleIncomingMutationFrame(raw: unknown, wire: BackendWireHandle): Promise<boolean> {
  if (!isMutationStreamFrame(raw)) return false;

  if (raw.type === SYNC_MUTATION_TYPE) {
    const parsed = parseOrLog(SyncMutationMessageSchema, raw, 'oh.sync.mutation');
    if (!parsed) return true;
    const envelope = parsed.envelope as unknown as MutationEnvelope;
    if (!isOwnedByWire(envelope, wire)) {
      logger.debug(SCOPE, `dropped inbound envelope for Org ${envelope.orgId} not owned by this connection`);
      return true;
    }
    if (!wire.isLoopback() && isLocalOnlyInbound(envelope)) {
      logger.debug(SCOPE, 'dropped inbound local-only envelope from a non-loopback backend');
      return true;
    }
    await applyInboundMutationEnvelope(envelope);
    return true;
  }

  const parsed = parseOrLog(SyncMutationBatchMessageSchema, raw, 'oh.sync.mutationBatch');
  if (!parsed) return true;
  const gated = gateBatch(parsed.batch as unknown as MutationBatch, wire);
  if (gated.mutations.length === 0) return true;
  await applyInboundMutationBatch(gated);
  return true;
}

/**
 * Apply both per-connection gates to an inbound batch: strip envelopes
 * whose Org isn't bound to the delivering backend, and — when the
 * connection is not on loopback — local-only envelopes
 * ({@link isLocalOnlyInbound}). A loopback desktop's own-Org batch
 * passes through untouched.
 */
function gateBatch(batch: MutationBatch, wire: BackendWireHandle): MutationBatch {
  const loopback = wire.isLoopback();
  const kept = batch.mutations.filter((e) => isOwnedByWire(e, wire) && (loopback || !isLocalOnlyInbound(e)));
  if (kept.length === batch.mutations.length) return batch;
  logger.debug(
    SCOPE,
    `dropped ${batch.mutations.length - kept.length} inbound mutation(s) withheld by the per-connection gates`,
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

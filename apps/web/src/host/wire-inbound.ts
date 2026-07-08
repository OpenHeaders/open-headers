/**
 * Inbound side of the web tab's single wire — the one-backend analog
 * of the extension SW's mutation + awareness receivers. Frames are
 * validated at the boundary, gated per-wire, then handed to the same
 * host-neutral apply pipeline every host shares
 * ({@link applyInboundMutationEnvelope} / batch — seen-set echo dedup,
 * receiver-side org filter, `workspace.write` gate, side-effect
 * derivation, HLC fold).
 *
 * Per-wire gates (mirroring the extension receiver):
 *
 *   - **Org ownership** — the wire delivers only envelopes stamped with
 *     the Org bound to the serving daemon. Defense-in-depth on top of
 *     the bridge's authorized-set filter.
 *   - **Local-only** — the active-workspace pointer and same-device-only
 *     root secrets pass only when the serving origin is loopback (the
 *     daemon is this machine). A LAN/WAN daemon never moves them.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  SYNC_AWARENESS_PRESENCE_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  type SyncAwarenessPresenceMessage,
  SyncAwarenessPresenceMessageSchema,
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
import {
  applyInboundAwarenessFrame,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  getAwarenessStoreForWorkspace,
} from '@openheaders/oracle/sync';
import * as v from 'valibot';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';

const SCOPE = 'WireInbound';

/** Is the serving origin this machine — i.e. a loopback daemon? */
export function isServedOriginLoopback(): boolean {
  const host = location.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

/** The per-device active-workspace pointer (`extensionWorkspace.activeId`). */
function isActivePointerEnvelope(env: MutationEnvelope): boolean {
  const b = env.body;
  return (
    b.kind === 'setField' &&
    b.type === EXTENSION_WORKSPACE_ENTITY_TYPE &&
    b.id === EXTENSION_WORKSPACE_ID &&
    b.path === EXTENSION_WORKSPACE_ACTIVE_ID_PATH
  );
}

function isLocalOnlyInbound(env: MutationEnvelope): boolean {
  return isActivePointerEnvelope(env) || isSameDeviceOnlyMutation(env);
}

function isOwnedByWire(env: MutationEnvelope): boolean {
  return getOrgBackendBindings().get(env.orgId) === WEB_DAEMON_BACKEND_ID;
}

/**
 * Attempt to handle one parsed wire frame. Returns `true` when the
 * frame matched a mutation-stream or awareness kind (applied or
 * dropped by a gate / parse failure), `false` so the caller can route
 * other frame types onward.
 */
export async function handleInboundWireFrame(raw: unknown): Promise<boolean> {
  if (!raw || typeof raw !== 'object') return false;
  const type = (raw as { type?: unknown }).type;

  if (type === SYNC_MUTATION_TYPE) {
    const parsed = parseOrLog(SyncMutationMessageSchema, raw, 'oh.sync.mutation');
    if (!parsed) return true;
    const envelope = parsed.envelope as unknown as MutationEnvelope;
    if (!isOwnedByWire(envelope)) {
      logger.debug(SCOPE, `dropped inbound envelope for Org ${envelope.orgId} not owned by this wire`);
      return true;
    }
    if (!isServedOriginLoopback() && isLocalOnlyInbound(envelope)) {
      logger.debug(SCOPE, 'dropped inbound local-only envelope from a non-loopback daemon');
      return true;
    }
    await applyInboundMutationEnvelope(envelope);
    return true;
  }

  if (type === SYNC_MUTATION_BATCH_TYPE) {
    const parsed = parseOrLog(SyncMutationBatchMessageSchema, raw, 'oh.sync.mutationBatch');
    if (!parsed) return true;
    const gated = gateBatch(parsed.batch as unknown as MutationBatch);
    if (gated.mutations.length === 0) return true;
    await applyInboundMutationBatch(gated);
    return true;
  }

  if (type === SYNC_AWARENESS_PRESENCE_TYPE) {
    const parsed = parseOrLog(SyncAwarenessPresenceMessageSchema, raw, 'oh.awareness.presence');
    if (!parsed) return true;
    applyInboundAwarenessFrame(parsed as unknown as SyncAwarenessPresenceMessage, {
      resolveStore: getAwarenessStoreForWorkspace,
    });
    return true;
  }

  return false;
}

function gateBatch(batch: MutationBatch): MutationBatch {
  const loopback = isServedOriginLoopback();
  const kept = batch.mutations.filter((e) => isOwnedByWire(e) && (loopback || !isLocalOnlyInbound(e)));
  if (kept.length === batch.mutations.length) return batch;
  logger.debug(SCOPE, `dropped ${batch.mutations.length - kept.length} inbound mutation(s) withheld by the wire gates`);
  return { batchId: batch.batchId, mutations: kept };
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

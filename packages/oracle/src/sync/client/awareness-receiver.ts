/**
 * Cross-host awareness — client-plane inbound.
 *
 * Frame router companion to `awareness-forwarder.ts`. Parses
 * `oh.awareness.presence` frames arriving from a backend wire and folds
 * the carried presence into the local awareness store via the
 * host-neutral `applyInboundAwarenessFrame` helper. Symmetric to the
 * shared mutation receiver (`mutation-receiver.ts`); hosts pass it into
 * `installBackendSyncPlane`'s `extraInboundHandlers`.
 *
 * No own-echo dedup here: each host only forwards states whose
 * `identity.appId` matches its own, so a frame arriving over the wire
 * carries exclusively peer surfaces. The local store keys on
 * `identity.instanceId`, which is globally unique per surface mount.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import {
  SYNC_AWARENESS_PRESENCE_TYPE,
  type SyncAwarenessPresenceMessage,
  SyncAwarenessPresenceMessageSchema,
} from '@openheaders/core/protocol';
import * as v from 'valibot';
import { applyInboundAwarenessFrame } from '../awareness/awareness-inbound';
import { getAwarenessStoreForWorkspace } from '../service';

const SCOPE = 'AwarenessReceiver';

/**
 * Attempt to handle one parsed WS frame. Returns `true` if the message
 * matched `oh.awareness.presence` (regardless of parse outcome — a
 * malformed awareness frame is still ours to drop), `false` otherwise
 * so the next handler can claim it.
 */
export function handleIncomingAwarenessFrame(raw: unknown): boolean {
  if (!isAwarenessFrame(raw)) return false;
  const result = v.safeParse(SyncAwarenessPresenceMessageSchema, raw);
  if (!result.success) {
    logger.warn(SCOPE, `dropping malformed ${SYNC_AWARENESS_PRESENCE_TYPE} frame`, result.issues);
    return true;
  }
  const frame = result.output as unknown as SyncAwarenessPresenceMessage;
  applyInboundAwarenessFrame(frame, { resolveStore: getAwarenessStoreForWorkspace });
  return true;
}

function isAwarenessFrame(raw: unknown): raw is { type: string } {
  if (!raw || typeof raw !== 'object') return false;
  return (raw as { type?: unknown }).type === SYNC_AWARENESS_PRESENCE_TYPE;
}

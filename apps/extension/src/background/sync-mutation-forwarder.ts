/**
 * Outbound mutation forwarder — Phase C C7.
 *
 * Every envelope the local SW oracle commits flows through here, and
 * the forwarder writes it to the backend WS as an
 * {@link SYNC_MUTATION_TYPE} frame. The receiver (desktop main /
 * daemon) routes the envelope into its own oracle via the symmetric
 * receive handler (C9), so a single user gesture on the extension
 * shows up on the desktop within one WS round-trip.
 *
 * Composition:
 *
 *   1. The oracle's `broadcastSyncEvent` host hook fires per committed
 *      envelope (see `background.ts`).
 *   2. The hook also calls {@link forwardMutationToBackend}.
 *   3. {@link forwardMutationToBackend} consults the configurable
 *      {@link shouldForwardMutation} predicate, then hands the
 *      envelope to `sendViaWebSocket`.
 *
 * The predicate seam exists so the C11 dedup layer can plug in
 * without rewriting this module — it will fail-closed on envelopes
 * whose `mutationId` is already in the "seen from peer" set,
 * breaking the echo loop. Until C11 lands, the default predicate
 * forwards everything; this is safe today because the inbound apply
 * path (C8) is still stubbed at `websocket.ts:176`, so no inbound
 * envelopes reach the oracle in the first place.
 *
 * Failure model: `sendViaWebSocket` returns `false` when the socket
 * is not open. The forwarder treats that as "queue for later" —
 * which today means dropping (the pending-out queue lands at C13).
 * Logging happens once per drop, not per envelope, to avoid
 * flooding when the SW is offline for an extended period.
 */

import {
  SYNC_MUTATION_TYPE,
  type SyncMutationMessage,
} from '@openheaders/core/protocol';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';

import { logger } from '@utils/logger';
import { sendViaWebSocket } from './websocket';

export type ShouldForwardMutation = (event: OracleSyncBroadcastEvent) => boolean;

let shouldForward: ShouldForwardMutation = () => true;

/**
 * Swap the predicate used by {@link forwardMutationToBackend}. The
 * C11 dedup layer calls this at module-load to install the
 * seen-from-peer filter.
 */
export function setShouldForwardMutation(predicate: ShouldForwardMutation): void {
  shouldForward = predicate;
}

let droppedWhileOffline = 0;
let loggedOfflineDrop = false;

export function forwardMutationToBackend(event: OracleSyncBroadcastEvent): void {
  if (!shouldForward(event)) return;
  // Rolled-back envelopes never reach the broadcast bus in the first
  // place (the oracle filters them before firing the hook), so we
  // don't need to recheck outcome status here. The envelope's
  // workspaceId carries the routing key.
  const msg: SyncMutationMessage = {
    type: SYNC_MUTATION_TYPE,
    workspaceId: event.envelope.workspaceId,
    envelope: event.envelope,
  };
  const sent = sendViaWebSocket(msg as unknown as Record<string, unknown>);
  if (!sent) {
    droppedWhileOffline++;
    if (!loggedOfflineDrop) {
      logger.info(
        'SyncForwarder',
        'Backend not connected — outbound envelope queued (pending-out queue lands at C13)',
      );
      loggedOfflineDrop = true;
    }
    return;
  }
  // Reset the once-per-offline-window logging gate once a send
  // succeeds, so the next disconnect window logs once again.
  if (loggedOfflineDrop) {
    logger.info('SyncForwarder', `Backend reconnected; ${droppedWhileOffline} envelope(s) had been dropped`);
    droppedWhileOffline = 0;
    loggedOfflineDrop = false;
  }
}

/** Test-only accessor — counts envelopes dropped during offline windows. */
export function __getDroppedOfflineCount(): number {
  return droppedWhileOffline;
}

/** Test-only — reset internal counters between cases. */
export function __resetMutationForwarderForTests(): void {
  shouldForward = () => true;
  droppedWhileOffline = 0;
  loggedOfflineDrop = false;
}

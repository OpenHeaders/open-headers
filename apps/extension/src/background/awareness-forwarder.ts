/**
 * Cross-host awareness — extension SW outbound.
 *
 * Wraps the local oracle's `broadcastAwareness` hook with a WS send.
 * Mirrors the desktop's `wsServer?.broadcastFrame(...)` path: every
 * canonical-presence emission for a workspace also goes onto the wire
 * as a typed `oh.awareness.presence` frame so the peer host can fold
 * extension surfaces into its local awareness store.
 *
 * Echo prevention rides on `identity.appId`: only states whose appId
 * matches `'extension'` get forwarded. Peer-received states are
 * filtered out before send, so the wire never loops.
 *
 * No queueing on disconnect — awareness is ephemeral. If the WS is
 * down, the desktop will rebuild its view of extension surfaces from
 * the next emission after reconnect (each local awareness publish
 * triggers a fresh `broadcastAwareness`, and the TTL on the desktop
 * side ages out stale rows).
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type { AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import { peekActiveWorkspaceId, snapshotAwarenessPresence } from '@openheaders/oracle/sync';
import { sendViaWebSocket } from './websocket';

const SCOPE = 'AwarenessForwarder';

export interface AwarenessForwarderEvent {
  workspaceId: string;
  presence: readonly AwarenessState[];
}

export function forwardAwarenessToBackend(event: AwarenessForwarderEvent): void {
  const localOnly = event.presence.filter((s) => s.identity.appId === 'extension');
  // An empty presence frame is meaningful — it tells the peer "no
  // extension surfaces here anymore" so its mirror can age them out
  // proactively rather than waiting for TTL. But we only send empty
  // frames when the original event was also empty; otherwise the
  // filter-down-to-empty case means peer-received states exist locally
  // and we shouldn't overwrite peer state with our own absence.
  if (localOnly.length === 0 && event.presence.length > 0) return;

  const ok = sendViaWebSocket({
    type: SYNC_AWARENESS_PRESENCE_TYPE,
    workspaceId: event.workspaceId,
    presence: localOnly,
  });
  if (!ok) {
    // WS not connected — the peer rebuilds its view from the next
    // emission after reconnect; no queue needed for ephemeral state.
    logger.info(SCOPE, 'awareness forward skipped (ws not open)');
  }
}

/**
 * Push the CURRENT active-workspace awareness snapshot onto the wire.
 * Called on WS open so the peer doesn't have to wait for the next
 * local surface activity to learn that we're here. No-op when there's
 * no active workspace yet.
 */
export function forwardCurrentAwarenessOnConnect(): void {
  const workspaceId = peekActiveWorkspaceId();
  if (!workspaceId) return;
  forwardAwarenessToBackend({
    workspaceId,
    presence: snapshotAwarenessPresence(),
  });
}

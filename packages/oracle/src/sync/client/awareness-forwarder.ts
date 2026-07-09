/**
 * Cross-host awareness — client-plane outbound.
 *
 * Wraps the local oracle's `broadcastAwareness` hook with a WS send:
 * every canonical-presence emission for a workspace also goes onto the
 * owning backend's wire as a typed `oh.awareness.presence` frame so the
 * peer host can fold this host's surfaces into its local awareness
 * store.
 *
 * Echo prevention rides on `identity.appId`: only states whose appId
 * matches the calling host's own (`localAppId`) get forwarded.
 * Peer-received states are filtered out before send, so the wire never
 * loops.
 *
 * No queueing on disconnect — awareness is ephemeral. If the WS is
 * down, the peer rebuilds its view of this host's surfaces from the
 * next emission after reconnect (each local awareness publish triggers
 * a fresh `broadcastAwareness`, and the TTL on the peer side ages out
 * stale rows).
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { AppKind, AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import { getWorkspace } from '../../workspace/extension-workspace-store';
import { peekActiveWorkspaceId } from '../host-hooks';
import { snapshotAwarenessPresence } from '../service';
import { sendToBackend } from './backend-connection-manager';

const SCOPE = 'AwarenessForwarder';

export interface AwarenessForwarderEvent {
  workspaceId: string;
  presence: readonly AwarenessState[];
}

export function forwardAwarenessToBackend(event: AwarenessForwarderEvent, localAppId: AppKind): void {
  const localOnly = event.presence.filter((s) => s.identity.appId === localAppId);
  // An empty presence frame is meaningful — it tells the peer "no
  // surfaces of mine here anymore" so its mirror can age them out
  // proactively rather than waiting for TTL. But we only send empty
  // frames when the original event was also empty; otherwise the
  // filter-down-to-empty case means peer-received states exist locally
  // and we shouldn't overwrite peer state with our own absence.
  if (localOnly.length === 0 && event.presence.length > 0) return;

  // Awareness routes like any other Org-scoped frame: to the backend
  // the workspace's Org is bound to. A home-Org workspace binds to no
  // backend — no peer knows it, nothing to forward.
  const orgId = getWorkspace(event.workspaceId)?.orgId;
  const backendId = orgId ? getOrgBackendBindings().get(orgId) : undefined;
  if (!backendId) return;

  const ok = sendToBackend(backendId, {
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
export function forwardCurrentAwarenessOnConnect(localAppId: AppKind): void {
  const workspaceId = peekActiveWorkspaceId();
  if (!workspaceId) return;
  forwardAwarenessToBackend(
    {
      workspaceId,
      presence: snapshotAwarenessPresence(),
    },
    localAppId,
  );
}

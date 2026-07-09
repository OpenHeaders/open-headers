/**
 * Extension install of the shared per-wire sync plane
 * (`@openheaders/oracle/sync/client/backend-sync-plane`) — the
 * extension-bound edges: the `extension` HELLO role, the manifest-based
 * agent string, the awareness push on SYNCED, and the awareness
 * receiver as the host's extra inbound frame handler.
 */
import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import { installBackendSyncPlane, type SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';
import { runtime } from '@utils/browser-api';
import { forwardCurrentAwarenessOnConnect } from '../awareness-forwarder';
import { handleIncomingAwarenessFrame } from '../awareness-receiver';

export type { HandshakeLifecycleEvent, SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';

export function installWsFrameRouting(): SyncWiring {
  return installBackendSyncPlane({
    role: HANDSHAKE_ROLES.EXTENSION,
    getAgent: () => `@openheaders/extension@${runtime.getManifest().version}`,
    onSyncedPresencePush: forwardCurrentAwarenessOnConnect,
    extraInboundHandlers: [(frame) => handleIncomingAwarenessFrame(frame)],
  });
}

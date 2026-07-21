/**
 * Extension install of the shared per-wire sync plane
 * (`@openheaders/oracle/sync/client/backend-sync-plane`) — the
 * extension-bound edges: the `extension` HELLO role, the manifest-based
 * agent string, the awareness push on SYNCED, and the awareness
 * receiver as the host's extra inbound frame handler.
 */
import { HANDSHAKE_ROLES } from '@openheaders/core/protocol';
import { forwardCurrentAwarenessOnConnect } from '@openheaders/oracle/sync/client/awareness-forwarder';
import { handleIncomingAwarenessFrame } from '@openheaders/oracle/sync/client/awareness-receiver';
import { installBackendSyncPlane, type SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';
import { runtime } from '@utils/browser-api';
import { handleIncomingMigrationPullFrame } from '../modules/migration-mirror';
import { peekSyncInstallId } from '../modules/sync-install-id';

export type { HandshakeLifecycleEvent, SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';

export function installWsFrameRouting(): SyncWiring {
  return installBackendSyncPlane({
    role: HANDSHAKE_ROLES.EXTENSION,
    getAgent: () => `@openheaders/extension@${runtime.getManifest().version}`,
    getInstallId: () => peekSyncInstallId(),
    onSyncedPresencePush: () => forwardCurrentAwarenessOnConnect('extension'),
    extraInboundHandlers: [
      (frame) => handleIncomingAwarenessFrame(frame),
      (frame) => handleIncomingMigrationPullFrame(frame),
    ],
  });
}

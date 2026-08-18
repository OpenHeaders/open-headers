/**
 * Product-telemetry beacons for the desktop's sync plane — the twin of
 * the extension SW's `bootstrap/product-telemetry-beacons.ts`, mapping
 * the same host-neutral observability seams onto the vocabulary's typed
 * events (the telemetry plan §3): the `workspace-sync` feature signal
 * on a wire connect, plus the typed error codes. The oracle modules
 * stay telemetry-free; this is the desktop's one place that maps their
 * signals onto product-telemetry events. The controller's session latch
 * keeps each feature/code to once per process session.
 *
 *   - push: a pending-out enqueue that threw, or a flush that died
 *     mid-drain (`sync-push-failed`) — routine queueing while
 *     disconnected never fires.
 *   - pull: a scope catch-up ending `failed` / `timed-out`
 *     (`sync-pull-failed`).
 *
 * `ws-connect-failed` is wired where the connection manager is
 * installed (`install-backend-client.ts`).
 */

import type { TelemetryEvent } from '@openheaders/core/telemetry';
import { subscribeOnWebSocketOpen } from '@openheaders/oracle/sync/client/backend-connection-manager';
import type { SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';
import { setOutboundSyncFailureObserver } from '@openheaders/oracle/sync/client/mutation-forwarder';

export function installProductTelemetrySyncBeacons(
  syncWiring: SyncWiring,
  track: (event: TelemetryEvent) => void,
): void {
  // A backend wire actually connecting is workspace sync in use — the
  // feature_used signal for the sync plane (once per session via latch).
  subscribeOnWebSocketOpen(() => {
    track({ name: 'feature_used', feature: 'workspace-sync' });
  });

  setOutboundSyncFailureObserver(() => {
    track({ name: 'error_beacon', code: 'sync-push-failed' });
  });

  const unsubscribers = new Map<string, () => void>();
  syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
      unsubscribers.set(
        event.backendId,
        event.handles.initiator.subscribe((state) => {
          if (state === 'failed' || state === 'timed-out') {
            track({ name: 'error_beacon', code: 'sync-pull-failed' });
          }
        }),
      );
      return;
    }
    unsubscribers.get(event.backendId)?.();
    unsubscribers.delete(event.backendId);
  });
}

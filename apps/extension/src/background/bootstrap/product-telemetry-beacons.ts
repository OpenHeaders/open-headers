/**
 * Product-telemetry beacons for the sync plane — wires the
 * host-neutral observability seams to the vocabulary's typed events
 * (`TELEMETRY_PLAN.md` §3): the `workspace-sync` feature signal on a
 * wire connect, plus the typed error codes. The oracle modules stay
 * telemetry-free; this is the extension's one place that maps their
 * signals onto product-telemetry events. The controller's session
 * latch keeps each feature/code to once per browser session.
 *
 *   - push: a pending-out enqueue that threw, or a flush that died
 *     mid-drain (`sync-push-failed`) — routine queueing while
 *     disconnected never fires.
 *   - pull: a scope catch-up ending `failed` / `timed-out`
 *     (`sync-pull-failed`).
 *
 * `ws-connect-failed` is wired where the connection manager is
 * installed (`websocket.ts`).
 */

import { subscribeOnWebSocketOpen } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { setOutboundSyncFailureObserver } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { trackProductTelemetryEvent } from '../modules/product-telemetry';
import type { SyncWiring } from './ws-frame-routing';

export function installProductTelemetrySyncBeacons(syncWiring: SyncWiring): void {
  // A backend wire actually connecting is workspace sync in use — the
  // feature_used signal for the sync plane (once per session via latch).
  subscribeOnWebSocketOpen(() => {
    trackProductTelemetryEvent({ name: 'feature_used', feature: 'workspace-sync' });
  });

  setOutboundSyncFailureObserver(() => {
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'sync-push-failed' });
  });

  const unsubscribers = new Map<string, () => void>();
  syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
      unsubscribers.set(
        event.backendId,
        event.handles.initiator.subscribe((state) => {
          if (state === 'failed' || state === 'timed-out') {
            trackProductTelemetryEvent({ name: 'error_beacon', code: 'sync-pull-failed' });
          }
        }),
      );
      return;
    }
    unsubscribers.get(event.backendId)?.();
    unsubscribers.delete(event.backendId);
  });
}

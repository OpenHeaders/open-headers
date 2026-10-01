/**
 * The per-backend status feed behind the Sync page's connection rows,
 * host-neutral: every host that joins backends through the client
 * plane installs it once over its sync wiring and its local broadcast.
 *
 *   - The handshake-phase reporter per wire (Handshaking / Catching up
 *     / Synced / rejected with the server's reason / timed out /
 *     failed) — installed on each coordinator's creation, removed with
 *     it — writes the same per-backend slot the connection manager's
 *     wire-level reporter writes, so the two keep their last-write
 *     semantics within one backend while the aggregate rolls worst-of
 *     across backends. Wire-level stays authoritative for the
 *     disconnected / connecting / auto-connect-off states.
 *   - Every slot change (a report or a drop) fans out as ONE
 *     `backendSyncStatusUpdated` broadcast to the host's surfaces —
 *     the feed `useBackendSyncStatus` mirrors beside its one
 *     `getBackendSyncStatusSnapshot` read at mount, which the host
 *     answers from {@link getBackendSyncStatusSnapshot}.
 *
 * The extension's worker and the desktop's main process compose over
 * it (the desktop's renderer reads the feed over its bridge exactly as
 * the extension's pages do); the served tab keeps its one fixed slot.
 */

import type { BackendSyncStatusSnapshot } from '@openheaders/core/types';
import type { SyncWiring } from './backend-sync-plane';
import { reportBackendSyncStatus, subscribeBackendSyncStatus } from './sync-status-aggregate';
import { installHandshakeStatusReporter } from './sync-status-reporter';

export interface BackendStatusReportersDeps {
  readonly syncWiring: Pick<SyncWiring, 'subscribeHandshakeLifecycle'>;
  /** The host's fan-out to its own surfaces — the typed broadcast contract's `backendSyncStatusUpdated`. */
  readonly broadcast: (type: 'backendSyncStatusUpdated', snapshot: BackendSyncStatusSnapshot) => void;
}

/** Install both legs; returns the uninstall (every per-wire reporter and the slot subscription). */
export function installBackendStatusReporters(deps: BackendStatusReportersDeps): () => void {
  const unsubscribers = new Map<string, () => void>();
  const unsubscribeLifecycle = deps.syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
      unsubscribers.get(event.backendId)?.();
      unsubscribers.set(
        event.backendId,
        installHandshakeStatusReporter({
          initiator: event.handles.initiator,
          report: (entry) => reportBackendSyncStatus(event.backendId, entry),
        }),
      );
      return;
    }
    unsubscribers.get(event.backendId)?.();
    unsubscribers.delete(event.backendId);
  });

  const unsubscribeSlots = subscribeBackendSyncStatus((snapshot) => {
    deps.broadcast('backendSyncStatusUpdated', snapshot);
  });

  return () => {
    unsubscribeLifecycle();
    unsubscribeSlots();
    for (const unsubscribe of unsubscribers.values()) unsubscribe();
    unsubscribers.clear();
  };
}

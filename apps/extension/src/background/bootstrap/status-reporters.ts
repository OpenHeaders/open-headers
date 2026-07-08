import { report as reportStatus, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { broadcast } from '@utils/bridge';
import { installActivityStatusReporter } from '../activity-status-reporter';
import { onActiveWorkspaceChange, peekActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { countUnreadActivityEntries, subscribeActivityEntries } from '../sync-activity-installer';
import { reportBackendSyncStatus } from '../sync-status-aggregate';
import { installHandshakeStatusReporter } from '../sync-status-reporter';
import type { SyncWiring } from './ws-frame-routing';

interface InstallStatusReportersOpts {
  syncWiring: SyncWiring;
}

export function installStatusReporters({ syncWiring }: InstallStatusReportersOpts): void {
  // Handshake phase overrides the wire-level "Connected to back-end" once
  // HELLO is in flight — per connection, into the same per-backend slot
  // the connection manager's wire-level reporter writes, so the two keep
  // their temporal last-write semantics within one backend while the
  // aggregate rolls worst-of across backends. Wire-level stays
  // authoritative for disconnected / connecting / in-browser states.
  const unsubscribers = new Map<string, () => void>();
  syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
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

  installActivityStatusReporter({
    report: (entry) =>
      reportStatus({
        subsystem: 'activity',
        state: entry.state,
        message: entry.message,
        context: entry.context,
      }),
    subscribeActivityEntries,
    countUnread: countUnreadActivityEntries,
    getActiveWorkspaceId: () => peekActiveWorkspaceId(),
    subscribeActiveWorkspace: (listener) => onActiveWorkspaceChange(listener),
  });

  subscribeStatus((snapshot) => {
    broadcast('statusUpdated', snapshot);
  });
}

import { report as reportStatus, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { broadcast } from '@utils/bridge';
import { installActivityStatusReporter } from '../activity-status-reporter';
import { onActiveWorkspaceChange, peekActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { countUnreadActivityEntries, subscribeActivityEntries } from '../sync-activity-installer';
import { installHandshakeStatusReporter } from '../sync-status-reporter';
import type { SyncHandshakeHandles } from './sync-handshake';

interface InstallStatusReportersOpts {
  handshake: SyncHandshakeHandles;
}

export function installStatusReporters({ handshake }: InstallStatusReportersOpts): void {
  // Handshake phase overrides the wire-level "Connected to back-end" once
  // HELLO is in flight. Wire-level stays authoritative for
  // disconnected / connecting / in-browser states.
  installHandshakeStatusReporter({
    initiator: handshake.initiator,
    report: (entry) =>
      reportStatus({
        subsystem: 'sync',
        state: entry.state,
        message: entry.message,
        context: entry.context,
      }),
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

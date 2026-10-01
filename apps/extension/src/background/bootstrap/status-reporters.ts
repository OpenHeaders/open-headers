import { installBackendStatusReporters } from '@openheaders/oracle/sync/client/backend-status-reporters';
import { report as reportStatus, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { broadcast } from '@utils/bridge';
import { installActivityStatusReporter } from '../activity-status-reporter';
import { onActiveWorkspaceChange, peekActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { countUnreadActivityEntries, subscribeActivityEntries } from '../sync-activity-installer';
import type { SyncWiring } from './ws-frame-routing';

interface InstallStatusReportersOpts {
  syncWiring: SyncWiring;
}

export function installStatusReporters({ syncWiring }: InstallStatusReportersOpts): void {
  // The per-backend feed — the handshake-phase reporter per wire into
  // the same slot the connection manager's wire-level reporter writes,
  // and every slot change fanned out as `backendSyncStatusUpdated` —
  // is the shared installer every client-plane host composes over.
  installBackendStatusReporters({ syncWiring, broadcast });

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

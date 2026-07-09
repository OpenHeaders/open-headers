/**
 * Extension install of the shared per-backend status aggregate
 * (`@openheaders/oracle/sync/client/sync-status-aggregate`): the
 * roll-up sink writes the `sync` Status subsystem, with the extension's
 * tier-zero copy for the zero-backend case. Call sites keep importing
 * the aggregate API through this module.
 */
import {
  type SyncStatusRollupSink,
  setSyncStatusRollupSink,
} from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { report as reportStatus } from '@openheaders/ui/shared/status';

export {
  __resetSyncStatusAggregateForTests,
  dropBackendSyncStatus,
  getBackendSyncStatusSnapshot,
  refreshSyncStatusAggregate,
  reportBackendSyncStatus,
  subscribeBackendSyncStatus,
} from '@openheaders/oracle/sync/client/sync-status-aggregate';

const rollupSink: SyncStatusRollupSink = (entry) => {
  if (!entry) {
    reportStatus({ subsystem: 'sync', state: 'green', message: 'Running in this browser' });
    return;
  }
  reportStatus({ subsystem: 'sync', state: entry.state, message: entry.message, context: entry.context });
};

setSyncStatusRollupSink(rollupSink);

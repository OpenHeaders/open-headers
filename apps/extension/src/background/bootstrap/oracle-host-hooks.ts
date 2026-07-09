import { disposeResolverStateForWorkspace } from '@openheaders/oracle/rule-engine/variables-resolver';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { forwardMutationToBackend } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { broadcast } from '@utils/bridge';
import { forwardAwarenessToBackend } from '../awareness-forwarder';
import { getRulesPaused } from '../dnr-manager';
import { recordLog } from '../modules/observability-log';
import { scheduleUpdate as scheduleRuleEngineUpdate } from '../modules/rules/rule-engine';
import { seedFromWorkspaceSwitch } from '../modules/rules/rule-state-observer';
import { getCachedTotpCodes } from '../modules/totp-scheduler';
import { getActiveWorkspaceId, peekActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { observeForActivityFeed } from '../sync-activity-installer';

// Installs the oracle's host-callback port. Must run before bootSyncEngine
// so the first envelope finds the hooks populated.
export function installOracleHostHooks(): void {
  setOracleHostHooks({
    recordLog,
    scheduleRuleEngineUpdate: (reason, opts) =>
      scheduleRuleEngineUpdate(reason, { immediate: opts?.immediate ?? false }),
    disposeResolverStateForWorkspace,
    broadcastSyncEvent: (event) => {
      broadcast('syncBroadcast', event);
      forwardMutationToBackend(event);
      observeForActivityFeed(event);
    },
    broadcastAwareness: (event) => {
      broadcast('awarenessBroadcast', event);
      forwardAwarenessToBackend(event);
    },
    reportStatus: (entry) =>
      reportStatus({
        subsystem: entry.subsystem as Parameters<typeof reportStatus>[0]['subsystem'],
        state: entry.state,
        message: entry.message,
        context: entry.context,
      }),
    getActiveWorkspaceId,
    peekActiveWorkspaceId,
    getCachedTotpCodes,
    onWorkspaceSwitched: (nextRules, pauseMarkers) => {
      seedFromWorkspaceSwitch(nextRules, pauseMarkers, getRulesPaused());
    },
  });
}

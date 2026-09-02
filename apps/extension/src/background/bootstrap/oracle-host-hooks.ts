import { onDeviceFlowChange } from '@openheaders/oracle/live/request-exec/oauth-device';
import { disposeResolverStateForWorkspace } from '@openheaders/oracle/rule-engine/variables-resolver';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { forwardAwarenessToBackend } from '@openheaders/oracle/sync/client/awareness-forwarder';
import { forwardMutationToBackend } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { broadcast } from '@utils/bridge';
import { getRulesPaused } from '../dnr-manager';
import { recordLog } from '../modules/observability-log';
import { scheduleUpdate as scheduleRuleEngineUpdate } from '../modules/rules/rule-engine';
import { seedFromWorkspaceSwitch } from '../modules/rules/rule-state-observer';
import { getCachedTotpCodes } from '../modules/totp-scheduler';
import { getActiveWorkspaceId, peekActiveWorkspaceId } from '../modules/workspace/workspace-store';
import { observeForActivityFeed } from '../sync-activity-installer';
import { isBackgroundReady } from './background-ready';

// Installs the oracle's host-callback port. Must run before bootSyncEngine
// so the first envelope finds the hooks populated.
export function installOracleHostHooks(): void {
  // The OAuth device grant's poll runs in the oracle's registry (over
  // the browser transport); its transitions reach the editor here.
  onDeviceFlowChange((change) => {
    broadcast('oauthDeviceState', {
      ...(change.workspaceId !== undefined ? { workspaceId: change.workspaceId } : {}),
      credentialRef: change.credentialRef,
      state: change.state,
    });
  });
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
      forwardAwarenessToBackend(event, 'extension');
    },
    // Evictions mint no envelope (workspace-eviction.ts), so renderer
    // mirrors get this explicit signal instead of a syncBroadcast.
    broadcastWorkspaceEvicted: (workspaceId) => {
      broadcast('workspaceEvicted', { workspaceId });
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
    isSnapshotPlaneReady: isBackgroundReady,
    getCachedTotpCodes,
    onWorkspaceSwitched: (nextRules, pausedUids) => {
      seedFromWorkspaceSwitch(nextRules, pausedUids, getRulesPaused());
    },
  });
}

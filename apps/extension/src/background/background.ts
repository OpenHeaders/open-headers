/**
 * Main background service worker — minimal orchestrator.
 *
 * Rule update ownership is centralized in rule-engine.ts. Rule / collection
 * / template data is owned entirely by the extension; per-workspace stores
 * in `modules/` are the single source of truth. Team workspaces synced
 * from the desktop app land in v2 through `workspace-orchestrator.ts`.
 */

declare const browser: typeof chrome | undefined;

import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-lifeline-server';
import {
  consumedOrgIds,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  setAuditSink,
} from '@openheaders/core/identity';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  invalidateAllWorkspaceOrgCache,
  setWorkspaceOrgResolver,
} from '@openheaders/core/sync';
import type { Rule, TreeNode } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { isRuleEffective } from '@openheaders/core/utils';
import {
  getActiveEnvironmentId,
  getCollectionEnvOverrides,
  getDefaultEnvironmentId,
  getEnvironments,
  getManualEnvId,
  getVault,
  getWorkspaceVariables,
  onEnvironmentStoreChange,
} from '@openheaders/oracle/entity/environment-store';
import { listFiles, onFilesStoreChange } from '@openheaders/oracle/entity/files-store';
import { IdbAuditLog } from '@openheaders/oracle/sync';
import { report as reportStatus, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { alarms, isChrome, isEdge, isFirefox, isSafari, runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { bootstrapSettings } from '@utils/settings-bootstrap';
import {
  forgetDelayBypassForTab,
  getRulesPaused,
  markTabForDelayBypass,
  resolveDelayBypass,
  setRulesPaused,
} from './dnr-manager';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import { forgetCacheBypassForTab, rehydrateCacheBypassFromSessionRules } from './modules/cache-bypass';
import { setupDevtoolsInspectorPorts } from './modules/devtools-inspector-port';
// Module-load side effect: registers `liveChainAdapter` with the live
// scheduler via `__setLiveRefreshAdapter`. Import for its side effect
// even though we don't name anything from it here — the scheduler's
// adapter port is filled at eval time so the first alarm fires
// against a real chain runner rather than the Phase-C stub.
import './modules/live-chain-adapter';
import { setLockObserver } from '@openheaders/oracle/coordination';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { onLiveCacheStoreChange } from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables, onLiveVariableStoreChange } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows, onLiveWorkflowStoreChange } from '@openheaders/oracle/live/live-workflow-store';
import { disposeResolverStateForWorkspace } from '@openheaders/oracle/rule-engine/variables-resolver';
import {
  applyWorkspaceSnapshot,
  readWorkspaceStateVector,
  setActivityMuteStore,
  setOracleHostHooks,
  setOutboundEchoGuard,
  subscribeActivityMuteChanges,
} from '@openheaders/oracle/sync';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { getSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import {
  handleActivityPruneAlarm,
  installActivityPruneScheduler,
  isActivityPruneAlarm,
} from './activity-prune-scheduler';
import { installActivityStatusReporter } from './activity-status-reporter';
import { forwardAwarenessToBackend, forwardCurrentAwarenessOnConnect } from './awareness-forwarder';
import { handleIncomingAwarenessFrame } from './awareness-receiver';
import { installBackupWriter } from './install-backup-writer';
import {
  countUnreadActivityEntries,
  observeForActivityFeed,
  setActivityLog,
  subscribeActivityEntries,
} from './sync-activity-installer';
import { createSyncHandshakeInitiator } from './sync-handshake-initiator';
import {
  applyPeerStateVectorToPendingOut,
  flushPendingOutToBackend,
  forwardMutationToBackend,
  setPendingOutQueue,
} from './sync-mutation-forwarder';
import { handleIncomingMutationFrame, hasRecentlyApplied } from './sync-mutation-receiver';
import { installHandshakeStatusReporter } from './sync-status-reporter';
import { registerInboundFrameHandler, subscribeOnWebSocketClose, subscribeOnWebSocketOpen } from './websocket';

// Don't bounce envelopes that arrived from the backend back to it.
// The receiver records every applied mutationId; the outbound gate's
// echo layer skips re-broadcasting any envelope already in that set.
// Pairs with the receiver's own seen-set dedup — together they break
// the echo loop.
setOutboundEchoGuard(hasRecentlyApplied);

// Persistent pending-out queue (C13) so offline edits survive the
// disconnect window. Drained on WS reconnect (C15) in HLC order;
// wire-side dedup (C11) makes the replay safe even if the backend
// already saw the envelope before the disconnect.
const pendingOutQueue = getSyncPersistenceProvider().createPendingOutQueue?.() ?? null;
setPendingOutQueue(pendingOutQueue);

// Activity Feed (F1/F2): every inbound envelope the bridge applies
// flows through the classifier and lands in the per-workspace
// activity log. Writes are fire-and-forget; apply latency is
// unaffected by IDB latency.
const activityLog = getSyncPersistenceProvider().createActivityLog?.() ?? null;
setActivityLog(activityLog);

// F7 — auto-decay sweep. A single recurring chrome.alarms tick prunes
// every resident workspace down to the 7-day retention window. Alarms
// survive SW eviction so the log can't grow unbounded across long
// idle stretches; the handler iterates `listWorkspaces()` so workspaces
// added or removed after install are picked up by the next tick.
installActivityPruneScheduler({
  getLog: () => activityLog,
  listWorkspaceIds: () => listWorkspaces().map((ws) => ws.id),
});

// F6.b — the per-entity mute store gates the classifier so muted
// entities never reach the log or the unread badge. The cache module
// is the runtime source of truth; the persisted store rehydrates it
// per workspace lazily on first observation.
setActivityMuteStore(getSyncPersistenceProvider().createActivityMuteStore?.() ?? null);

// M5 — mode-switch Discard backup-writer. The orchestrator builds the
// archive and asks the host to put it on disk; the SW writes via
// chrome.downloads. Without this the orchestrator returns
// `backup-writer-unavailable` and the dialog warns the user.
installBackupWriter();

// U5.9 "join → adopt" — the backend's active workspace id from the
// WELCOME, held until that workspace has synced down. The handshake
// fires before the joined Org's workspaces arrive, so adoption is
// deferred to the next `onWorkspaceStoreChange` once the target exists.
let pendingAdoptWorkspaceId: string | null = null;

function tryAdoptPendingWorkspace(): void {
  if (!pendingAdoptWorkspaceId) return;
  if (!getWorkspace(pendingAdoptWorkspaceId)) return; // not synced down yet
  const id = pendingAdoptWorkspaceId;
  pendingAdoptWorkspaceId = null;
  void setActiveWorkspaceById(id).catch((err: unknown) => {
    logger.warn('Background', 'join → adopt: could not promote the backend workspace to active', err);
  });
}

// Sync handshake — Phase C / U6.3. On every WS connect the initiator
// runs the connection handshake (HELLO/WELCOME); once connected it
// catches up the `__global__` workspace-list scope. On each scope's
// SYNCED it prunes pending-out against the peer's post-catch-up vector
// + flushes what remains. The WS-open flush (immediately below) is a
// defensive fallback for the legacy `browserInfo` path where SYNCED
// never fires.
const syncHandshakeInitiator = createSyncHandshakeInitiator({
  send: (frame) => sendViaWebSocket(frame as Record<string, unknown>),
  getActiveWorkspaceId: () => peekActiveWorkspaceId(),
  getExtensionNodeId: (workspaceId) => {
    const svc = getOrCreateWorkspaceService(workspaceId);
    try {
      return svc.context.nodeId;
    } finally {
      releaseWorkspaceService(workspaceId);
    }
  },
  getExtensionAgent: () => `@openheaders/extension@${runtime.getManifest().version}`,
  // U3.2 — send the user-pasted daemon auth token on every HELLO so
  // daemons bound non-loopback can validate the peer. Empty string is
  // treated as "no token configured" so loopback peers (the default)
  // don't carry a useless field.
  getAuthToken: () => {
    const raw = getSetting('backend.authToken');
    return raw && raw.length > 0 ? raw : null;
  },
  readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
  // U6.4 — after the `__global__` scope syncs the backend's workspace
  // list down, enumerate the workspaces under a consumed Org so the
  // coordinator can fan a per-workspace catch-up out for each. The
  // adopted active workspace (U6.6) is sequenced first so a mid-fan-out
  // SW death still leaves the user on a synced workspace.
  listConsumedWorkspaceIds: () => {
    const consumed = consumedOrgIds(getIdentitySnapshot());
    if (consumed.size === 0) return [];
    const ids = listWorkspaces()
      .filter((ws) => consumed.has(ws.orgId))
      .map((ws) => ws.id);
    if (pendingAdoptWorkspaceId && ids.includes(pendingAdoptWorkspaceId)) {
      const adopt = pendingAdoptWorkspaceId;
      return [adopt, ...ids.filter((id) => id !== adopt)];
    }
    return ids;
  },
  applySnapshot: async (snapshot) => {
    const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
    try {
      await svc.hydrated;
      await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
    } finally {
      releaseWorkspaceService(snapshot.workspaceId);
    }
  },
  onSynced: async (_scope, peerVector) => {
    await applyPeerStateVectorToPendingOut(peerVector);
    await flushPendingOutToBackend();
    // U6.6 — a consumed workspace's data may have just landed via the
    // U6.4 fan-out. Promote the deferred adopt target now that it
    // exists locally; idempotent + no-op until the target syncs down.
    tryAdoptPendingWorkspace();
    // Awareness is ephemeral; only flows on local publish events. On
    // a fresh connect the peer has no view of our presence until the
    // next local surface activity — push the current snapshot now
    // that the handshake is past so the desktop folds extension
    // surfaces into its store immediately.
    forwardCurrentAwarenessOnConnect();
  },
  onRejected: (reason, detail) => {
    logger.warn('Background', `sync handshake rejected: ${reason}${detail ? ` — ${detail}` : ''}`);
  },
  // U5.2 — connecting to a backend is consume-first: record the
  // backend's home Org so its workspaces sync down through the existing
  // `authorizedOrgIds` filter. This host's own workspaces are never
  // pushed up — the receiver-side org filter on the backend enforces
  // that structurally.
  onJoinedOrg: async (org, backendActiveWorkspaceId) => {
    await recordJoinedOrg(org);
    // U5.9 — joining is consume-only: adopt the backend by promoting its
    // active workspace to globally active once it has synced down (see
    // `tryAdoptPendingWorkspace`). The active Org is derived from the
    // active workspace, so adopting the workspace adopts the Org too.
    if (backendActiveWorkspaceId) {
      pendingAdoptWorkspaceId = backendActiveWorkspaceId;
      tryAdoptPendingWorkspace();
    }
    logger.info('Background', `joined backend Org ${org.id} — its workspaces will sync down`);
  },
});

// Inbound frame routing — handshake initiator first (claims HELLO-flow
// types), mutation receiver second (claims oh.sync.mutation /
// oh.sync.mutationBatch). Anything unclaimed (e.g. the pre-handshake
// `pong`) drops silently.
registerInboundFrameHandler(async (frame) => {
  if (!syncHandshakeInitiator.handles(frame)) return false;
  await syncHandshakeInitiator.handle(frame);
  return true;
});
registerInboundFrameHandler(handleIncomingMutationFrame);
registerInboundFrameHandler(handleIncomingAwarenessFrame);

subscribeOnWebSocketOpen(() => {
  void syncHandshakeInitiator.start();
});
subscribeOnWebSocketClose(() => {
  syncHandshakeInitiator.reset();
});

// Status pill — handshake phase overrides the wire-level reporter's
// "Connected to back-end" once HELLO is in flight. Wire-level writes
// stay authoritative for the disconnected / connecting / in-browser
// states (websocket.ts owns those).
installHandshakeStatusReporter({
  initiator: syncHandshakeInitiator,
  report: (entry) =>
    reportStatus({
      subsystem: 'sync',
      state: entry.state,
      message: entry.message,
      context: entry.context,
    }),
});

// Activity Feed pill — F3. Pulses yellow with an unread count whenever
// inbound mutations land for the active workspace; baselines on every
// active-workspace switch so the badge reflects "this workspace's
// pending activity" only.
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

// F5 — live tail for the Activity Feed panel. Each classified entry
// the installer produces is also pushed onto the renderer bridge so
// the panel can prepend without re-fetching. The status reporter
// reads from the same source via its own subscription.
subscribeActivityEntries((entry) => {
  broadcast('activityEntry', entry);
});

// F6.b — every mute/unmute the host cache observes fans out as a
// renderer-side broadcast so open panels keep their muted-state badges
// in lockstep without polling the RPC.
subscribeActivityMuteChanges((change) => {
  broadcast('activityMuteChanged', change);
});

import {
  handleLiveAlarm,
  isLiveRefreshAlarm,
  kickActiveContextRefresh,
  reconcileLiveSchedules,
  refreshLiveWorkflowSynchronously,
  startLiveScheduler,
} from './modules/live-refresh-scheduler';
import { handleGeneralMessage } from './modules/message-handler';
import {
  handleOAuthAlarm,
  isOAuthRefreshAlarm,
  reconcileOAuthSchedules,
  startOAuthScheduler,
} from './modules/oauth-refresh-scheduler';
import { hydrateObservabilityLog, recordLog } from './modules/observability-log';
import { scheduleUpdate as scheduleRuleEngineUpdate } from './modules/rule-engine';

// Wire the lock subsystem's observer to the host observability ring.
// Done at module-load so any pre-init `withLock` call still routes
// events to the buffered (pre-hydration) ring.
setLockObserver(recordLog);

// Wire the oracle's host-callbacks (log recorder, rule-engine notifier,
// resolver-state disposer). Module-load so the sync service can fire
// these the moment the first envelope arrives — no init ordering risk.
setOracleHostHooks({
  recordLog,
  scheduleRuleEngineUpdate: (reason, opts) => scheduleRuleEngineUpdate(reason, { immediate: opts?.immediate ?? false }),
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

import { getPauseMarkers } from '@openheaders/oracle/entity/pause-markers-store';
import { applyExternalSnapshot as applyRequestScriptsReviewSnapshot } from '@openheaders/oracle/entity/request-scripts-review-store';
import { getRequests, onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
import { getCollectionTrees, getRules, onStoreChange } from '@openheaders/oracle/entity/rule-store';
import { getTemplates, onTemplateStoreChange } from '@openheaders/oracle/entity/template-store';
import {
  __setSyncWarmRunner,
  getUnresolvableRuleUids,
  hydrateLiveCacheMirror,
} from '@openheaders/oracle/rule-engine/variables-resolver';
import { markBootPhase } from '@openheaders/oracle/sync/boot-telemetry';
import { pruneOrphanOwners } from '@openheaders/oracle/test-run/test-run-store';
import { setupOnRuleMatchedDebugBridge } from './modules/on-rule-matched-debug';
import { auditHostPermissions } from './modules/permissions-audit';
import { setupRequestMonitoring } from './modules/request-monitor';
import {
  getActiveRulesForTab,
  precompileRulePatterns,
  rehydrateTabTracking,
  restoreTrackingState,
  revalidateTrackedRequests,
} from './modules/request-tracker';
import { scheduleUpdate } from './modules/rule-engine';
import {
  rehydrateFromStorage as rehydrateObserverFromStorage,
  seedFromWorkspaceSwitch,
} from './modules/rule-state-observer';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { setupTestRunnerPorts } from './modules/test-runner';
import { bootstrapTotpScheduler, getCachedTotpCodes, handleTotpAlarm, isTotpAlarm } from './modules/totp-scheduler';
import { initializeViewMode } from './modules/view-mode';
import { isHandoffSweepAlarm, sweepExpiredHandoffs } from './modules/workspace-export-handoff-store';
import { hydrateActiveWorkspaceStores } from './modules/workspace-orchestrator';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
  onActiveWorkspaceChange,
  onWorkspaceStoreChange,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from './modules/workspace-store';
import { setupWorkspaceTabRegistry } from './modules/workspace-tab-registry';
import {
  connectWebSocket,
  getReconnectAttempts,
  isWebSocketConnected,
  isWebSocketConnecting,
  sendViaWebSocket,
  shouldAttemptBackendConnection,
} from './websocket';

// Workspace list must be bootstrapped first — every per-workspace store
// keys its reads off the active workspace id. Settings + per-workspace
// hydration chain off this promise.
const workspacesReady = bootstrapWorkspaces();

// Settings must be loaded before anything touches the rule engine — the
// first compile reads persisted `rulesEngine.paused`, `maxActiveRules`,
// `evaluationStrategy`, etc., and would otherwise race the async load.
const settingsReady = workspacesReady.then(bootstrapSettings).then(() => {
  markBootPhase('settings-ready');
  setRulesPaused(getSetting('rulesEngine.paused'));
  subscribeKey('rulesEngine.paused', () => {
    setRulesPaused(getSetting('rulesEngine.paused'));
    scheduleUpdate('pause', { immediate: true });
    debouncedUpdateBadge();
  });
  // Engine knobs that affect the DNR compile force a full rebuild so
  // changes go live immediately.
  const rebuildOnPrefChange = (): void => scheduleUpdate('prefs', { immediate: true });
  subscribeKey('rulesEngine.maxActiveRules', rebuildOnPrefChange);
  subscribeKey('rulesEngine.evaluationStrategy', rebuildOnPrefChange);
});

/**
 * Compute the live rule + entity (folder/collection) id sets and ask the
 * test-run store to drop any owner bucket whose target is gone. Called
 * after every rule-store change so deletions cascade-clean orphan
 * test-run buckets.
 */
function pruneOrphanTestRunOwnersFromStore(): void {
  const liveRules = new Set<string>();
  const liveEntities = new Set<string>();
  for (const r of getRules()) liveRules.add(r.uid);
  for (const c of getCollectionTrees()) {
    liveEntities.add(c.uid);
    const walk = (nodes: TreeNode[]): void => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          liveEntities.add(n.uid);
          walk(n.children);
        }
      }
    };
    walk(c.tree);
  }
  void pruneOrphanOwners(liveRules, liveEntities);
}

// ── Badge update ──────────────────────────────────────────────────

async function updateBadgeForCurrentTab(): Promise<void> {
  const isConnected = isWebSocketConnected();
  const attempts = getReconnectAttempts();
  const isPaused = getSetting('rulesEngine.paused');

  tabs.query({ active: true, currentWindow: true }, async (tabList: chrome.tabs.Tab[]) => {
    const currentTab = tabList[0];

    const markers = getPauseMarkers();
    // Currently-effective rules: enabled + complete + not paused at any
    // level + engine not paused + refs resolve — the single canonical
    // filter that every consumer (DNR compile loop, rule-state
    // observer, this badge filter) must share. NOT filtered by tab
    // URL: a rule targeting a subresource domain (e.g.
    // api.example.com) still counts when the tab is on example.com —
    // its counter increments via the subresource request.
    //
    // `getUnresolvableRuleUids` mirrors the DNR compile's hard gate:
    // rules with unresolved `{{ref}}`s aren't shipped to Chrome, so
    // they shouldn't inflate the badge either.
    const unresolvable = getUnresolvableRuleUids();
    const effectiveRules = getRules().filter((r) => isRuleEffective(r, markers, isPaused) && !unresolvable.has(r.uid));
    const effectiveUids = new Set(effectiveRules.map((r) => r.uid));

    // Badge count = rules pointed at this tab with a concrete signal.
    // Delegates to the verdict engine for consistency with the popup:
    // anything the engine labels `firing`, `silent`, or `page` counts
    // (firing = action ran; silent = matched but cache-suppressed;
    // page = pattern matches the tab URL, will fire on next request).
    // `related` (sibling-domain heuristic) is excluded — it's too weak
    // a signal to turn into a badge number that reads "N rules active
    // on this page."
    let matchedRuleCount = 0;
    if (currentTab?.id != null && currentTab.url) {
      const { activeRules } = getActiveRulesForTab(currentTab.id, currentTab.url);
      for (const rule of activeRules) {
        if (!effectiveUids.has(rule.id)) continue;
        if (rule.verdict === 'firing' || rule.verdict === 'silent' || rule.verdict === 'page') {
          matchedRuleCount++;
        }
      }
    }
    await updateExtensionBadge({
      connected: isConnected,
      isPaused,
      reconnectAttempts: attempts,
      matchedRuleCount,
      configuredRuleCount: effectiveRules.length,
    });
  });
}

const debouncedUpdateBadge = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void updateBadgeForCurrentTab();
    }, 100);
  };
})();

// ── Initialization ────────────────────────────────────────────────

let extensionInitialized = false;
// Hydration barrier — resolves once `initializeExtension` finishes
// the first (real) init pass for this SW lifetime. The alarm
// dispatch below awaits this before routing live / OAuth / TOTP
// alarms so their handlers never read an empty in-memory store on
// SW cold wake (an overdue live-refresh alarm that fires before
// hydration would otherwise mis-identify the workflow as "deleted"
// and cancel the alarm permanently). Non-hydration-dependent alarms
// (updateBadge, wsReconnect) keep their fast path.
let resolveBackgroundReady: () => void = () => {};
const backgroundReady: Promise<void> = new Promise((resolve) => {
  resolveBackgroundReady = resolve;
});
async function initializeExtension(): Promise<void> {
  // All init paths must wait for the settings store so the first DNR
  // compile / websocket connect sees persisted values instead of defaults.
  await settingsReady;
  if (extensionInitialized) {
    if (shouldAttemptBackendConnection()) await connectWebSocket();
    return;
  }
  extensionInitialized = true;

  // U1.6 — materialize the synthetic identity-row tuple before any
  // privileged-path code runs (UNIFIED_ORACLE_MODEL.md §5.2 / §12 step 2).
  // Idempotent across SW cold-wakes; first-boot mints `host-install-id`
  // too. Browsers don't surface an OS username from the SW context, so
  // the synthetic User starts with the default `displayName: 'Local'`
  // and updates only via promotion (§5.4 step 1) — never touching
  // `User.id`. Failures here are best-effort: the resolver wire-up
  // (Phase U2) will fall back to ALLOW until the row tuple is present,
  // matching the spec's "synthetic rows resolve to ALLOW" contract.
  await ensureSyntheticIdentity().catch((err: unknown) => {
    logger.warn('Background', 'ensureSyntheticIdentity failed', err);
  });
  // U1.8 — every workspace owns an owner-role WRA for the synthetic
  // principal. `bootstrapWorkspaces` already resolved (it chains
  // ahead of `settingsReady`) so the workspace list is hydrated;
  // reconcile once here, then again on every workspace-store change
  // below to cover creates / deletes during the SW lifetime.
  await ensureWorkspaceRoleAssignments(listWorkspaces().map((w) => w.id)).catch((err: unknown) => {
    logger.warn('Background', 'ensureWorkspaceRoleAssignments failed', err);
  });
  // U2.1 — hydrate the in-memory identity snapshot the resolver reads
  // from (`getIdentitySnapshot()`). One refresh after both ensure-* runs
  // is enough; the workspace-store listener below repeats it on changes.
  await refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
    logger.warn('Background', 'refreshIdentitySnapshotFromHostStorage failed', err);
  });

  // U2.6 — install the workspaceId → orgId resolver consulted by every
  // envelope mint site (UNIFIED_ORACLE_MODEL.md §6.1). Per-workspace
  // mutations resolve through `workspace.orgId`; global-scope metadata
  // mutations ride the user's home-org channel per §6.5. The resolver
  // is invalidated on every workspace-store change (see listener below).
  setWorkspaceOrgResolver((workspaceId) => {
    const snapshot = getIdentitySnapshot();
    if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
      return snapshot?.user.homeOrgId;
    }
    return getWorkspace(workspaceId)?.orgId ?? snapshot?.user.homeOrgId;
  });

  // U2.4 — install the durable audit-log sink. Every capability decision
  // the resolver emits gets persisted into `oh.identity.audit` via the
  // `audit_counters`-keyed IDB pattern from UNIFIED_ORACLE_MODEL.md §9.5.
  // Failures during append are logged but never throw — audit must not
  // tear down the call chain it observes.
  const auditLog = new IdbAuditLog();
  setAuditSink((entry) => {
    void auditLog
      .append({
        orgId: entry.orgId,
        actorUserId: entry.actorUserId,
        capability: entry.capability,
        ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
        decision: entry.decision,
        occurredAt: entry.occurredAt,
      })
      .catch((err: unknown) => {
        logger.warn('Background', 'audit log append failed', err);
      });
  });

  // Pull the observability ring back into memory before subsystems
  // record their first post-wake events — a dropped startup window
  // would mean the user's bug report misses the events most likely
  // to have triggered the report.
  await hydrateObservabilityLog();
  recordLog({
    subsystem: 'extension',
    op: 'sw-init',
    level: 'info',
    message: 'Service worker initialized',
    context: {},
  });
  // Audit host permissions once on wake. Doesn't block init — if
  // permissions are narrowed, the Status pill flips red but rules
  // and requests still run on whatever hosts are still granted.
  void auditHostPermissions();

  // Broadcast Status snapshot changes so UI surfaces (workspace footer,
  // popup inline pill) can stay in lockstep with the SW without polling.
  subscribeStatus((snapshot) => {
    broadcast('statusUpdated', snapshot);
  });

  await updateExtensionBadge({
    connected: false,
    isPaused: false,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
  });
  setupRequestMonitoring(debouncedUpdateBadge);
  setupTabListeners(debouncedUpdateBadge);
  setupPeriodicCleanup();
  initializeActiveTabTracking();
  // Workspace tab ordinals must be live before the first intent
  // dispatch so the navigator's cold/warm logs can stamp `#<n>`.
  // The setup also runs a one-shot bootstrap against existing tabs
  // so ordinals repopulate after SW wake.
  setupWorkspaceTabRegistry();
  void initializeViewMode();
  setupInjectListener();
  setupDelayBypassCleanup();
  setupTestRunnerPorts();
  setupDevtoolsInspectorPorts();
  // Awareness lifeline ports + workspace-coord runner are attached
  // inside `bootSyncEngine` below.
  setupOnRuleMatchedDebugBridge();

  // Broadcast rule changes to all open extension pages (popup, workspace)
  // and prune any orphaned test-run owner buckets. The prune covers the
  // WebSocket-driven path where the desktop deletes rules/folders without
  // going through message-handler's local CRUD handlers.
  onStoreChange(() => {
    broadcast('rulesUpdated', { rules: getRules() });
    pruneOrphanTestRunOwnersFromStore();
  });

  // Broadcast template changes to all open extension pages
  onTemplateStoreChange(() => {
    broadcast('templatesUpdated', { templates: getTemplates() });
  });

  // Broadcast request changes — request-store doesn't feed DNR (requests
  // are executed ad-hoc via the runner), so no scheduleUpdate here.
  onRequestStoreChange(() => {
    broadcast('requestsUpdated', { requests: getRequests() });
  });

  // Broadcast workspace list changes (every metadata mutation —
  // create/rename/color/reorder, plus active-flip + delete). Cross-store
  // follow-up work (per-workspace store swap on active flip,
  // per-workspace data purge on removal) is driven by the
  // SWAP_PER_WORKSPACE_STORES + PURGE_WORKSPACE_DATA side-effect intents
  // emitted by the ExtensionWorkspace mutators; the `workspace-coord-
  // runner` registered below drains them and runs the orchestrator's
  // helpers + sync-engine reinit + bridge re-seeds. This listener stays
  // metadata-broadcast-only so renames don't pay the reinit cost.
  onWorkspaceStoreChange(() => {
    broadcast('workspaceChanged', {
      workspaces: listWorkspaces(),
      activeWorkspaceId: getActiveWorkspaceId(),
    });
    // U1.8 — keep the WRA list in lockstep with the live workspace
    // set. New workspaces get an owner-role WRA; deleted workspaces'
    // WRAs are pruned. Fire-and-forget — the next reconcile retries
    // on the next mutation if this one rejects.
    void ensureWorkspaceRoleAssignments(listWorkspaces().map((w) => w.id))
      .then(() => refreshIdentitySnapshotFromHostStorage())
      .catch((err: unknown) => {
        logger.warn('Background', 'ensureWorkspaceRoleAssignments reconcile failed', err);
      });
    // U2.6 — workspace metadata may have shifted (rename, reorder, or a
    // future orgId flip per §6.5). Drop the workspaceId → orgId cache so
    // the next envelope mint reads through.
    invalidateAllWorkspaceOrgCache();
    // U5.9 — a join's backend workspaces may have just synced down;
    // promote the pending adopt target if it has now landed.
    tryAdoptPendingWorkspace();
  });

  // Env / workspace vars / vault / active-env mutations drive DNR
  // recompilation — resolved rule values depend on every scope above.
  // One listener covers all four because environment-store fires
  // `onEnvironmentStoreChange` after every mutation. The broadcast lets
  // UI surfaces (TopBar selector, Inspector Variables panel, sidebar
  // Environments section) refresh without each subscribing to four
  // separate channels.
  onEnvironmentStoreChange(() => {
    scheduleUpdate('vars', { immediate: true });
    broadcast('environmentsChanged', {
      environments: getEnvironments(),
      activeEnvironmentId: getActiveEnvironmentId(),
      defaultEnvironmentId: getDefaultEnvironmentId(),
      workspaceVariables: getWorkspaceVariables(),
      vault: getVault(),
      collectionEnvOverrides: getCollectionEnvOverrides(),
      manualEnvId: getManualEnvId(),
    });
  });

  // Files (Phase 12.4b) — broadcast after every put / delete / purge
  // so sibling workspace tabs and the multipart body editor's file
  // picker see the new list immediately. `listFiles` reads IDB
  // (async) so we await before firing; the listener callback is
  // sync-void, so we kick a fire-and-forget async task here.
  onFilesStoreChange(() => {
    void (async () => {
      const files = await listFiles().catch(() => []);
      broadcast('filesChanged', { files });
    })();
  });

  // OAuth tokens (Phase 13) — renderer subscribes `wsKeys(ws).oauth` directly
  // (MWPT-FULL § 8.3.10); chrome.storage.local.onChanged is per-workspace correct
  // by construction, so no broadcast plumbing is required.

  // Live Variables + Workflows (Phase B) — broadcast after every
  // definition mutation so the sidebar + editors + rule-editor variable
  // picker stay in sync. Cache broadcasts carry the workflowUid so
  // consumers can filter to a single workflow's countdown without
  // re-reading every cached run.
  onLiveWorkflowStoreChange(() => {
    broadcast('liveWorkflowsChanged', { workflows: getLiveWorkflows() });
  });
  onLiveVariableStoreChange(() => {
    // LV name / enable / manualOverride changes flip what
    // `{{live.X}}` resolves to, so recompile DNR. The batch-by-hash
    // guard in `scheduleUpdate` no-ops when the emitted rule set is
    // unchanged — cheap on the no-referrers common case.
    scheduleUpdate('live-vars', { immediate: true });
    broadcast('liveVariablesChanged', { variables: getLiveVariables() });
  });
  onLiveCacheStoreChange((_workspaceId, workflowUid, _runs) => {
    // New cached captures land in the LiveRegistry on the next
    // compile. Rebuild now so DNR values follow the workflow's
    // refresh cadence (Phase C fires the alarm → Phase D adapter
    // writes captures → this listener rebuilds DNR → the user's
    // `Authorization: {{live.token}}` rule picks up the new token
    // within one debounce cycle). The resolver's own listener fires
    // earlier in this same synchronous loop and installs `runs` into
    // `cachedLiveRuns` before the rebuild below reads it, so the
    // compile always sees the post-write snapshot.
    scheduleUpdate('live-cache', { immediate: true });
    broadcast('liveCacheChanged', { workflowUid });
  });

  // Alarm-driven OAuth refresh (Phase 14 §20). Subscribe to store
  // changes BEFORE the first reconcile so a write that races init
  // doesn't miss rescheduling. Reconcile then walks every workspace's
  // tokens + (re)schedules alarms + clears orphans.
  startOAuthScheduler();
  void reconcileOAuthSchedules().catch((err: unknown) => {
    logger.warn('Background', 'OAuth scheduler reconcile failed', err);
  });

  // Alarm-driven Live Workflow refresh (Phase C — LIVE_VARIABLES_PLAN.md).
  // Same subscribe-then-reconcile pattern as OAuth. The refresh work
  // itself is delegated to an adapter installed by Phase D; until
  // that adapter lands, alarm firings record a `scheduler-not-ready`
  // error against the cache and the backoff widens — no hot-loop.
  startLiveScheduler();
  // Wire the sync-warm entry point into `variables-resolver` so the
  // DNR compile path's `kickSyncWarmRefreshes` blocks on workflow
  // refreshes for LVs with `requireFreshOnRuleBuild`. Kept here (not
  // as a module-load side-effect inside the scheduler) so unit tests
  // that mount the scheduler in isolation don't transitively load the
  // resolver's store subscriptions.
  __setSyncWarmRunner(refreshLiveWorkflowSynchronously);
  // Live scheduler reconcile is intentionally deferred until AFTER
  // `hydrateActiveWorkspaceStores` below — unlike the OAuth scheduler
  // (which reads tokens directly from chrome.storage on every call),
  // the live scheduler's `collectEntries` + `getByAlarm` read the
  // in-memory `live-workflow-store` / `live-variable-store` arrays
  // populated by hydration. Running reconcile before hydration
  // produces an empty desired-set and wipes every `live-refresh:*`
  // alarm as "orphan," silently breaking scheduled refreshes until
  // the user manually hits Refresh.

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  // Hydrate the active workspace's per-workspace stores from storage.
  await hydrateActiveWorkspaceStores();
  markBootPhase('hydration-done');

  // Host-neutral sync-engine boot sequence — init global service, seed
  // the extensionWorkspace oracle, setRuntimeActive, seed every
  // per-workspace bridge, ensure default template collection, attach the
  // workspace-coord runner + awareness lifeline ports. Same code path on
  // the desktop main process; lives in `@openheaders/oracle/host-runtime`.
  await bootSyncEngine();
  markBootPhase('sync-init-done');
  markBootPhase('bridge-done');
  // Release the hydration barrier — alarm handlers waiting on
  // `backgroundReady` can now safely read the in-memory workflow /
  // variable / rule stores. Fired here (rather than at end-of-init)
  // because every remaining init step (cache mirror, TOTP bootstrap,
  // observer rehydrate) either reads storage directly or isn't on
  // the alarm dispatch path.
  markBootPhase('interactive');
  resolveBackgroundReady();
  // Now that the live workflow / variable stores are populated, run
  // the first reconcile so every eligible workflow has an alarm for
  // its next fire-at. Also re-seeds alarms that were mistakenly
  // cleared by a prior SW boot that hit the pre-hydration race
  // (older builds). Fire-and-forget — failures log but don't stall
  // the rest of init; the store-change subscription installed by
  // `startLiveScheduler` will re-reconcile on the next mutation.
  void reconcileLiveSchedules().catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler reconcile failed', err);
  });
  // Opportunistic catch-up for stale workflows in the active context —
  // on a cold SW wake (laptop open after hours of sleep), reconcile
  // alone schedules the next alarm at `now + 30s` (MV3 alarm floor).
  // That's 30s of requests going out with a stale token. `kickActive
  // ContextRefresh` drives `refreshLiveWorkflowSynchronously` directly
  // for anything already-overdue, so the cache is repopulated within
  // one network round-trip of wake-up instead of waiting for the first
  // alarm tick. No-op when every workflow is still fresh (cadence math
  // inside the kick decides). Fire-and-forget; errors bubble into the
  // scheduler's normal failure log + backoff.
  void kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler wake-up catch-up failed', err);
  });
  // Warm the live-cache mirror used by `variables-resolver` so the
  // first DNR compile after wake resolves `{{live.X}}` against real
  // captures rather than an empty registry. The mirror auto-refreshes
  // via `onLiveCacheStoreChange` after this point.
  await hydrateLiveCacheMirror();
  // Bootstrap the TOTP scheduler — keeps a `TotpRegistry` mirror warm
  // so the DNR compile resolves `{{vault.X}}` for kind:'totp' entries
  // against current codes, and ticks the rule engine at each
  // window-flip so baked codes never go stale. Vault edits (add /
  // rotate / delete a TOTP entry) re-trigger refresh + reschedule
  // through the same internal `onEnvironmentStoreChange` listener.
  await bootstrapTotpScheduler(() => scheduleUpdate('totp', { immediate: true }));
  const restoredRules = getRules();
  // Rehydrate the rule-state-observer snapshot BEFORE the first
  // rebuildAll fires, so rule changes that happened while the SW was
  // terminated are diffed against the pre-sleep baseline instead of
  // hitting the first-run seeding skip.
  await rehydrateObserverFromStorage();
  await rehydrateCacheBypassFromSessionRules();
  // Rebuild the per-tab subresource map from the last SW lifetime so the
  // popup's "This Page" view doesn't lose cached-subresource attribution
  // across SW eviction cycles. Runs before `restoreTrackingState` so the
  // main-frame seeding doesn't clobber richer persisted state.
  await rehydrateTabTracking();
  let didInitialApply = false;
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
    didInitialApply = true;
  }

  if (shouldAttemptBackendConnection()) {
    await connectWebSocket();
  } else if (getSetting('backend.mode') === 'in-browser') {
    logger.info('Background', 'backend.mode = in-browser — service worker is the back-end, no wire to open');
  } else {
    logger.info('Background', 'backend.autoConnect is off — skipping initial connect');
  }

  // Fallback: when storage had no rules AND the WebSocket didn't connect,
  // flush any stale DNR state from a previous run so we don't leak rules
  // across sessions. Skipped if the hydrate path already applied an
  // initial snapshot — otherwise we'd double-log the same "init" update.
  setTimeout(() => {
    if (!didInitialApply && !isWebSocketConnected()) {
      scheduleUpdate('init', { immediate: true });
    }
  }, 1000);
}

// ── Alarms ────────────────────────────────────────────────────────
//
// `updateBadge` is always-on — the icon badge is a core UX surface.
// `wsReconnect` is conditional on `backend.autoConnect`
// because its *only* job is to retry the websocket to the desktop
// companion; when the feature is off it's pure wake-up noise (every
// 30 s the SW would spin up just to log "skipping" and bail). We
// register/unregister the alarm when the setting flips so users who
// don't use desktop sync get a quiet, battery-friendly SW.
const WS_RECONNECT_ALARM = 'wsReconnect';

function applyWsReconnectAlarm(enabled: boolean): void {
  if (enabled) {
    alarms!.create(WS_RECONNECT_ALARM, { periodInMinutes: 0.5 });
  } else {
    alarms!.clear(WS_RECONNECT_ALARM);
  }
}

applyWsReconnectAlarm(shouldAttemptBackendConnection());
alarms!.create('updateBadge', { delayInMinutes: 0.01, periodInMinutes: 0.033 });

// ── Network online/offline recovery ────────────────────────────────
//
// The SW global exposes `navigator.onLine` + fires 'online' / 'offline'
// events when the platform observes a connectivity change (WiFi toggle,
// Ethernet plug-in, VPN tunnel up/down). These are best-effort signals
// — navigator.onLine specifically can be "true" while the browser is
// genuinely offline (the OS only flips it when it's sure) — but the
// 'online' transition is a reliable lower bound: once we see it, there
// IS connectivity. Treat it as an opportunistic kick for:
//   • the live scheduler's reconcile (re-computes nextAttemptAt for
//     every workflow; circuits with pending backoff stay paused, but
//     any workflow whose math now says "fire ASAP" gets an alarm at
//     the MV3 floor),
//   • kickActiveContextRefresh for the active (ws, env), which runs
//     `refreshLiveWorkflowSynchronously` inline for stale workflows —
//     the exact same primitive we use on SW cold-wake after laptop
//     sleep. Users get a fresh token within one network round-trip
//     of the connection coming back.
//
// Why not wrap the reconcile in its own retry loop after 'online':
// the scheduler's existing store-change + `backgroundReady` barrier
// already handle the "SW just woke up" case. 'online' is the
// complementary signal for "network just came back while SW was
// already alive." One handler, one kick per transition.
self.addEventListener('online', () => {
  logger.info('Background', 'Network online — reconciling live + OAuth schedulers + catching up stale workflows');
  void backgroundReady.then(async () => {
    await Promise.all([
      reconcileLiveSchedules().catch((err: unknown) => {
        logger.warn('Background', 'Live reconcile after online event failed', err);
      }),
      reconcileOAuthSchedules().catch((err: unknown) => {
        logger.warn('Background', 'OAuth reconcile after online event failed', err);
      }),
    ]);
    // Fire-and-forget — kick is idempotent (no-ops for fresh caches)
    // and the RefreshScheduler's per-host rate limiter prevents a
    // thundering herd when many workflows want to refresh at once.
    await kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
      logger.warn('Background', 'Wake-up catch-up after online event failed', err);
    });
  });
});

self.addEventListener('offline', () => {
  // Purely informational. Alarms that fire during offline and fail
  // feed the circuit breaker's failure counter the same as any other
  // failure — the pre-breaker retry tier (5s ± 5s) covers the common
  // "DHCP just dropped, back in 2s" case, and the full backoff curve
  // handles longer outages. The 'online' handler above drives catch-up
  // when connectivity returns.
  logger.info('Background', 'Network offline — refreshes in flight will likely fail and enter backoff');
});

function syncBackendConnectionGate(): void {
  const enabled = shouldAttemptBackendConnection();
  applyWsReconnectAlarm(enabled);
  // Flipping a gate on shouldn't leave the user waiting up to 30 s for
  // the first reconnect-alarm tick. `connectWebSocket` is idempotent
  // (bails if already connected / connecting) so calling unconditionally
  // is safe — the function itself re-checks `mode` + `autoConnect`
  // before actually opening a socket.
  if (enabled) void connectWebSocket();
}
subscribeKey('backend.autoConnect', syncBackendConnectionGate);
subscribeKey('backend.mode', syncBackendConnectionGate);

alarms!.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  // Fast path — alarms that don't depend on hydrated in-memory state
  // run immediately. `updateBadge` + `wsReconnect` keep firing every
  // few seconds to mask SW eviction; blocking them on init would
  // turn the barrier into a cold-start latency bomb.
  if (alarm.name === WS_RECONNECT_ALARM) {
    // Guard against a stale alarm firing after the gate flipped off
    // between `onAlarm` scheduling and this handler running.
    if (!shouldAttemptBackendConnection()) return;
    if (!isWebSocketConnected() && !isWebSocketConnecting()) {
      const attempts = getReconnectAttempts();
      const log = attempts <= 1 ? logger.info : logger.debug;
      log.call(logger, 'Background', 'WebSocket disconnected, reconnecting...');
      try {
        await connectWebSocket();
      } catch (error) {
        logger.debug('Background', 'Failed to reconnect:', (error as Error).message);
      }
    }
    return;
  }
  if (alarm.name === 'updateBadge') {
    void updateBadgeForCurrentTab();
    return;
  }
  // Hydration barrier — live / OAuth / TOTP handlers all read
  // in-memory stores (workflows, variables, credentials, vault)
  // that are only populated by `hydrateActiveWorkspaceStores`. On SW
  // cold wake (e.g. an overdue alarm waking us from eviction) the
  // listener fires in parallel with `initializeExtension`; without
  // this await, `handleLiveAlarm` sees an empty `getLiveWorkflows()`,
  // mis-identifies the workflow as "deleted between scheduling and
  // firing," and calls `chrome.alarms.clear` — permanently killing
  // the scheduled refresh until the user manually clicks Refresh.
  // The await always resolves in the happy path (either init
  // succeeded, or the finally-handler released the barrier after
  // init threw).
  await backgroundReady;
  if (isOAuthRefreshAlarm(alarm)) {
    await handleOAuthAlarm(alarm);
  } else if (isLiveRefreshAlarm(alarm)) {
    await handleLiveAlarm(alarm);
  } else if (isTotpAlarm(alarm)) {
    await handleTotpAlarm();
  } else if (isHandoffSweepAlarm(alarm)) {
    await sweepExpiredHandoffs();
  } else if (isActivityPruneAlarm(alarm)) {
    await handleActivityPruneAlarm();
  }
});

// ── Storage listeners ─────────────────────────────────────────────

storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
  // Collection/folder pause markers — workspace-scoped key. Only react
  // to changes for the currently active workspace; other workspaces'
  // markers don't drive the DNR engine until they become active.
  if (area === 'local' && extensionInitialized) {
    const activeKey = `oh.ws.${getActiveWorkspaceId()}.pauseMarkers`;
    if (changes[activeKey]) {
      // The pause-markers cache owns persistence + drives the in-memory
      // mirror via broadcast; the dnr-intent runner schedules recompile
      // off the same broadcast (RECOMPILE_DNR keyed by the singleton id).
      // The renderer-side `hostStorage.subscribe` listener in
      // RuleContext.tsx still picks up the storage change directly. Only
      // remaining side-effect on this listener is the badge refresh.
      debouncedUpdateBadge();
    }
    const scriptsReviewKey = `oh.ws.${getActiveWorkspaceId()}.requestScriptsReviewPending`;
    if (changes[scriptsReviewKey]) {
      const next = changes[scriptsReviewKey].newValue;
      const uids = Array.isArray(next) ? next.filter((v): v is string => typeof v === 'string') : [];
      applyRequestScriptsReviewSnapshot(uids);
    }
  }
});

// ── Message listener ──────────────────────────────────────────────

runtime.onMessage.addListener(
  (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    const msg = message as Record<string, unknown>;

    // Delay-page bypass: the delay page finished its countdown and is about
    // to navigate to the real target. Mark the tab so the delay DNR rule is
    // suppressed for it, then respond only AFTER Chrome has committed the
    // updated DNR rules so the follow-up navigation cannot race the rule
    // update and re-enter the delay loop. The target URL is stashed so the
    // bypass only clears when THAT specific navigation commits — not on an
    // unrelated Back-button or sibling navigation in the same tab.
    if (msg.type === 'oh-delay-bypass') {
      const tabId = sender.tab?.id;
      const target = typeof msg.target === 'string' ? msg.target : null;
      if (typeof tabId === 'number' && tabId >= 0 && target) {
        markTabForDelayBypass(tabId, target)
          .then(() => {
            try {
              sendResponse({ ok: true });
            } catch {
              /* channel closed — nothing to do */
            }
          })
          .catch((e: Error) => {
            logger.error('Background', 'Delay bypass failed:', e.message);
            try {
              sendResponse({ ok: false });
            } catch {
              /* channel closed */
            }
          });
        return true; // keep the message channel open for the async response
      }
      try {
        sendResponse({ ok: false });
      } catch {
        /* channel closed */
      }
      return false;
    }

    return handleGeneralMessage(msg, sender, sendResponse, {
      isWebSocketConnected,
      sendViaWebSocket,
      scheduleUpdate,
      revalidateTrackedRequests,
      updateBadgeCallback: debouncedUpdateBadge,
    });
  },
);

// ── Startup ───────────────────────────────────────────────────────

runtime.onStartup.addListener(() => {
  logger.info('Background', 'Browser started up');
  void initializeExtension();
});

runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  logger.info('Background', 'Extension installed/updated:', details.reason);
  logger.info(
    'Background',
    'Browser:',
    isFirefox ? 'Firefox' : isChrome ? 'Chrome' : isEdge ? 'Edge' : isSafari ? 'Safari' : 'Unknown',
  );
  void initializeExtension();
});

/**
 * Clear a tab's delay-bypass entry once the specific navigation we stashed
 * for it actually lands. Matching on (tabId, committedUrl) means an unrelated
 * Back-button or sibling navigation in the same tab leaves the bypass alone
 * until the real target commits (or errors out, or the tab is closed, or the
 * 30-second TTL expires).
 */
function setupDelayBypassCleanup(): void {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  if (api.webNavigation?.onCommitted) {
    api.webNavigation.onCommitted.addListener(
      (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
        if (details.frameId !== 0) return;
        // Ignore commits of delay.html itself — we only care about the
        // follow-up navigation to the real target.
        if (details.url.startsWith(api.runtime.getURL('delay.html'))) return;
        resolveDelayBypass(details.tabId, details.url);
      },
    );
  }

  // Navigation failed (DNS error, aborted, network offline, etc.) — clear
  // the bypass so the tab isn't stuck exempt until TTL.
  if (api.webNavigation?.onErrorOccurred) {
    api.webNavigation.onErrorOccurred.addListener((details: { tabId: number; frameId: number; url: string }) => {
      if (details.frameId !== 0) return;
      resolveDelayBypass(details.tabId, details.url);
    });
  }

  // Tab closed — drop any stashed entry.
  if (api.tabs?.onRemoved) {
    api.tabs.onRemoved.addListener((tabId: number) => {
      forgetDelayBypassForTab(tabId);
      void forgetCacheBypassForTab(tabId);
    });
  }
}

logger.info('Background', 'Background script started');
// Release the hydration barrier even if init fails — we'd rather
// dispatch alarms against a partially-hydrated state than stall
// them forever. Real subsystem errors surface through their own
// catches (see the `recordRefreshError` path on live alarms).
void initializeExtension()
  .catch((err: unknown) => {
    logger.error('Background', 'Extension initialization failed', err);
  })
  .finally(() => {
    resolveBackgroundReady();
  });

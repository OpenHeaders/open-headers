/**
 * Host-supplied hooks the oracle uses to reach back into surfaces it
 * does not own. The oracle remains the source of truth for sync state;
 * these hooks let it notify the host of side-effects (rebuild rules,
 * drop resolver caches, append a log entry) without importing
 * host-internal modules.
 *
 * Production wiring lives in the host app's boot path
 * ({@link setOracleHostHooks} once at module-load). Tests can leave
 * hooks unset — every call site is null-safe.
 */

import type {
  AwarenessState,
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncExtensionWorkspacePostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncGrpcRequestPostState,
  SyncLayoutStatePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWebSocketRequestPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import type { FieldOrigin, MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import type { LogEntry, Rule } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import type { TotpRegistry } from '@openheaders/core/variables';

/**
 * Per-mutation broadcast emitted by the sync engine. Carries the
 * committed envelope + mutator outcome plus optional per-entity
 * post-state projections (folded by renderer-side mirrors so they see
 * the post-commit shape without a SW round-trip).
 */
export interface OracleSyncBroadcastEvent {
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  batchId?: string;
  /**
   * Provenance of the apply that committed this envelope. `'inbound'`
   * marks peer-sourced content (mutation-stream bridge, snapshot
   * bootstrap re-seed). Client-host forwarders drop inbound events —
   * peer content must never bounce back up the wire; the hub host's
   * forwarder relays them to its other peers (fan-out).
   */
  applyOrigin?: FieldOrigin;
  rulePostState?: SyncRulePostState;
  environmentPostState?: SyncEnvironmentPostState;
  collectionPostState?: SyncCollectionPostState;
  workspaceVariablesPostState?: SyncWorkspaceVariablesPostState;
  vaultPostState?: SyncVaultPostState;
  folderPostState?: SyncFolderPostState;
  requestPostState?: SyncRequestPostState;
  grpcRequestPostState?: SyncGrpcRequestPostState;
  websocketRequestPostState?: SyncWebSocketRequestPostState;
  requestCollectionPostState?: SyncRequestCollectionPostState;
  requestFolderPostState?: SyncRequestFolderPostState;
  templatePostState?: SyncTemplatePostState;
  templateCollectionPostState?: SyncTemplateCollectionPostState;
  templateFolderPostState?: SyncTemplateFolderPostState;
  liveVariablePostState?: SyncLiveVariablePostState;
  liveWorkflowPostState?: SyncLiveWorkflowPostState;
  oauthBundlePostState?: SyncOAuthBundlePostState;
  pauseMarkersPostState?: SyncPauseMarkersPostState;
  layoutStatePostState?: SyncLayoutStatePostState;
  filesPostState?: SyncFilesPostState;
  extensionWorkspacePostState?: SyncExtensionWorkspacePostState;
}

export interface OracleAwarenessBroadcast {
  workspaceId: string;
  presence: AwarenessState[];
}

export interface OracleHostHooks {
  /**
   * Append one structured entry to the host's observability ring.
   * Omitted in tests; the oracle treats absence as "drop the event."
   */
  recordLog?: (entry: Omit<LogEntry, 'timestamp'>) => void;
  /**
   * Notify the rule-engine orchestrator that compiled DNR rules may
   * need to be rebuilt. Reason is a stable short tag carried into the
   * resulting log entry (e.g. `cache-invalidated`). `immediate` skips
   * the debounce — workspace switch + pause-state flips set this so
   * the rebuild lands inside the same tick and there's no mid-switch
   * rule leak.
   */
  scheduleRuleEngineUpdate?: (reason: string, opts?: { immediate?: boolean }) => void;
  /**
   * Drop the workspace-scoped variables-resolver state. Called when a
   * workspace is torn down (delete, sign-out, switch in test runs) so
   * stale resolution caches do not survive across owners.
   */
  disposeResolverStateForWorkspace?: (workspaceId: string) => void;
  /**
   * Fan a committed mutation out to every surface (other tabs, popup,
   * devpanel). Host typically wires this to its bridge `broadcast`
   * with the `syncBroadcast` channel.
   */
  broadcastSyncEvent?: (event: OracleSyncBroadcastEvent) => void;
  /**
   * Fan an awareness presence update out to surfaces. Host wires this
   * to its bridge `broadcast` with the `awarenessBroadcast` channel.
   */
  broadcastAwareness?: (event: OracleAwarenessBroadcast) => void;
  /**
   * Report a single status entry to the host's status pill subsystem.
   * Hosts wire this to their app-level `Status.report(...)` callable.
   * Subsystem is a free-form string; host validates against its own
   * closed set.
   */
  reportStatus?: (entry: OracleStatusReport) => void;
  /**
   * Return the host's current active-workspace pointer or throw if the
   * host hasn't bootstrapped one yet. Per-app-instance state owned by
   * the host (architecture taxonomy §4.3). Workspace-scoped stores
   * call this when they need to know which slice to read or mutate.
   */
  getActiveWorkspaceId?: () => string;
  /**
   * Non-throwing variant — returns null when no active workspace is
   * set (boot, post-tear-down). Callers that can short-circuit safely
   * prefer this over {@link getActiveWorkspaceId}.
   */
  peekActiveWorkspaceId?: () => string | null;
  /**
   * Synchronous read of the host's cached TOTP code mirror. The DNR
   * compile path inside the resolver reads this on every refresh;
   * async crypto stays out of the resolver's hot path because the
   * host pre-warms the cache on its own cadence.
   */
  getCachedTotpCodes?: () => TotpRegistry;
  /**
   * Notify the host that the active workspace just flipped to a new
   * rule + pause-marker set. Browser-side hosts use this to drive HTTP
   * cache invalidation (rule-state observer + cache invalidator); hosts
   * without a request-modifying runtime no-op. Called from
   * `swapPerWorkspaceStores` AFTER per-workspace stores have switched
   * and BEFORE the DNR rebuild fires, so observers see the incoming
   * workspace's rule view.
   */
  onWorkspaceSwitched?: (nextRules: readonly Rule[], pauseMarkers: ReadonlyMap<string, PauseMarker>) => void;
}

export interface OracleStatusReport {
  subsystem: string;
  state: 'green' | 'yellow' | 'red';
  message: string;
  context?: Record<string, unknown>;
}

let hooks: OracleHostHooks = {};

/** Install (or replace) the host hooks. Safe to call before any sync activity. */
export function setOracleHostHooks(next: OracleHostHooks): void {
  hooks = next;
}

/** Read the current hooks. Callers should null-check each entry before invoking. */
export function getOracleHostHooks(): OracleHostHooks {
  return hooks;
}

/**
 * Require the host's active-workspace pointer. Throws if no host hook
 * is installed or the host reports no active workspace. Use from store
 * paths that have no sensible fallback when a workspace isn't selected.
 */
export function requireActiveWorkspaceId(): string {
  const id = hooks.getActiveWorkspaceId?.();
  if (id == null) {
    throw new Error('Oracle: getActiveWorkspaceId host hook is not wired or no workspace is active');
  }
  return id;
}

/**
 * Non-throwing read of the host's active-workspace pointer. Returns
 * null when no host hook is installed or no workspace is currently
 * active (boot, post-tear-down).
 */
export function peekActiveWorkspaceId(): string | null {
  return hooks.peekActiveWorkspaceId?.() ?? null;
}

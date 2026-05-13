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
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import type { LogEntry } from '@openheaders/core/types';
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
  rulePostState?: SyncRulePostState;
  environmentPostState?: SyncEnvironmentPostState;
  collectionPostState?: SyncCollectionPostState;
  workspaceVariablesPostState?: SyncWorkspaceVariablesPostState;
  vaultPostState?: SyncVaultPostState;
  folderPostState?: SyncFolderPostState;
  requestPostState?: SyncRequestPostState;
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
   * resulting log entry (e.g. `cache-invalidated`).
   */
  scheduleRuleEngineUpdate?: (reason: string) => void;
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

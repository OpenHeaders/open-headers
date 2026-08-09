/**
 * Workspace-tree runtime — shared spine: the per-binding live state
 * (`OpenBinding`), the tuning constants, and the `RuntimeCtx` seam the
 * pass modules run against. `runtime/index.ts` constructs ONE ctx and
 * binds every pass to it — modules never import each other's behavior,
 * so the dependency graph stays a star, not a web.
 */

import type { WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { TreeIssue, WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import type { WorkspaceServiceState } from '@openheaders/oracle/sync/service';
import type {
  CommitIntent,
  CommitUserAttribution,
  GitAuditRow,
  GitAvailability,
  GitRunner,
  SyntheticCommitIdentity,
  UpstreamState,
} from '../../git';
import type { GitHeadWatcher } from '../head-watcher';
import type { WorkspaceTreeMaterializer } from '../materializer';
import type { StatusCache } from '../status-cache';
import type { SweepWorkspaceTreeResult } from '../sweep';
import type { WorkspaceTreeWatcher } from '../watcher';
import type {
  CommitWorkspaceTreeRpcResult,
  WorkspaceTreeCommitCadence,
  WorkspaceTreeGitStatusRpcResult,
  WorkspaceTreeRuntimeOptions,
} from './types';

export const SCOPE = 'workspace-tree-runtime';

/** Surface attribution for tree-authored virtual batches. */
export const TREE_SURFACE_ID = 'tree';

export const MATERIALIZE_DEBOUNCE_MS = 500;

/**
 * Auto-commit quiescence (§23.4): a commit fires only after the batch
 * stream has been quiet this long — never per keystroke. Longer than
 * the materialize debounce so the tree is always flushed first (the
 * commit op re-flushes anyway; this just avoids wasted no-op passes).
 */
export const COMMIT_QUIESCENCE_MS = 2_000;

/** Intent ring cap — beyond this the semantic message is already a summary. */
export const MAX_PENDING_INTENTS = 1_000;

/**
 * Background fetch cadence (§3.2: fetch is always on, non-mutating —
 * it powers the ahead/behind affordance; pull stays an explicit
 * gesture per the S6 manual-pull-only default).
 */
export const FETCH_INTERVAL_MS = 5 * 60_000;

/** Minimum spacing between focus-triggered fetches (cmd-tab is bursty). */
export const FETCH_FOCUS_MIN_MS = 30_000;

/** Trailing debounce for the §9 status feed — a bind/sweep/flush burst probes once. */
export const STATUS_PUBLISH_DEBOUNCE_MS = 150;

/** Retry window while an in-progress git operation holds reconcile (§3.3). */
export const OP_HOLD_RETRY_MS = 5_000;

/** Wall-clock interval per `every-Nm` cadence value. */
export const CADENCE_INTERVAL_MS: Partial<Record<WorkspaceTreeCommitCadence, number>> = {
  'every-5m': 5 * 60_000,
  'every-15m': 15 * 60_000,
  'every-30m': 30 * 60_000,
};

/** History reads (§9, Phase 7): default page + hard cap — a recent timeline, not a full log browser. */
export const LOG_DEFAULT_LIMIT = 20;
export const LOG_MAX_LIMIT = 200;
/** Console-tab ring cap — enough scrollback without unbounded growth. */
export const GIT_CONSOLE_CAP = 300;

export interface OpenBinding {
  record: WorkspaceTreeBindingRecord;
  service: WorkspaceServiceState;
  materializer: WorkspaceTreeMaterializer;
  watcher: WorkspaceTreeWatcher;
  /** `.git/HEAD` watch — the external-checkout trigger (started once the repo exists). */
  headWatcher: GitHeadWatcher;
  /** The branch the §6.3 log pointer currently reflects; null before the first probe. */
  logBranch: string | null;
  /** §8 single actor — every sweep + materialize + commit pass chains here. */
  chain: Promise<void>;
  materializeTimer: NodeJS.Timeout | null;
  /** Auto-commit quiescence timer (cadence `auto` only). */
  commitTimer: NodeJS.Timeout | null;
  /** Wall-clock commit interval (cadence `every-Nm` only). */
  commitInterval: NodeJS.Timeout | null;
  /** Background fetch interval (§3.2 — always on while bound). */
  fetchInterval: NodeJS.Timeout | null;
  /** Wall-clock of the last fetch attempt — focus-trigger throttle. */
  lastFetchAt: number;
  /** Retry timer while an in-progress git op holds reconcile (§3.3). */
  holdRetryTimer: NodeJS.Timeout | null;
  /** Trailing debounce for the §9 status feed — bursts collapse to one frame. */
  statusPublishTimer: NodeJS.Timeout | null;
  /** Hash of the last published status frame — identical recomputes stay silent. */
  lastStatusHash: string | null;
  /**
   * The §9 status authority: movement invalidates, readers (RPC,
   * refs rail, the debounced sink) share one compute and snapshot it.
   */
  status: StatusCache<WorkspaceTreeGitStatusRpcResult>;
  /** Batch intents since the last successful commit — the semantic-message feed. */
  intents: CommitIntent[];
  /**
   * userIds whose batches ride the pending intents (§23.6) — stamped
   * at ingest from the peer credential; drained in lockstep with the
   * intent ring, since both describe the same uncommitted work.
   */
  contributors: Set<string>;
  issues: TreeIssue[];
  closed: boolean;
}

/**
 * The seam every pass module runs against — primitives plus the
 * cross-cutting passes (status publish, sweep, commit) that more than
 * one module triggers. Constructed once in `runtime/index.ts`.
 */
export interface RuntimeCtx {
  readonly options: WorkspaceTreeRuntimeOptions;
  readonly open: Map<string, OpenBinding>;
  readonly gitRun: GitRunner;
  /** Host-global audit ring (Console tab feed) — real-runner rows only. */
  readonly consoleRows: GitAuditRow[];
  ensureGitAvailability(cwd: string): Promise<GitAvailability>;
  /** §8 single actor — chain `op` on the binding's serial promise chain. */
  enqueue(binding: OpenBinding, op: () => Promise<void>): void;
  buildSnapshot(workspaceId: string): Promise<WorkspaceTreeState>;
  applyAll(service: WorkspaceServiceState, batches: EmissionBatch[]): Promise<void>;
  updateBindingRecord(
    workspaceId: string,
    patch: Partial<WorkspaceTreeBindingRecord>,
  ): Promise<WorkspaceTreeBindingRecord | null>;

  // ── Status authority (runtime/status.ts) ────────────────────────────
  readGitStatus(binding: OpenBinding): Promise<WorkspaceTreeGitStatusRpcResult>;
  publishGitStatus(binding: OpenBinding): Promise<void>;

  // ── Sweep plane (runtime/sweep.ts) ──────────────────────────────────
  runSweep(binding: OpenBinding): Promise<SweepWorkspaceTreeResult | null>;
  scheduleMaterialize(binding: OpenBinding): void;
  heldByGitOperation(binding: OpenBinding): Promise<boolean>;
  appendIssues(binding: OpenBinding, issues: readonly TreeIssue[]): void;
  refreshIssuesFromDisk(binding: OpenBinding): Promise<void>;

  // ── Commit plane (runtime/commit.ts) ────────────────────────────────
  syntheticIdentity(): SyntheticCommitIdentity;
  drainIntents(binding: OpenBinding): void;
  resolveContributors(binding: OpenBinding): Promise<CommitUserAttribution[]>;
  runCommit(binding: OpenBinding, messageOverride?: string): Promise<CommitWorkspaceTreeRpcResult>;
  scheduleAutoCommit(binding: OpenBinding): void;
  applyCadenceTimers(binding: OpenBinding): void;
  enqueueAutoCommit(binding: OpenBinding, trigger: string): void;

  // ── §16 watermark (runtime/watermark.ts) ────────────────────────────
  watermarkFor(binding: OpenBinding, branch: string | null): string | undefined;
  recordWatermark(binding: OpenBinding, sha: string): Promise<void>;
  detectForcePush(
    binding: OpenBinding,
    branch: string | null,
    upstream: UpstreamState | null,
  ): Promise<{ remoteSha: string; lastSyncedSha: string } | null>;

  // ── Sync plane (runtime/sync.ts) ────────────────────────────────────
  enqueueFetch(binding: OpenBinding, trigger: string): void;
  maybeAutoPush(binding: OpenBinding): Promise<void>;

  // ── Branch plane (runtime/branches.ts) ──────────────────────────────
  /** Keep the §6.3 per-branch log pointer in step with HEAD; true when it moved. */
  syncLogBranch(binding: OpenBinding): Promise<boolean>;
}

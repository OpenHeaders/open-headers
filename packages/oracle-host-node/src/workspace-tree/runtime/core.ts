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
  GitAvailability,
  GitRunner,
  GitStreamRunner,
  SyntheticCommitIdentity,
  UpstreamState,
} from '../../git';
import type { GitDirWatcher } from '../git-dir-watcher';
import type { LogHistories } from '../history';
import type { WorkspaceTreeMaterializer } from '../materializer';
import type { StatusCache } from '../status-cache';
import type { SweepWorkspaceTreeResult } from '../sweep';
import type { Turns } from '../turns';
import type { WorkspaceTreeWatcher } from '../watcher';
import type {
  CommitWorkspaceTreeRpcResult,
  GitConsoleRow,
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

/**
 * The longest the `auto` cadence waits before it tries again after
 * finding the index locked — its wait doubles from the quiescence up to
 * this, so a lock nobody releases costs one try a minute.
 */
export const COMMIT_STAND_DOWN_MAX_WAIT_MS = 60_000;

/** Intent ring cap — beyond this the semantic message is already a summary. */
export const MAX_PENDING_INTENTS = 1_000;

/**
 * Background fetch cadence (§3.2: fetch is always on, non-mutating —
 * it powers the ahead/behind affordance; pull stays an explicit
 * gesture per the S6 manual-pull-only default).
 */
export const FETCH_INTERVAL_MS = 5 * 60_000;

/**
 * Minimum spacing between BACKGROUND fetches, whatever asked for them:
 * the triggers arrive in bursts (cmd-tab, a wake-up's late timer beside
 * its focus), and a second fetch within the window brings nothing the
 * first did not.
 */
export const BACKGROUND_FETCH_MIN_GAP_MS = 30_000;

/** How long a burst of console rows is gathered before the feed's one notice (a pass runs several commands). */
export const GIT_CONSOLE_NOTICE_MS = 100;

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
/** Rows one read of a log's list answers at most — a few screens of them. */
export const LOG_ROWS_MAX_COUNT = 400;
/** Linear runs one ask folds (or opens again) by name at most. */
export const LOG_ROWS_MAX_FOLDS = 1_000;
/** Reads of one kind (rows, a commit's place) of one workspace's log in flight at once; one more ends the oldest. */
export const LOG_ROWS_MAX_IN_FLIGHT = 8;
/** The longest one read of a whole history may take — a million commits with no commit-graph file take seven seconds. */
export const LOG_HISTORY_READ_TIMEOUT_MS = 60_000;
/** The longest the walk that names a filter's commits may take. */
export const LOG_HISTORY_WALK_TIMEOUT_MS = 30_000;
/** The longest one read of a history's texts may take — a million commits' subjects and authors take nine seconds. */
export const LOG_HISTORY_TEXTS_TIMEOUT_MS = 120_000;
/** The longest a pattern may run over a history's texts — a pattern alone can run on; a plain text has no deadline. */
export const LOG_HISTORY_PATTERN_DEADLINE_MS = 5_000;
/** Patterns one workspace runs at once — a thread each, for as long as its deadline; one more ends the one running longest. */
export const LOG_HISTORY_MAX_PATTERNS = 4;
/** A history nobody has asked of for this long is let go. */
export const LOG_HISTORY_IDLE_MS = 10 * 60_000;
/** Lists kept per workspace. */
export const LOG_HISTORY_MAX_LISTS = 4;
/** Console-tab ring cap — enough scrollback without unbounded growth. */
export const GIT_CONSOLE_CAP = 300;

export interface OpenBinding {
  record: WorkspaceTreeBindingRecord;
  service: WorkspaceServiceState;
  materializer: WorkspaceTreeMaterializer;
  watcher: WorkspaceTreeWatcher;
  /** The git directory's watch — a checkout or a ref moved outside the app (started once the repo exists). */
  gitDirWatcher: GitDirWatcher;
  /** The HEAD identity the §6.3 log pointer currently reflects (branch name or `@{<sha>}`); null before the first probe. */
  logHead: string | null;
  /** §8 single actor — every sweep + materialize + commit pass chains here. */
  chain: Promise<void>;
  materializeTimer: NodeJS.Timeout | null;
  /** Auto-commit quiescence timer (cadence `auto` only). */
  commitTimer: NodeJS.Timeout | null;
  /** Automated commit passes in a row that found the index locked — the `auto` cadence's next wait grows with it. */
  commitStandDowns: number;
  /** Wall-clock commit interval (cadence `every-Nm` only). */
  commitInterval: NodeJS.Timeout | null;
  /** Background fetch interval (§3.2 — always on while bound). */
  fetchInterval: NodeJS.Timeout | null;
  /** Wall-clock of the last fetch asked for — a gesture's, or a background one's when it was queued: the background triggers' throttle. */
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
  /** The reading runner — a git read handed over as it arrives (a whole history's walk). */
  readonly gitStream: GitStreamRunner;
  /** The histories held for the logs that are open, and the lists made from them. */
  readonly logHistories: LogHistories;
  /** Whose turn a read of a log's list has — one set per kind of read. */
  readonly logTurns: { readonly rows: Turns; readonly locate: Turns };
  /** Host-global audit ring (Console tab feed) — real-runner rows only. */
  readonly consoleRows: GitConsoleRow[];
  ensureGitAvailability(cwd: string): Promise<GitAvailability>;
  /** §8 single actor — chain `op` on the binding's serial promise chain. */
  enqueue(binding: OpenBinding, op: () => Promise<void>): void;
  buildSnapshot(workspaceId: string, service: WorkspaceServiceState): Promise<WorkspaceTreeState>;
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
  /** One reconcile pass after the hold's wait, for a pass that stood down while git wrote the tree. */
  armHoldRetry(binding: OpenBinding): void;
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

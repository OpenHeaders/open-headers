/**
 * Workspace-tree runtime — the Node host's live binding layer
 * (GIT_PLAN.md §10 Phase 2, the S4 engine wiring). One instance per
 * host process, installed by the daemon spine:
 *
 *   - binding registry: `OH.workspaceTreeBindings` (host-local — a
 *     binding is a statement about this machine's filesystem);
 *   - snapshot provider: the bound workspace's `wsKeys` slots +
 *     workspace meta → `WorkspaceTreeState`, with the sidecar's
 *     unknown-field rows riding along (the S3 unknown-rows loop);
 *   - rung 1: every committed envelope for a bound workspace schedules
 *     a debounced materialize (§3.2 — materialize is always on);
 *   - rung 2: bind-open runs the MANDATORY cold-boot tree-wins sweep
 *     (S3 §11.2), and the filesystem watcher schedules the same sweep
 *     for live external edits;
 *   - §8 single actor: per binding, sweeps and materialize passes run
 *     on ONE promise chain — they never interleave.
 *
 * A bound workspace holds its sync service resident (refcount) for the
 * binding's lifetime: virtual batches and snapshot reads need the
 * oracle live even when no surface has the workspace open.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import { OH, type WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Workspace } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import type { TreeIssue, WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  type WorkspaceServiceState,
} from '@openheaders/oracle/sync/service';
import { getWorkspace, listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import {
  type CommitFileDiff,
  type CommitIntent,
  type CommitLogEntry,
  type CommitUserAttribution,
  commitWorkspaceTree,
  composeCommitMessage,
  countDirtyFiles,
  createAndSwitchBranch,
  createGitExec,
  currentBranch,
  ensureWorkspaceRepo,
  fetchWorkspaceRemote,
  type GitAuditRow,
  type GitAvailability,
  type GitRunner,
  gitOperationInProgress,
  isAncestorOf,
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isWorkspaceRepo,
  listCommitLog,
  listFileLog,
  listLocalBranches,
  listRepoRefs,
  probeGitAvailability,
  pushHeadToNewBranch,
  pushWorkspaceBranch,
  type RepoRef,
  readCommitFileDiff,
  resolveCommitIdentity,
  resolveUpstream,
  type UpstreamState,
  userIndexHasStagedChanges,
  withCommitAttribution,
} from '../git';
import { supportsBranchScope } from '../sync/sqlite-mutation-log';
import { type BindWorkspaceTreeResult, bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from './bind';
import { type ForcePushChoice, resolveForcePushWorkspaceTree } from './force-push';
import { GitHeadWatcher } from './head-watcher';
import { WorkspaceTreeMaterializer } from './materializer';
import { mergeWorkspaceBranch } from './merge';
import { pullWorkspaceTree } from './pull';
import { readWorkspaceTreeFromDisk } from './reader';
import { readTreeUnknownFields } from './sidecar';
import { StatusCache } from './status-cache';
import { type SweepWorkspaceTreeResult, sweepWorkspaceTree } from './sweep';
import { type SwitchDirtyAction, switchWorkspaceBranch } from './switch';
import { WorkspaceTreeWatcher } from './watcher';

const SCOPE = 'workspace-tree-runtime';

/** Surface attribution for tree-authored virtual batches. */
const TREE_SURFACE_ID = 'tree';

const MATERIALIZE_DEBOUNCE_MS = 500;

/**
 * Auto-commit quiescence (§23.4): a commit fires only after the batch
 * stream has been quiet this long — never per keystroke. Longer than
 * the materialize debounce so the tree is always flushed first (the
 * commit op re-flushes anyway; this just avoids wasted no-op passes).
 */
const COMMIT_QUIESCENCE_MS = 2_000;

/** Intent ring cap — beyond this the semantic message is already a summary. */
const MAX_PENDING_INTENTS = 1_000;

/**
 * Background fetch cadence (§3.2: fetch is always on, non-mutating —
 * it powers the ahead/behind affordance; pull stays an explicit
 * gesture per the S6 manual-pull-only default).
 */
const FETCH_INTERVAL_MS = 5 * 60_000;

/** Minimum spacing between focus-triggered fetches (cmd-tab is bursty). */
const FETCH_FOCUS_MIN_MS = 30_000;

/** Trailing debounce for the §9 status feed — a bind/sweep/flush burst probes once. */
const STATUS_PUBLISH_DEBOUNCE_MS = 150;

/** Retry window while an in-progress git operation holds reconcile (§3.3). */
const OP_HOLD_RETRY_MS = 5_000;

/** History reads (§9, Phase 7): default page + hard cap — a recent timeline, not a full log browser. */
const LOG_DEFAULT_LIMIT = 20;
const LOG_MAX_LIMIT = 200;
/** Console-tab ring cap — enough scrollback without unbounded growth. */
const GIT_CONSOLE_CAP = 300;

export type WorkspaceTreeCommitCadence = 'off' | 'auto' | 'on-blur' | 'every-5m' | 'every-15m' | 'every-30m';

/** Wall-clock interval per `every-Nm` cadence value. */
const CADENCE_INTERVAL_MS: Partial<Record<WorkspaceTreeCommitCadence, number>> = {
  'every-5m': 5 * 60_000,
  'every-15m': 15 * 60_000,
  'every-30m': 30 * 60_000,
};

export type BindWorkspaceTreeRpcResult =
  | { ok: true; initialized: boolean; sweep: SweepWorkspaceTreeResult | null }
  | { ok: false; reason: 'unknown-workspace' | 'already-bound' }
  | Exclude<BindWorkspaceTreeResult, { ok: true }>;

export type CommitWorkspaceTreeRpcResult =
  | { ok: true; committed: boolean; sha?: string }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'stage-failed' | 'commit-failed';
      detail?: string;
    };

export type PullWorkspaceTreeRpcResult =
  | { ok: true; upToDate: true }
  | { ok: true; upToDate: false; sha: string; applied: number }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'op-in-progress'
        | 'no-upstream'
        | 'fetch-failed'
        | 'force-push'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'commit-failed';
      detail?: string;
    };

export type PushWorkspaceTreeRpcResult =
  | { ok: true; pushed: boolean; remoteSha: string }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'no-upstream'
        | 'force-push'
        | 'rejected'
        | 'no-permission'
        | 'push-failed';
      detail?: string;
    };

export type ResolveForcePushRpcResult =
  | { ok: true; sha: string; rescueBranch: string | null }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'op-in-progress'
        | 'no-upstream'
        | 'fetch-failed'
        | 'not-rewritten'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'ref-update-failed'
        | 'commit-failed';
      detail?: string;
    };

export type SwitchBranchRpcResult =
  | { ok: true; branch: string; switched: boolean }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'op-in-progress'
        | 'unknown-branch'
        | 'dirty'
        | 'commit-failed'
        | 'stash-failed'
        | 'checkout-failed';
      detail?: string;
      dirtyFiles?: number;
    };

export type CreateBranchRpcResult =
  | { ok: true; branch: string }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'create-failed'; detail?: string };

export type MergeBranchRpcResult =
  | { ok: true; upToDate: true }
  | { ok: true; upToDate: false; sha: string; applied: number }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'op-in-progress'
        | 'unknown-ref'
        | 'self-merge'
        | 'detached-head'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'commit-failed';
      detail?: string;
    };

export type WorkspaceTreeLogRpcResult =
  | { ok: true; entries: CommitLogEntry[] }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-ref' | 'log-failed';
      detail?: string;
    };

export type WorkspaceTreeRefsRpcResult =
  | { ok: true; refs: RepoRef[]; current: string | null }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'refs-failed'; detail?: string };

export type WorkspaceTreeGitConsoleRpcResult = { ok: true; rows: GitAuditRow[] } | { ok: false; reason: 'not-bound' };

export type WorkspaceTreeFileDiffRpcResult =
  | { ok: true; diff: CommitFileDiff }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-commit' | 'unknown-path' | 'diff-failed';
      detail?: string;
    };

export interface WorkspaceTreeGitStatusRpcResult {
  bound: boolean;
  git: GitAvailability;
  repo: boolean;
  /** The checked-out branch (§6 — one active branch per binding); null when detached/unavailable. */
  branch: string | null;
  /** Local branch names — rescue/fork branches appear here naturally. */
  branches: string[];
  /** `git status --porcelain` entry count; null when unreadable. */
  dirtyFiles: number | null;
  /** True while the user's own staging area is non-empty (§3.3 pause). */
  userIndexBusy: boolean;
  /** Semantic draft from the intents recorded since the last commit. */
  suggestedMessage: string;
  cadence: WorkspaceTreeCommitCadence;
  /** The explicit `--no-verify` setting (§3.3); false unless the user flipped it. */
  bypassHooks: boolean;
  /** Remote-tracking ref name (`origin/main`); null when no upstream is configured. */
  upstream: string | null;
  /** Local commits the upstream lacks; null without an upstream. */
  ahead: number | null;
  /** Upstream commits the local branch lacks (the Pull affordance); null without an upstream. */
  behind: number | null;
  /** Opt-in auto-push after every engine commit (§3.2); false unless the user flipped it. */
  autoPushOnCommit: boolean;
  /** Non-null while a remote history rewrite is detected (§16) — holds pull/push. */
  forcePush: { remoteSha: string; lastSyncedSha: string } | null;
}

export interface WorkspaceTreeRuntime {
  /** Reopen persisted bindings; call once after the sync engine boots. */
  start(): Promise<void>;
  /** Rung-1 feed — call on every committed envelope (host hook). */
  onSyncEvent(event: OracleSyncBroadcastEvent): void;
  bind(workspaceId: string, rootDir: string): Promise<BindWorkspaceTreeRpcResult>;
  unbind(workspaceId: string): Promise<{ ok: boolean }>;
  probe(rootDir: string): ReturnType<typeof probeWorkspaceTree>;
  list(): WorkspaceTreeBindingRecord[];
  /** Explicit Commit gesture (§9) — flush, then a temp-index `git commit`. */
  commit(workspaceId: string, message?: string): Promise<CommitWorkspaceTreeRpcResult>;
  /**
   * Explicit Pull gesture (§9, Phase 4): fetch, converge foreign
   * history through the mutators, record the two-parent merge commit.
   * Local uncommitted work commits first under its own semantic draft
   * so the merge commit stays a pure merge.
   */
  pull(workspaceId: string): Promise<PullWorkspaceTreeRpcResult>;
  /**
   * Explicit Push gesture (§9, Phase 5): push the current branch to
   * its upstream. Typed non-fast-forward / permission failures feed
   * the card's pull-first nudge and the §8.2 read-only affordance;
   * refused while a force-push is detected.
   */
  push(workspaceId: string): Promise<PushWorkspaceTreeRpcResult>;
  /** The §8.2 affordance — publish local HEAD as a NEW remote branch. */
  pushNewBranch(workspaceId: string, branch: string): Promise<PushWorkspaceTreeRpcResult>;
  /** Opt-in auto-push after every engine commit (§3.2) — per binding, like the cadence. */
  setAutoPushOnCommit(workspaceId: string, autoPushOnCommit: boolean): Promise<{ ok: boolean }>;
  /**
   * Resolve a detected remote history rewrite (§16 trichotomy).
   * Local uncommitted work commits first so every choice operates on
   * complete local material.
   */
  resolveForcePush(workspaceId: string, choice: ForcePushChoice): Promise<ResolveForcePushRpcResult>;
  /**
   * In-app branch switch (§6.2) — the wrapped checkout with the
   * Commit / Stash / Discard answer; a dirty tree with no answer
   * refuses so the surface raises the prompt. A successful switch
   * flips the §6.3 per-branch log pointer and runs the same rung-2
   * tree-wins sweep an external checkout takes.
   */
  switchBranch(workspaceId: string, branch: string, dirtyAction?: SwitchDirtyAction): Promise<SwitchBranchRpcResult>;
  /** Create a branch at HEAD and switch to it (dirty work rides along, like `checkout -b`). */
  createBranch(workspaceId: string, branch: string): Promise<CreateBranchRpcResult>;
  /**
   * In-app branch merge (§6): the Phase 4 pull machinery pointed at a
   * local or remote-tracking ref — never raw `git merge`. Local
   * uncommitted work commits first, exactly like pull.
   */
  mergeBranch(workspaceId: string, ref: string): Promise<MergeBranchRpcResult>;
  /** Focus returned to the app — throttled background fetch trigger. */
  notifyAppFocus(): void;
  /** Git slot feed for the card/pill — availability, dirty count, draft message. */
  gitStatus(workspaceId: string): Promise<WorkspaceTreeGitStatusRpcResult>;
  /**
   * Workspace history timeline (§9, Phase 7) — recent commits with
   * changed paths. `ref` scopes the walk to a branch/tag from
   * {@link listRefs}'s answer; anything else refuses `unknown-ref`.
   */
  log(workspaceId: string, limit?: number, ref?: string): Promise<WorkspaceTreeLogRpcResult>;
  /** One path's timeline (`--follow`) — the newest entry is "who last touched this". */
  fileLog(workspaceId: string, path: string, limit?: number): Promise<WorkspaceTreeLogRpcResult>;
  /** The log view's ref tree (§9, Phase 7 slice 2) — local branches, remote-tracking refs, tags. */
  listRefs(workspaceId: string): Promise<WorkspaceTreeRefsRpcResult>;
  /**
   * One file's old/new blob pair in one commit (§9, Phase 7 slice 3) —
   * the diff pane's feed. `sha` must be a FULL commit hash from `log`'s
   * answer and `path` a plain tree path; anything else refuses typed.
   */
  fileDiff(workspaceId: string, sha: string, path: string): Promise<WorkspaceTreeFileDiffRpcResult>;
  /**
   * The Console tab's read-only feed (§9): audit rows of every
   * state-changing git command the engine ran in this binding's repo,
   * newest last. Host-side ring, capped; commands from injected
   * runners (tests) never appear.
   */
  gitConsole(workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult>;
  setCommitCadence(workspaceId: string, cadence: WorkspaceTreeCommitCadence): Promise<{ ok: boolean }>;
  /** The explicit setting behind `--no-verify` (§3.3) — per binding, like the cadence. */
  setBypassHooks(workspaceId: string, bypassHooks: boolean): Promise<{ ok: boolean }>;
  /** Focus left the app — the `on-blur` cadence trigger; other cadences ignore it. */
  notifyAppBlur(): void;
  /** Latest sweep issues per bound workspace — the quarantine seam's surface. */
  issues(workspaceId: string): TreeIssue[];
  dispose(): Promise<void>;
}

interface OpenBinding {
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

export interface WorkspaceTreeRuntimeOptions {
  /** Stable engine-instance identity for the `.oh/lock` file. */
  hostId: string;
  /** Injectable git seam (§7) — tests and the fault suite mock here. */
  gitRunner?: GitRunner;
  /**
   * Live git-slot feed (§9): called after every pass that can move
   * `git status` (materialize flush, sweep, commit) and on setting
   * changes. The spine fans it to local surfaces as the
   * `workspaceTreeGitStatus` broadcast and into the sync aggregate's
   * git slot. A `bound: false` status is the unbind/teardown signal.
   */
  onGitStatus?: (workspaceId: string, status: WorkspaceTreeGitStatusRpcResult) => void;
  /**
   * §23.6 authorship (multi-user hosts): map a contributing userId to
   * its git-author identity. A sole contributor becomes the commit
   * author; several ride as `Co-Authored-By:` trailers under the
   * operator author. `null` skips the user (unresolvable — the commit
   * stays operator-attributed). Absent on single-user hosts — commits
   * keep the resolved operator identity untouched.
   */
  resolveUserAttribution?: (userId: string) => Promise<CommitUserAttribution | null>;
}

export function createWorkspaceTreeRuntime(options: WorkspaceTreeRuntimeOptions): WorkspaceTreeRuntime {
  const open = new Map<string, OpenBinding>();
  let records: WorkspaceTreeBindingRecord[] = [];
  let disposed = false;

  // Read-only console feed (§9, IDE-log Console tab): the last N audit
  // rows of the REAL git plane, host-global, filtered per binding at
  // read time. Injected runners (tests, the fault suite) bypass
  // `createGitExec`, so their commands never reach the feed — the
  // console mirrors what actually ran on the user's repo.
  const consoleRows: GitAuditRow[] = [];
  const gitRun: GitRunner =
    options.gitRunner ??
    createGitExec({
      audit: (row) => {
        logger.info(SCOPE, `git ${row.args.join(' ')} → ${row.code} (${row.durationMs}ms)`);
        consoleRows.push(row);
        if (consoleRows.length > GIT_CONSOLE_CAP) consoleRows.splice(0, consoleRows.length - GIT_CONSOLE_CAP);
      },
    });

  // Availability is a property of the machine, probed once per process
  // (missing git ⇒ the git plane disables itself loudly, §7 — bindings
  // and the tree plane keep working untouched).
  let gitAvailability: Promise<GitAvailability> | null = null;
  const ensureGitAvailability = (cwd: string): Promise<GitAvailability> => {
    gitAvailability ??= probeGitAvailability(gitRun, cwd);
    return gitAvailability;
  };

  const persistRecords = async (): Promise<void> => {
    await hostStorage.set(OH.workspaceTreeBindings, records);
  };

  /** Patch one binding's persisted record (cadence, toggles, the §16 watermark) and keep the open binding in step. */
  const updateBindingRecord = async (
    workspaceId: string,
    patch: Partial<WorkspaceTreeBindingRecord>,
  ): Promise<WorkspaceTreeBindingRecord | null> => {
    const record = records.find((entry) => entry.workspaceId === workspaceId);
    if (!record) return null;
    const next: WorkspaceTreeBindingRecord = { ...record, ...patch };
    records = records.map((entry) => (entry.workspaceId === workspaceId ? next : entry));
    await persistRecords();
    const binding = open.get(workspaceId);
    if (binding) binding.record = next;
    return next;
  };

  /** The workspace entity the manifest carries — meta + the synced default-env pointer. */
  const workspaceEntity = async (workspaceId: string): Promise<Workspace | null> => {
    const meta = getWorkspace(workspaceId);
    if (!meta) return null;
    const defaultEnvironmentId = await hostStorage.get(wsKeys(workspaceId).defaultEnvironmentId);
    return {
      schemaVersion: 5,
      uid: meta.id,
      name: meta.name,
      ...(meta.description !== undefined ? { description: meta.description } : {}),
      ...(defaultEnvironmentId ? { defaultEnvironmentId } : {}),
      orgId: meta.orgId,
    };
  };

  const buildSnapshot = async (workspaceId: string): Promise<WorkspaceTreeState> => {
    const workspace = await workspaceEntity(workspaceId);
    if (!workspace) throw new Error(`workspace ${workspaceId} is gone`);
    const k = wsKeys(workspaceId);
    const src = await hostStorage.getMany({
      rules: k.rules,
      collections: k.collections,
      folders: k.folders,
      requests: k.requests,
      grpcRequests: k.grpcRequests,
      websocketRequests: k.websocketRequests,
      requestCollections: k.requestCollections,
      requestFolders: k.requestFolders,
      templates: k.templates,
      templateCollections: k.templateCollections,
      templateFolders: k.templateFolders,
      environments: k.environments,
      workspaceVars: k.workspaceVars,
      vault: k.vault,
      specs: k.specs,
      liveWorkflows: k.liveWorkflows,
      liveVariables: k.liveVariables,
    });
    return {
      workspace,
      rules: src.rules ?? [],
      collections: src.collections ?? [],
      folders: src.folders ?? [],
      requests: src.requests ?? [],
      grpcRequests: src.grpcRequests ?? [],
      websocketRequests: src.websocketRequests ?? [],
      requestCollections: src.requestCollections ?? [],
      requestFolders: src.requestFolders ?? [],
      templates: src.templates ?? [],
      templateCollections: src.templateCollections ?? [],
      templateFolders: src.templateFolders ?? [],
      environments: src.environments ?? [],
      workspaceVariables: src.workspaceVars ?? null,
      vault: src.vault ?? null,
      specs: src.specs ?? [],
      liveWorkflows: src.liveWorkflows ?? [],
      liveVariables: src.liveVariables ?? [],
    };
  };

  const enqueue = (binding: OpenBinding, op: () => Promise<void>): void => {
    binding.chain = binding.chain.then(op, op).catch((err: unknown) => {
      logger.warn(SCOPE, `tree op failed for ${binding.record.rootDir}`, err);
    });
  };

  const applyAll = async (service: WorkspaceServiceState, batches: EmissionBatch[]): Promise<void> => {
    for (const { label, batch, sideEffects } of batches) {
      const result = await service.oracle.apply(batch, sideEffects);
      if (!result.ok) {
        logger.warn(SCOPE, `tree batch ${label} rejected (${result.failure?.status ?? 'unknown'})`);
      }
    }
  };

  /**
   * §3.3 in-progress-op hold: while `.git/` carries a rebase/merge/
   * cherry-pick/bisect marker, reconcile passes stand down (a mid-op
   * tree with conflict markers must never be ingested) and a retry
   * timer re-checks until the operation concludes.
   */
  const heldByGitOperation = async (binding: OpenBinding): Promise<boolean> => {
    const marker = await gitOperationInProgress(binding.record.rootDir);
    if (marker === null) return false;
    logger.info(SCOPE, `reconcile held for ${binding.record.rootDir}: ${marker} in progress`);
    if (!binding.closed && binding.holdRetryTimer === null) {
      binding.holdRetryTimer = setTimeout(() => {
        binding.holdRetryTimer = null;
        enqueue(binding, async () => {
          await runSweep(binding);
          await binding.materializer.flush();
          await publishGitStatus(binding);
        });
      }, OP_HOLD_RETRY_MS);
    }
    return true;
  };

  const runSweep = async (binding: OpenBinding): Promise<SweepWorkspaceTreeResult | null> => {
    if (binding.closed) return null;
    if (await heldByGitOperation(binding)) return null;
    const { service, record } = binding;
    await service.hydrated;
    const snapshot = await buildSnapshot(record.workspaceId);
    const result = await sweepWorkspaceTree({
      rootDir: record.rootDir,
      workspaceUid: record.workspaceId,
      snapshot,
      nextCtx: (): MutatorContext => service.context.next({ surfaceId: TREE_SURFACE_ID }),
      liveSetEntries: (entityType, id, setPath) =>
        service.oracle
          .liveOrderedSetItems(entityType, id, setPath)
          .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      apply: (batches) => applyAll(service, batches),
    });
    if (result.ok) {
      binding.issues = result.issues;
      if (result.applied > 0 || result.changed > 0 || result.removed > 0) {
        logger.info(
          SCOPE,
          `sweep ${record.rootDir}: ${result.applied} batches (${result.changed} changed, ${result.removed} removed, ${result.issues.length} issues)`,
        );
      }
    } else {
      binding.issues = result.issues;
      logger.warn(SCOPE, `sweep refused for ${record.rootDir}: ${result.reason}`);
    }
    return result;
  };

  /** Merge refusal issues into the feed, path-deduped — refused passes explain bytes that never reached the tree. */
  const appendIssues = (binding: OpenBinding, issues: readonly TreeIssue[]): void => {
    if (issues.length === 0) return;
    const known = new Set(binding.issues.map((issue) => issue.path));
    binding.issues = [...binding.issues, ...issues.filter((issue) => !known.has(issue.path))];
  };

  /**
   * Re-derive the issue feed from the tree on disk after a successful
   * integrate pass. Quarantined foreign bytes live in the worktree, so
   * the honest local read re-reports them — and a foreign file that
   * now parses clean drops its stale row on the very gesture that
   * integrated the fix, instead of lingering until the next sweep.
   */
  const refreshIssuesFromDisk = async (binding: OpenBinding): Promise<void> => {
    binding.issues = (await readWorkspaceTreeFromDisk(binding.record.rootDir)).issues;
  };

  const scheduleMaterialize = (binding: OpenBinding): void => {
    if (binding.closed) return;
    if (binding.materializeTimer) clearTimeout(binding.materializeTimer);
    binding.materializeTimer = setTimeout(() => {
      binding.materializeTimer = null;
      enqueue(binding, async () => {
        await binding.materializer.flush();
        await publishGitStatus(binding);
      });
    }, MATERIALIZE_DEBOUNCE_MS);
  };

  /** The synthetic fallback for commits nothing in git config covers (§11.3). */
  const syntheticIdentity = (): { name: string; email: null } => ({
    name: getIdentitySnapshot()?.user.displayName ?? 'OpenHeaders',
    email: null,
  });

  /** Drain the pending-work ledgers together — intents and contributors describe the same batch set. */
  const drainIntents = (binding: OpenBinding): void => {
    binding.intents = [];
    binding.contributors.clear();
  };

  /**
   * Resolve the pending contributors to git-author identities (§23.6).
   * Unresolvable users drop silently — their work stays under the
   * operator author, which is the honest remainder.
   */
  const resolveContributors = async (binding: OpenBinding): Promise<CommitUserAttribution[]> => {
    const resolve = options.resolveUserAttribution;
    if (!resolve || binding.contributors.size === 0) return [];
    const resolved: CommitUserAttribution[] = [];
    for (const userId of binding.contributors) {
      try {
        const attribution = await resolve(userId);
        if (attribution !== null) resolved.push(attribution);
      } catch (err) {
        logger.warn(SCOPE, `attribution resolve failed for user ${userId}`, err);
      }
    }
    return resolved;
  };

  const notBoundStatus = (): WorkspaceTreeGitStatusRpcResult => ({
    bound: false,
    git: { available: false, reason: 'missing' },
    repo: false,
    branch: null,
    branches: [],
    dirtyFiles: null,
    userIndexBusy: false,
    suggestedMessage: '',
    cadence: 'off',
    bypassHooks: false,
    upstream: null,
    ahead: null,
    behind: null,
    autoPushOnCommit: false,
    forcePush: null,
  });

  /** The current branch's §16 watermark; undefined before the first sync on that branch. */
  const watermarkFor = (binding: OpenBinding, branch: string | null): string | undefined =>
    branch === null ? undefined : binding.record.syncedRemoteShas?.[branch];

  /** Record a successful sync (pull/push/resolution) as the current branch's watermark. */
  const recordWatermark = async (binding: OpenBinding, sha: string): Promise<void> => {
    const branch = await currentBranch(gitRun, binding.record.rootDir);
    if (branch === null) return;
    await updateBindingRecord(binding.record.workspaceId, {
      syncedRemoteShas: { ...binding.record.syncedRemoteShas, [branch]: sha },
    });
  };

  /**
   * §16 detection: the current branch's last-integrated remote sha
   * must remain an ancestor of the (fetched) remote head — anything
   * else means the remote history was rewritten since this engine last
   * synced. Null before the first sync on this branch (no watermark)
   * and while at rest.
   */
  const detectForcePush = async (
    binding: OpenBinding,
    branch: string | null,
    upstream: UpstreamState | null,
  ): Promise<{ remoteSha: string; lastSyncedSha: string } | null> => {
    const lastSyncedSha = watermarkFor(binding, branch);
    if (lastSyncedSha === undefined || upstream === null || upstream.sha === lastSyncedSha) return null;
    if (await isAncestorOf(gitRun, binding.record.rootDir, lastSyncedSha, upstream.sha)) return null;
    return { remoteSha: upstream.sha, lastSyncedSha };
  };

  /**
   * Keep the §6.3 per-branch log pointer in step with HEAD — called at
   * bind-open (once the repo exists) and after every checkout, in-app
   * or external. Non-SQLite logs (tests' in-memory doubles) simply
   * don't scope; the pointer is remembered either way so the HEAD
   * watcher can tell a real move from an echo.
   */
  const syncLogBranch = async (binding: OpenBinding): Promise<boolean> => {
    const branch = await currentBranch(gitRun, binding.record.rootDir);
    const changed = branch !== binding.logBranch;
    binding.logBranch = branch;
    if (supportsBranchScope(binding.service.log)) {
      binding.service.log.setActiveBranch(branch ?? '');
    }
    return changed;
  };

  const computeGitStatus = async (binding: OpenBinding): Promise<WorkspaceTreeGitStatusRpcResult> => {
    const { rootDir } = binding.record;
    const cadence = binding.record.commitCadence ?? 'off';
    const bypassHooks = binding.record.bypassHooks === true;
    const autoPushOnCommit = binding.record.autoPushOnCommit === true;
    const git = await ensureGitAvailability(rootDir);
    if (!git.available) {
      return {
        bound: true,
        git,
        repo: false,
        branch: null,
        branches: [],
        dirtyFiles: null,
        userIndexBusy: false,
        suggestedMessage: composeCommitMessage(binding.intents),
        cadence,
        bypassHooks,
        upstream: null,
        ahead: null,
        behind: null,
        autoPushOnCommit,
        forcePush: null,
      };
    }
    const repo = await isWorkspaceRepo(gitRun, rootDir);
    const branch = repo ? await currentBranch(gitRun, rootDir) : null;
    const upstream = repo ? await resolveUpstream(gitRun, rootDir) : null;
    return {
      bound: true,
      git,
      repo,
      branch,
      branches: repo ? await listLocalBranches(gitRun, rootDir) : [],
      dirtyFiles: repo ? await countDirtyFiles(gitRun, rootDir) : null,
      userIndexBusy: repo ? await userIndexHasStagedChanges(gitRun, rootDir) : false,
      suggestedMessage: composeCommitMessage(binding.intents),
      cadence,
      bypassHooks,
      upstream: upstream?.upstream ?? null,
      ahead: upstream?.ahead ?? null,
      behind: upstream?.behind ?? null,
      autoPushOnCommit,
      forcePush: repo ? await detectForcePush(binding, branch, upstream) : null,
    };
  };

  /**
   * One history read (§9, Phase 7) — pure repo reads off the chain,
   * like `gitStatus` (log never mutates, so it never queues behind a
   * commit/pull pass).
   */
  const runLog = async (
    workspaceId: string,
    read: (rootDir: string, limit: number) => Promise<CommitLogEntry[] | null>,
    limit?: number,
    ref?: string,
  ): Promise<WorkspaceTreeLogRpcResult> => {
    const binding = open.get(workspaceId);
    if (!binding) return { ok: false, reason: 'not-bound' };
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    if (ref !== undefined) {
      // A caller-supplied scope must be a ref NAME the tree lists —
      // never a revision expression (no `..`, no flags, §9 slice 2).
      if (!isSafeRefName(ref)) return { ok: false, reason: 'unknown-ref' };
      const refs = await listRepoRefs(gitRun, rootDir);
      if (refs === null || !refs.some((repoRef) => repoRef.name === ref)) {
        return { ok: false, reason: 'unknown-ref' };
      }
    }
    const capped = Math.min(Math.max(1, Math.floor(limit ?? LOG_DEFAULT_LIMIT)), LOG_MAX_LIMIT);
    const entries = await read(rootDir, capped);
    if (entries === null) return { ok: false, reason: 'log-failed' };
    return { ok: true, entries };
  };

  /** Console-tab read: this binding's slice of the audit ring (cwd inside its root). */
  const runGitConsole = async (workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult> => {
    const binding = open.get(workspaceId);
    if (!binding) return { ok: false, reason: 'not-bound' };
    const { rootDir } = binding.record;
    return {
      ok: true,
      rows: consoleRows.filter((row) => row.cwd === rootDir || row.cwd.startsWith(`${rootDir}/`)),
    };
  };

  /**
   * The one status READ path (§9): the cached frame when the world
   * hasn't moved since the last compute, else one shared recompute.
   * Every consumer — the `gitStatus` RPC, the refs rail's `current`,
   * the debounced sink below — reads through here, so a burst of
   * surfaces mounting costs at most one porcelain spawn cluster.
   */
  const readGitStatus = (binding: OpenBinding): Promise<WorkspaceTreeGitStatusRpcResult> =>
    binding.status.read(() => computeGitStatus(binding));

  /**
   * Live git-slot feed (§9) — called after every pass that can move
   * `git status` and on setting changes; the ONE invalidation point of
   * the status authority. Invalidates the snapshot immediately (so any
   * reader from here on recomputes against the post-movement world),
   * then hands the sink a frame on the trailing debounce, deduplicated
   * by frame hash — the same discipline as the extension's rule
   * updates: a bind/sweep/flush burst emits at most one frame, and a
   * recompute that lands on identical status stays silent.
   */
  const publishGitStatus = async (binding: OpenBinding): Promise<void> => {
    binding.status.invalidate();
    const sink = options.onGitStatus;
    if (!sink || binding.closed) return;
    if (binding.statusPublishTimer) clearTimeout(binding.statusPublishTimer);
    binding.statusPublishTimer = setTimeout(() => {
      binding.statusPublishTimer = null;
      void (async () => {
        if (binding.closed) return;
        try {
          const status = await readGitStatus(binding);
          const hash = JSON.stringify(status);
          if (hash === binding.lastStatusHash) return;
          binding.lastStatusHash = hash;
          sink(binding.record.workspaceId, status);
        } catch (err) {
          logger.warn(SCOPE, `git status publish failed for ${binding.record.rootDir}`, err);
        }
      })();
    }, STATUS_PUBLISH_DEBOUNCE_MS);
  };

  /**
   * One commit pass — always on the binding's chain (§8 single actor).
   * Flushes the materializer first so the commit sees the latest tree;
   * drains the intent ring only when the commit lands.
   */
  const runCommit = async (binding: OpenBinding, messageOverride?: string): Promise<CommitWorkspaceTreeRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) {
      const repo = await ensureWorkspaceRepo(gitRun, rootDir);
      if (!repo.ok) return { ok: false, reason: 'not-a-repo', detail: repo.detail };
    }
    await binding.materializer.flush();
    const identity = await resolveCommitIdentity(gitRun, rootDir, syntheticIdentity());
    const trimmed = messageOverride?.trim();
    const draft = trimmed !== undefined && trimmed.length > 0 ? trimmed : composeCommitMessage(binding.intents);
    // §23.6: a sole contributing user authors the commit (committer
    // stays the operator); several contributors ride as trailers.
    const attributed = withCommitAttribution(identity.env, draft, await resolveContributors(binding));
    const result = await commitWorkspaceTree({
      run: gitRun,
      rootDir,
      message: attributed.message,
      identityEnv: attributed.env,
      bypassHooks: binding.record.bypassHooks === true,
    });
    if (!result.ok) return { ok: false, reason: result.reason, detail: result.detail };
    drainIntents(binding);
    if (result.committed) {
      logger.info(SCOPE, `committed ${binding.record.rootDir}: ${attributed.message}`);
      return { ok: true, committed: true, sha: result.sha };
    }
    return { ok: true, committed: false };
  };

  /**
   * One background fetch pass (§3.2: fetch always on, non-mutating) —
   * refreshes the remote-tracking ref so ahead/behind is honest, then
   * republishes the status. Skipped without a repo or an upstream;
   * failures (offline, credentials) log and keep the last-known counts.
   */
  const enqueueFetch = (binding: OpenBinding, trigger: string): void => {
    enqueue(binding, async () => {
      const { rootDir } = binding.record;
      const availability = await ensureGitAvailability(rootDir);
      if (!availability.available) return;
      if (!(await isWorkspaceRepo(gitRun, rootDir))) return;
      if ((await resolveUpstream(gitRun, rootDir)) === null) return;
      binding.lastFetchAt = Date.now();
      const fetched = await fetchWorkspaceRemote(gitRun, rootDir);
      if (!fetched.ok) {
        logger.warn(SCOPE, `${trigger} fetch failed for ${rootDir}: ${fetched.detail}`);
        return;
      }
      await publishGitStatus(binding);
    });
  };

  /**
   * One pull pass — always on the binding's chain (§8 single actor).
   * Local uncommitted work commits FIRST under its own semantic draft
   * (the merge commit stays a pure merge); the intent ring drains with
   * the merge since everything applied is now committed.
   */
  const runPull = async (binding: OpenBinding): Promise<PullWorkspaceTreeRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    if (await heldByGitOperation(binding)) return { ok: false, reason: 'op-in-progress' };
    await binding.service.hydrated;

    const pre = await runCommit(binding);
    if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

    const identity = await resolveCommitIdentity(gitRun, rootDir, syntheticIdentity());
    const pullWatermark = watermarkFor(binding, await currentBranch(gitRun, rootDir));
    const result = await pullWorkspaceTree({
      run: gitRun,
      rootDir,
      workspaceUid: binding.record.workspaceId,
      readSnapshot: () => buildSnapshot(binding.record.workspaceId),
      nextCtx: () => binding.service.context.next({ surfaceId: TREE_SURFACE_ID }),
      liveSetEntries: (entityType, id, setPath) =>
        binding.service.oracle
          .liveOrderedSetItems(entityType, id, setPath)
          .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      apply: (batches) => applyAll(binding.service, batches),
      flush: () => binding.materializer.flush(),
      identityEnv: identity.env,
      bypassHooks: binding.record.bypassHooks === true,
      ...(pullWatermark !== undefined ? { lastSyncedRemoteSha: pullWatermark } : {}),
    });
    binding.lastFetchAt = Date.now();
    if (!result.ok) {
      appendIssues(binding, result.issues);
      return { ok: false, reason: result.reason, detail: result.detail };
    }
    await refreshIssuesFromDisk(binding);
    // §16 watermark: this remote head is now integrated — the next
    // fetch compares ancestry against it.
    await recordWatermark(binding, result.remoteSha);
    if (result.upToDate) return { ok: true, upToDate: true };
    drainIntents(binding);
    logger.info(SCOPE, `pulled ${rootDir}: merge ${result.sha} (${result.applied} batches)`);
    return { ok: true, upToDate: false, sha: result.sha, applied: result.applied };
  };

  /**
   * One push pass — always on the binding's chain. Push is only ever
   * this explicit gesture or the auto-push-on-commit opt-in (§3.2);
   * a detected history rewrite refuses until the §16 trichotomy
   * resolves it.
   */
  const runPush = async (binding: OpenBinding): Promise<PushWorkspaceTreeRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    const pushBranch = await currentBranch(gitRun, rootDir);
    const rewrite = await detectForcePush(binding, pushBranch, await resolveUpstream(gitRun, rootDir));
    if (rewrite !== null) return { ok: false, reason: 'force-push', detail: rewrite.remoteSha };
    const result = await pushWorkspaceBranch(gitRun, rootDir);
    if (!result.ok) return result;
    await recordWatermark(binding, result.remoteSha);
    if (result.pushed) logger.info(SCOPE, `pushed ${rootDir}: ${result.remoteSha}`);
    return result;
  };

  /** The auto-push-on-commit opt-in — rides a successful commit pass; failures log, never block. */
  const maybeAutoPush = async (binding: OpenBinding): Promise<void> => {
    if (binding.record.autoPushOnCommit !== true) return;
    const result = await runPush(binding);
    if (!result.ok) logger.warn(SCOPE, `auto-push failed for ${binding.record.rootDir}: ${result.reason}`);
  };

  /**
   * One §16 resolution pass — always on the binding's chain. Local
   * uncommitted work commits first (under its own semantic draft) so
   * every choice — including the rescue branch — operates on complete
   * local material; the watermark advances to the accepted head.
   */
  const runResolveForcePush = async (
    binding: OpenBinding,
    choice: ForcePushChoice,
  ): Promise<ResolveForcePushRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    const lastSyncedSha = watermarkFor(binding, await currentBranch(gitRun, rootDir));
    if (lastSyncedSha === undefined) return { ok: false, reason: 'not-rewritten' };
    await binding.service.hydrated;

    const pre = await runCommit(binding);
    if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

    const identity = await resolveCommitIdentity(gitRun, rootDir, syntheticIdentity());
    const result = await resolveForcePushWorkspaceTree({
      run: gitRun,
      rootDir,
      choice,
      workspaceUid: binding.record.workspaceId,
      lastSyncedRemoteSha: lastSyncedSha,
      readSnapshot: () => buildSnapshot(binding.record.workspaceId),
      nextCtx: () => binding.service.context.next({ surfaceId: TREE_SURFACE_ID }),
      liveSetEntries: (entityType, id, setPath) =>
        binding.service.oracle
          .liveOrderedSetItems(entityType, id, setPath)
          .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      apply: (batches) => applyAll(binding.service, batches),
      flush: () => binding.materializer.flush(),
      identityEnv: identity.env,
      bypassHooks: binding.record.bypassHooks === true,
    });
    binding.lastFetchAt = Date.now();
    if (!result.ok) {
      appendIssues(binding, result.issues);
      return { ok: false, reason: result.reason, detail: result.detail };
    }
    await refreshIssuesFromDisk(binding);
    drainIntents(binding);
    await recordWatermark(binding, result.remoteSha);
    logger.info(SCOPE, `force-push resolved (${choice}) for ${rootDir}: ${result.sha}`);
    return { ok: true, sha: result.sha, rescueBranch: result.rescueBranch };
  };

  /**
   * One branch-switch pass — always on the binding's chain (§8). The
   * wrapped checkout runs with the user's §6.2 answer; a successful
   * switch flips the §6.3 log pointer, then converges the engine to
   * the new branch's tree through the same rung-2 tree-wins sweep an
   * external checkout takes (a bare HEAD move between identical trees
   * sweeps as a no-op via the hashed baseline).
   */
  const runSwitchBranch = async (
    binding: OpenBinding,
    branch: string,
    dirtyAction?: SwitchDirtyAction,
  ): Promise<SwitchBranchRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    await binding.service.hydrated;
    const result = await switchWorkspaceBranch({
      run: gitRun,
      rootDir,
      branch,
      ...(dirtyAction !== undefined ? { dirtyAction } : {}),
      commit: async () => {
        const committed = await runCommit(binding);
        if (committed.ok && committed.committed) await maybeAutoPush(binding);
        return committed.ok ? { ok: true } : { ok: false, detail: committed.detail ?? committed.reason };
      },
    });
    if (!result.ok) return result;
    if (result.switched) {
      // Stash/discard emptied the tree's uncommitted delta and the
      // sweep below re-derives engine state from the new branch — the
      // old branch's pending intents describe mutations that are no
      // longer this branch's story.
      drainIntents(binding);
      await syncLogBranch(binding);
      await runSweep(binding);
      await binding.materializer.flush();
      logger.info(SCOPE, `switched ${rootDir} to ${branch}`);
    }
    return result;
  };

  /** One create-branch pass — `checkout -b` at HEAD; only HEAD moves, so no sweep is needed. */
  const runCreateBranch = async (binding: OpenBinding, branch: string): Promise<CreateBranchRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    const created = await createAndSwitchBranch(gitRun, rootDir, branch);
    if (!created.ok) return { ok: false, reason: 'create-failed', detail: created.detail };
    await syncLogBranch(binding);
    logger.info(SCOPE, `created branch ${branch} at ${rootDir}`);
    return { ok: true, branch };
  };

  /**
   * One branch-merge pass — always on the binding's chain. Local
   * uncommitted work commits FIRST under its own semantic draft
   * (exactly like pull: the merge commit stays a pure merge); the
   * watermark is untouched — merging a local ref is not a remote sync.
   */
  const runMergeBranch = async (binding: OpenBinding, ref: string): Promise<MergeBranchRpcResult> => {
    const { rootDir } = binding.record;
    const availability = await ensureGitAvailability(rootDir);
    if (!availability.available) return { ok: false, reason: 'git-unavailable' };
    if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
    if (await heldByGitOperation(binding)) return { ok: false, reason: 'op-in-progress' };
    await binding.service.hydrated;

    const pre = await runCommit(binding);
    if (!pre.ok) return { ok: false, reason: 'commit-failed', detail: pre.detail ?? pre.reason };

    const identity = await resolveCommitIdentity(gitRun, rootDir, syntheticIdentity());
    const result = await mergeWorkspaceBranch({
      run: gitRun,
      rootDir,
      ref,
      workspaceUid: binding.record.workspaceId,
      readSnapshot: () => buildSnapshot(binding.record.workspaceId),
      nextCtx: () => binding.service.context.next({ surfaceId: TREE_SURFACE_ID }),
      liveSetEntries: (entityType, id, setPath) =>
        binding.service.oracle
          .liveOrderedSetItems(entityType, id, setPath)
          .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      apply: (batches) => applyAll(binding.service, batches),
      flush: () => binding.materializer.flush(),
      identityEnv: identity.env,
      bypassHooks: binding.record.bypassHooks === true,
    });
    if (!result.ok) {
      appendIssues(binding, result.issues);
      return { ok: false, reason: result.reason, detail: result.detail };
    }
    if (result.upToDate) return { ok: true, upToDate: true };
    await refreshIssuesFromDisk(binding);
    drainIntents(binding);
    logger.info(SCOPE, `merged ${ref} into ${rootDir}: ${result.sha} (${result.applied} batches)`);
    return { ok: true, upToDate: false, sha: result.sha, applied: result.applied };
  };

  /**
   * One automated commit pass, shared by every cadence trigger
   * (quiescence, blur, interval): pauses while the user's own index is
   * non-empty (§3.3), then runs the ordinary commit path (no-op trees
   * never produce empty commits).
   */
  const enqueueAutoCommit = (binding: OpenBinding, trigger: string): void => {
    enqueue(binding, async () => {
      const availability = await ensureGitAvailability(binding.record.rootDir);
      if (!availability.available) return;
      if (
        (await isWorkspaceRepo(gitRun, binding.record.rootDir)) &&
        (await userIndexHasStagedChanges(gitRun, binding.record.rootDir))
      ) {
        logger.info(SCOPE, `${trigger} commit paused for ${binding.record.rootDir}: user index is non-empty`);
        return;
      }
      const result = await runCommit(binding);
      if (!result.ok) logger.warn(SCOPE, `${trigger} commit failed for ${binding.record.rootDir}: ${result.reason}`);
      else if (result.committed) await maybeAutoPush(binding);
      await publishGitStatus(binding);
    });
  };

  /** Cadence `auto`: commit after quiescence, pausing while the user's index is non-empty (§3.3). */
  const scheduleAutoCommit = (binding: OpenBinding): void => {
    if (binding.closed || (binding.record.commitCadence ?? 'off') !== 'auto') return;
    if (binding.commitTimer) clearTimeout(binding.commitTimer);
    binding.commitTimer = setTimeout(() => {
      binding.commitTimer = null;
      enqueueAutoCommit(binding, 'auto');
    }, COMMIT_QUIESCENCE_MS);
  };

  /**
   * Reconcile the binding's cadence timers with its record — the
   * quiescence timer only ever arms from `scheduleAutoCommit`; the
   * wall-clock interval lives here (`every-Nm`), started on open and
   * on every cadence change, cleared for every other value.
   */
  const applyCadenceTimers = (binding: OpenBinding): void => {
    const cadence = binding.record.commitCadence ?? 'off';
    if (cadence !== 'auto' && binding.commitTimer) {
      clearTimeout(binding.commitTimer);
      binding.commitTimer = null;
    }
    if (binding.commitInterval) {
      clearInterval(binding.commitInterval);
      binding.commitInterval = null;
    }
    const intervalMs = CADENCE_INTERVAL_MS[cadence];
    if (intervalMs !== undefined && !binding.closed) {
      binding.commitInterval = setInterval(() => {
        enqueueAutoCommit(binding, 'interval');
      }, intervalMs);
    }
  };

  const openBinding = async (record: WorkspaceTreeBindingRecord): Promise<OpenBinding> => {
    const service = getOrCreateWorkspaceService(record.workspaceId);
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: record.rootDir,
      readSnapshot: async () => ({
        state: await buildSnapshot(record.workspaceId),
        unknowns: await readTreeUnknownFields(record.rootDir),
      }),
      log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
    });
    let binding: OpenBinding;
    const watcher = new WorkspaceTreeWatcher({
      rootDir: record.rootDir,
      onQuiescence: () =>
        enqueue(binding, async () => {
          await runSweep(binding);
          await binding.materializer.flush();
          await publishGitStatus(binding);
        }),
      log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
    });
    // External checkout trigger (Phase 6): a terminal `git checkout`
    // moves `.git/HEAD`, which the tree watcher deliberately ignores —
    // and a switch between identical trees moves NOTHING else. The
    // HEAD watch re-probes the branch on the chain and runs the same
    // rung-2 sweep an in-app switch runs; echoes of our own wrapped
    // checkout no-op via the pointer comparison.
    const headWatcher = new GitHeadWatcher({
      rootDir: record.rootDir,
      onHeadMove: () =>
        enqueue(binding, async () => {
          if (await syncLogBranch(binding)) {
            drainIntents(binding);
            await runSweep(binding);
            await binding.materializer.flush();
            logger.info(SCOPE, `external checkout reconciled for ${record.rootDir}: ${binding.logBranch ?? 'HEAD'}`);
          }
          await publishGitStatus(binding);
        }),
      log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
    });
    binding = {
      record,
      service,
      materializer,
      watcher,
      headWatcher,
      logBranch: null,
      chain: Promise.resolve(),
      materializeTimer: null,
      commitTimer: null,
      commitInterval: null,
      fetchInterval: null,
      lastFetchAt: 0,
      holdRetryTimer: null,
      statusPublishTimer: null,
      lastStatusHash: null,
      status: new StatusCache(),
      intents: [],
      contributors: new Set(),
      issues: [],
      closed: false,
    };
    open.set(record.workspaceId, binding);
    watcher.start();
    applyCadenceTimers(binding);
    // Background fetch (§3.2): ~5m interval + one pass at open so the
    // ahead/behind affordance lights without waiting a cycle.
    binding.fetchInterval = setInterval(() => {
      enqueueFetch(binding, 'interval');
    }, FETCH_INTERVAL_MS);
    enqueueFetch(binding, 'open');
    // Phase 3: a bound folder is a REPO. Adopt an existing `.git` or
    // init a fresh one; missing git disables only the git plane (§7).
    enqueue(binding, async () => {
      const availability = await ensureGitAvailability(record.rootDir);
      if (!availability.available) {
        logger.warn(SCOPE, `git plane disabled for ${record.rootDir}: ${availability.reason}`);
        return;
      }
      const repo = await ensureWorkspaceRepo(gitRun, record.rootDir);
      if (!repo.ok) logger.warn(SCOPE, `repo init failed for ${record.rootDir}: ${repo.detail}`);
      else if (repo.initialized) logger.info(SCOPE, `initialized repo at ${record.rootDir}`);
      if (repo.ok) {
        // §6.3: point the per-branch log at HEAD's branch before any
        // batch lands, and arm the external-checkout trigger.
        await syncLogBranch(binding);
        binding.headWatcher.start();
      }
      await publishGitStatus(binding);
    });
    return binding;
  };

  const closeBinding = async (binding: OpenBinding): Promise<void> => {
    binding.closed = true;
    binding.watcher.dispose();
    binding.headWatcher.dispose();
    if (binding.materializeTimer) {
      clearTimeout(binding.materializeTimer);
      binding.materializeTimer = null;
    }
    if (binding.commitTimer) {
      clearTimeout(binding.commitTimer);
      binding.commitTimer = null;
    }
    if (binding.commitInterval) {
      clearInterval(binding.commitInterval);
      binding.commitInterval = null;
    }
    if (binding.fetchInterval) {
      clearInterval(binding.fetchInterval);
      binding.fetchInterval = null;
    }
    if (binding.holdRetryTimer) {
      clearTimeout(binding.holdRetryTimer);
      binding.holdRetryTimer = null;
    }
    if (binding.statusPublishTimer) {
      clearTimeout(binding.statusPublishTimer);
      binding.statusPublishTimer = null;
    }
    binding.materializer.dispose();
    await binding.chain;
    open.delete(binding.record.workspaceId);
    releaseWorkspaceService(binding.record.workspaceId);
  };

  return {
    async start(): Promise<void> {
      records = (await hostStorage.get(OH.workspaceTreeBindings)) ?? [];
      for (const record of records) {
        const workspace = await workspaceEntity(record.workspaceId);
        if (!workspace) {
          logger.warn(SCOPE, `binding for unknown workspace ${record.workspaceId} skipped (${record.rootDir})`);
          continue;
        }
        const bound = await bindWorkspaceTree({
          rootDir: record.rootDir,
          workspace,
          knownWorkspaceUids: listWorkspaces()
            .map((ws) => ws.id)
            .filter((id) => id !== record.workspaceId),
          hostId: options.hostId,
        });
        if (!bound.ok) {
          logger.warn(SCOPE, `re-bind refused for ${record.rootDir}: ${bound.reason}`);
          continue;
        }
        try {
          const binding = await openBinding(record);
          // §11.2 MANDATORY cold-boot tree-wins sweep, then a materialize
          // pass so engine-side changes made while unbound land on disk.
          enqueue(binding, async () => {
            await runSweep(binding);
            await binding.materializer.flush();
            await publishGitStatus(binding);
          });
        } catch (err) {
          logger.warn(SCOPE, `binding open failed for ${record.rootDir}`, err);
        }
      }
    },

    onSyncEvent(event: OracleSyncBroadcastEvent): void {
      if (disposed) return;
      const binding = open.get(event.envelope.workspaceId);
      if (!binding) return;
      scheduleMaterialize(binding);
      const { body, origin } = event.envelope;
      if (binding.intents.length < MAX_PENDING_INTENTS) {
        binding.intents.push({ kind: body.kind, entityType: body.type, entityId: body.id });
      }
      // §23.6: the ingest-stamped credential userId — absent on
      // locally-minted batches (the operator's own work needs no entry).
      if (origin.userId !== undefined) binding.contributors.add(origin.userId);
      scheduleAutoCommit(binding);
    },

    async bind(workspaceId: string, rootDir: string): Promise<BindWorkspaceTreeRpcResult> {
      if (records.some((record) => record.workspaceId === workspaceId)) {
        return { ok: false, reason: 'already-bound' };
      }
      const workspace = await workspaceEntity(workspaceId);
      if (!workspace) return { ok: false, reason: 'unknown-workspace' };
      const bound = await bindWorkspaceTree({
        rootDir,
        workspace,
        knownWorkspaceUids: listWorkspaces()
          .map((ws) => ws.id)
          .filter((id) => id !== workspaceId),
        hostId: options.hostId,
      });
      if (!bound.ok) return bound;

      const record: WorkspaceTreeBindingRecord = { workspaceId, rootDir };
      records = [...records, record];
      await persistRecords();
      const binding = await openBinding(record);

      // The same open ritual as start(): tree wins first, then the
      // engine materializes what the tree lacks.
      let sweep: SweepWorkspaceTreeResult | null = null;
      enqueue(binding, async () => {
        sweep = await runSweep(binding);
        await binding.materializer.flush();
        await publishGitStatus(binding);
      });
      await binding.chain;
      return { ok: true, initialized: bound.initialized, sweep };
    },

    async unbind(workspaceId: string): Promise<{ ok: boolean }> {
      const binding = open.get(workspaceId);
      if (binding) await closeBinding(binding);
      const record = records.find((entry) => entry.workspaceId === workspaceId);
      records = records.filter((entry) => entry.workspaceId !== workspaceId);
      await persistRecords();
      if (record) {
        await unbindWorkspaceTree(record.rootDir, options.hostId);
        options.onGitStatus?.(workspaceId, notBoundStatus());
      }
      return { ok: record !== undefined };
    },

    probe(rootDir: string): ReturnType<typeof probeWorkspaceTree> {
      return probeWorkspaceTree(rootDir);
    },

    async commit(workspaceId: string, message?: string): Promise<CommitWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: CommitWorkspaceTreeRpcResult = {
        ok: false,
        reason: 'commit-failed',
        detail: 'commit pass did not run',
      };
      enqueue(binding, async () => {
        result = await runCommit(binding, message);
        if (result.ok && result.committed) await maybeAutoPush(binding);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async pull(workspaceId: string): Promise<PullWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: PullWorkspaceTreeRpcResult = {
        ok: false,
        reason: 'fetch-failed',
        detail: 'pull pass did not run',
      };
      enqueue(binding, async () => {
        result = await runPull(binding);
        if (result.ok && !result.upToDate) await maybeAutoPush(binding);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async push(workspaceId: string): Promise<PushWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: PushWorkspaceTreeRpcResult = {
        ok: false,
        reason: 'push-failed',
        detail: 'push pass did not run',
      };
      enqueue(binding, async () => {
        result = await runPush(binding);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async pushNewBranch(workspaceId: string, branch: string): Promise<PushWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: PushWorkspaceTreeRpcResult = {
        ok: false,
        reason: 'push-failed',
        detail: 'push pass did not run',
      };
      enqueue(binding, async () => {
        const availability = await ensureGitAvailability(binding.record.rootDir);
        if (!availability.available) {
          result = { ok: false, reason: 'git-unavailable' };
          return;
        }
        if (!(await isWorkspaceRepo(gitRun, binding.record.rootDir))) {
          result = { ok: false, reason: 'not-a-repo' };
          return;
        }
        result = await pushHeadToNewBranch(gitRun, binding.record.rootDir, branch);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async setAutoPushOnCommit(workspaceId: string, autoPushOnCommit: boolean): Promise<{ ok: boolean }> {
      const next = await updateBindingRecord(workspaceId, { autoPushOnCommit });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) await publishGitStatus(binding);
      return { ok: true };
    },

    async resolveForcePush(workspaceId: string, choice: ForcePushChoice): Promise<ResolveForcePushRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: ResolveForcePushRpcResult = {
        ok: false,
        reason: 'fetch-failed',
        detail: 'resolution pass did not run',
      };
      enqueue(binding, async () => {
        result = await runResolveForcePush(binding, choice);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async switchBranch(
      workspaceId: string,
      branch: string,
      dirtyAction?: SwitchDirtyAction,
    ): Promise<SwitchBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: SwitchBranchRpcResult = {
        ok: false,
        reason: 'checkout-failed',
        detail: 'switch pass did not run',
      };
      enqueue(binding, async () => {
        result = await runSwitchBranch(binding, branch, dirtyAction);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async createBranch(workspaceId: string, branch: string): Promise<CreateBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: CreateBranchRpcResult = {
        ok: false,
        reason: 'create-failed',
        detail: 'create pass did not run',
      };
      enqueue(binding, async () => {
        result = await runCreateBranch(binding, branch);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    async mergeBranch(workspaceId: string, ref: string): Promise<MergeBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      let result: MergeBranchRpcResult = {
        ok: false,
        reason: 'commit-failed',
        detail: 'merge pass did not run',
      };
      enqueue(binding, async () => {
        result = await runMergeBranch(binding, ref);
        if (result.ok && !result.upToDate) await maybeAutoPush(binding);
        await publishGitStatus(binding);
      });
      await binding.chain;
      return result;
    },

    notifyAppFocus(): void {
      if (disposed) return;
      for (const binding of open.values()) {
        if (Date.now() - binding.lastFetchAt < FETCH_FOCUS_MIN_MS) continue;
        enqueueFetch(binding, 'focus');
      }
    },

    async gitStatus(workspaceId: string): Promise<WorkspaceTreeGitStatusRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return notBoundStatus();
      return readGitStatus(binding);
    },

    async log(workspaceId: string, limit?: number, ref?: string): Promise<WorkspaceTreeLogRpcResult> {
      return runLog(workspaceId, (rootDir, capped) => listCommitLog(gitRun, rootDir, capped, ref), limit, ref);
    },

    async fileLog(workspaceId: string, filePath: string, limit?: number): Promise<WorkspaceTreeLogRpcResult> {
      if (filePath.length === 0) return { ok: false, reason: 'log-failed', detail: 'empty path' };
      return runLog(workspaceId, (rootDir, capped) => listFileLog(gitRun, rootDir, filePath, capped), limit);
    },

    async listRefs(workspaceId: string): Promise<WorkspaceTreeRefsRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      const { rootDir } = binding.record;
      const availability = await ensureGitAvailability(rootDir);
      if (!availability.available) return { ok: false, reason: 'git-unavailable' };
      if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
      const refs = await listRepoRefs(gitRun, rootDir);
      if (refs === null) return { ok: false, reason: 'refs-failed' };
      // `current` comes from the status authority, not a fresh spawn —
      // HEAD moves invalidate it (head watcher, switch, checkout), so
      // the two reads stay coherent by construction.
      return { ok: true, refs, current: (await readGitStatus(binding)).branch };
    },

    async fileDiff(workspaceId: string, sha: string, filePath: string): Promise<WorkspaceTreeFileDiffRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      const { rootDir } = binding.record;
      const availability = await ensureGitAvailability(rootDir);
      if (!availability.available) return { ok: false, reason: 'git-unavailable' };
      if (!(await isWorkspaceRepo(gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
      // Same posture as the ref-scoped log: caller-supplied targets are
      // validated shapes, never revision expressions (§9 slice 2/3).
      if (!isCommitSha(sha)) return { ok: false, reason: 'unknown-commit' };
      if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
      return readCommitFileDiff(gitRun, rootDir, sha, filePath);
    },

    gitConsole(workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult> {
      return runGitConsole(workspaceId);
    },

    async setCommitCadence(workspaceId: string, cadence: WorkspaceTreeCommitCadence): Promise<{ ok: boolean }> {
      const next = await updateBindingRecord(workspaceId, { commitCadence: cadence });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) {
        applyCadenceTimers(binding);
        await publishGitStatus(binding);
      }
      return { ok: true };
    },

    async setBypassHooks(workspaceId: string, bypassHooks: boolean): Promise<{ ok: boolean }> {
      const next = await updateBindingRecord(workspaceId, { bypassHooks });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) await publishGitStatus(binding);
      return { ok: true };
    },

    notifyAppBlur(): void {
      if (disposed) return;
      for (const binding of open.values()) {
        if ((binding.record.commitCadence ?? 'off') === 'on-blur') enqueueAutoCommit(binding, 'blur');
      }
    },

    list(): WorkspaceTreeBindingRecord[] {
      return [...records];
    },

    issues(workspaceId: string): TreeIssue[] {
      return open.get(workspaceId)?.issues ?? [];
    },

    async dispose(): Promise<void> {
      disposed = true;
      for (const binding of [...open.values()]) {
        await closeBinding(binding);
        await unbindWorkspaceTree(binding.record.rootDir, options.hostId);
      }
    },
  };
}

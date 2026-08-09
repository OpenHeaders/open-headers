/**
 * Workspace-tree runtime — public surface types: the runtime interface,
 * its options, and every gesture verb's typed result. Pure types; the
 * behavior lives in the `runtime-*` pass modules composed by
 * `runtime.ts`.
 */

import type { WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import type { TreeIssue } from '@openheaders/core/workspace-tree';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import type {
  CommitFileDiff,
  CommitLogEntry,
  CommitUserAttribution,
  GitAuditRow,
  GitAvailability,
  GitRunner,
  RepoRef,
} from '../../git';
import type { BindWorkspaceTreeResult, probeWorkspaceTree } from '../bind';
import type { ForcePushChoice } from '../force-push';
import type { SweepWorkspaceTreeResult } from '../sweep';
import type { SwitchDirtyAction } from '../switch';

export type WorkspaceTreeCommitCadence = 'off' | 'auto' | 'on-blur' | 'every-5m' | 'every-15m' | 'every-30m';

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

/** Options of the create-branch gesture (§6 / IDE-log activity bar). */
export interface CreateBranchOptions {
  /**
   * Start point: a ref NAME from `listRefs` or a FULL commit sha (the
   * delete-toast Restore path). Absent anchors at HEAD.
   */
  from?: string;
  /** Check the new branch out (`checkout -b/-B`); default true — the
   *  historic `createBranch` behavior. */
  checkout?: boolean;
  /** Reset an existing branch to the start point (`-B` / `branch -f`);
   *  refused for the current branch. */
  overwrite?: boolean;
}

export type CreateBranchRpcResult =
  | { ok: true; branch: string; checkedOut: boolean }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'unknown-ref'
        | 'exists'
        | 'current-branch'
        | 'create-failed';
      detail?: string;
    };

export type DeleteBranchRpcResult =
  | { ok: true; branch: string; sha: string }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-branch' | 'current-branch' | 'delete-failed';
      detail?: string;
    };

export type UpdateBranchRpcResult =
  | { ok: true; branch: string }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'unknown-branch'
        | 'current-branch'
        | 'no-upstream'
        | 'update-failed';
      detail?: string;
    };

export type FetchWorkspaceTreeRpcResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'no-remote' | 'fetch-failed';
      detail?: string;
    };

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

/** The Compare-with-Current answer (§9 IDE-log): both exclusive sides. */
export type CompareRefsRpcResult =
  | { ok: true; current: string; ref: string; onlyInCurrent: CommitLogEntry[]; onlyInRef: CommitLogEntry[] }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'detached-head' | 'unknown-ref' | 'compare-failed';
      detail?: string;
    };

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
  /**
   * Create a branch (IDE-log New Branch dialog): start point `from`
   * (ref name or full sha; HEAD when absent), optional checkout
   * (default true — dirty work rides along like `checkout -b`),
   * optional overwrite (`-B` / `branch -f`; the current branch
   * refuses).
   */
  createBranch(workspaceId: string, branch: string, options?: CreateBranchOptions): Promise<CreateBranchRpcResult>;
  /**
   * Delete a LOCAL branch (`git branch -d` — merged-only, git itself
   * refuses unmerged work). The current branch refuses; the answered
   * sha feeds the Restore affordance.
   */
  deleteBranch(workspaceId: string, branch: string): Promise<DeleteBranchRpcResult>;
  /**
   * Update Selected (IDE-log): fast-forward a NON-current local branch
   * from its own upstream (`fetch <remote> <src>:<branch> --prune` —
   * never a working-tree touch). The current branch refuses — its
   * update is the pull gesture.
   */
  updateBranch(workspaceId: string, branch: string): Promise<UpdateBranchRpcResult>;
  /** Explicit Fetch gesture — all remotes, pruned; non-mutating (§3.2). */
  fetch(workspaceId: string): Promise<FetchWorkspaceTreeRpcResult>;
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
   * {@link WorkspaceTreeRuntime.listRefs}'s answer; anything else
   * refuses `unknown-ref`.
   */
  log(workspaceId: string, limit?: number, ref?: string): Promise<WorkspaceTreeLogRpcResult>;
  /** One path's timeline (`--follow`) — the newest entry is "who last touched this". */
  fileLog(workspaceId: string, path: string, limit?: number): Promise<WorkspaceTreeLogRpcResult>;
  /** The log view's ref tree (§9, Phase 7 slice 2) — local branches, remote-tracking refs, tags. */
  listRefs(workspaceId: string): Promise<WorkspaceTreeRefsRpcResult>;
  /**
   * Compare with Current (§9 IDE-log): the two exclusive commit lists
   * between the checked-out branch and a validated ref from
   * `listRefs`. Pure read, off the per-binding chain like `log`.
   */
  compareRefs(workspaceId: string, ref: string): Promise<CompareRefsRpcResult>;
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

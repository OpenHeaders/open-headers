/**
 * Workspace-tree runtime — public surface types: the runtime interface,
 * its options, and every gesture verb's typed result. Pure types; the
 * behavior lives in the `runtime-*` pass modules composed by
 * `runtime.ts`.
 */

import type { WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import type { ForeignHistoryNote, TreeIssue, WorkspaceTreeEntityRef } from '@openheaders/core/workspace-tree';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import type {
  CommitFileDiff,
  CommitLogEntry,
  CommitParentChanges,
  CommitUserAttribution,
  GitAuditRow,
  GitAvailability,
  GitRunner,
  IgnoreTarget,
  RepoRef,
  RepoRemote,
  WorkingChange,
} from '../../git';
import type { BindWorkspaceTreeResult, probeWorkspaceTree, ReserveWorkspaceTreeForAdoptResult } from '../bind';
import type { ApplyCommitResolution, ApplyCommitResolve } from '../change-answers';
import type { CommitFileEntity } from '../commit-entities';
import type { ForcePushChoice } from '../force-push';
import type { SweepWorkspaceTreeResult } from '../sweep';
import type { SwitchDirtyAction } from '../switch';

export type WorkspaceTreeCommitCadence = 'off' | 'auto' | 'on-blur' | 'every-5m' | 'every-15m' | 'every-30m';

export type BindWorkspaceTreeRpcResult =
  | { ok: true; initialized: boolean; sweep: SweepWorkspaceTreeResult | null }
  | { ok: false; reason: 'unknown-workspace' | 'already-bound' }
  | Exclude<BindWorkspaceTreeResult, { ok: true }>;

/**
 * Adopt (§3.5 / §5, gap K): the pre-flight's refusals, the mint's
 * failure, and the ordinary bind's refusal after the mint (an
 * invariant breach — the store holds the workspace, the tree names
 * its uid, the lock is ours — reported, never swallowed).
 */
export type AdoptWorkspaceTreeRpcResult =
  | { ok: true; workspaceId: string; name: string; sweep: SweepWorkspaceTreeResult | null }
  | Exclude<ReserveWorkspaceTreeForAdoptResult, { ok: true }>
  | { ok: false; reason: 'create-failed' | 'bind-failed'; detail: string };

export type CommitWorkspaceTreeRpcResult =
  | { ok: true; committed: boolean; sha?: string }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'stage-failed' | 'index-locked' | 'commit-failed';
      detail?: string;
    };

export type PullWorkspaceTreeRpcResult =
  | { ok: true; upToDate: true }
  | {
      ok: true;
      upToDate: false;
      sha: string;
      applied: number;
      history?: ForeignHistoryNote;
      /** The user's own files both sides changed — the local file stood. */
      keptLocal?: string[];
      /** Files of the pull that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
      /** Parts of the foreign change that were not taken. */
      skipped?: ApplyCommitSkip[];
    }
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
        | 'local-changes'
        | 'conflicts'
        | 'resolution-invalid'
        | 'index-locked'
        | 'commit-failed';
      detail?: string;
      /** `local-changes`: the files the pull would write that hold uncommitted work. */
      localChanges?: string[];
      /** `local-changes`: the pending draft — the message offered for the commit of that work. */
      suggestedMessage?: string;
      /** `conflicts`: the documents both sides changed, then the user's own files. */
      conflicts?: string[];
      /** `conflicts`: the files to answer and the token naming this reading of them. */
      resolve?: ApplyCommitResolve;
      /** `conflicts`: the files' texts are too large to send. */
      tooLarge?: true;
      /** `resolution-invalid`: the answered file that could not be taken. */
      file?: string;
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
  | {
      ok: true;
      sha: string;
      rescueBranch: string | null;
      /** Files of the resolution that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
    }
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
        | 'index-locked'
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

/** The log's New Tag… — a lightweight tag at a full commit sha. */
export type CreateTagRpcResult =
  | { ok: true; name: string; sha: string }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-ref' | 'exists' | 'create-failed';
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

/** One part of a picked or reverted change that was not taken (`CommitChangeSkip`). */
export interface ApplyCommitSkip {
  uid: string;
  path: string;
  reason: 'missing' | 'parent-missing' | 'not-empty' | 'conflict-unshown';
}

/**
 * The person's word that uncommitted work in the files a pass writes (a
 * pick, a revert, a pull, a branch merge) is committed first, under
 * this message.
 */
export interface CommitLocalWork {
  message: string;
}

export type ApplyCommitRpcResult =
  | {
      ok: true;
      sha: string;
      skipped?: ApplyCommitSkip[];
      /** The user's own files both sides changed — the local file stood. */
      keptLocal?: string[];
      /** Files the change wrote that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
    }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'op-in-progress'
        | 'unknown-commit'
        | 'unsupported-commit'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'local-changes'
        | 'conflicts'
        | 'resolution-invalid'
        | 'empty'
        | 'index-locked'
        | 'commit-failed';
      detail?: string;
      /** `local-changes`: the files the change would write that hold uncommitted work. */
      localChanges?: string[];
      /** `local-changes`: the pending draft — the message offered for the commit of that work. */
      suggestedMessage?: string;
      /** `conflicts`: the documents both sides changed, by their path in the commit, then the user's own files. */
      conflicts?: string[];
      /** `conflicts`: the files to answer and the token naming this reading of them. */
      resolve?: ApplyCommitResolve;
      /** `conflicts`: the files' texts are too large to send. */
      tooLarge?: true;
      /** `resolution-invalid`: the answered file that could not be taken. */
      file?: string;
      skipped?: ApplyCommitSkip[];
      keptLocal?: string[];
    };

export type MergeBranchRpcResult =
  | { ok: true; upToDate: true }
  | {
      ok: true;
      upToDate: false;
      sha: string;
      applied: number;
      history?: ForeignHistoryNote;
      /** The user's own files both sides changed — the local file stood. */
      keptLocal?: string[];
      /** Files of the merge that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
      /** Parts of the merged branch's change that were not taken. */
      skipped?: ApplyCommitSkip[];
    }
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
        | 'local-changes'
        | 'conflicts'
        | 'resolution-invalid'
        | 'index-locked'
        | 'commit-failed';
      detail?: string;
      /** `local-changes`: the files the merge would write that hold uncommitted work. */
      localChanges?: string[];
      /** `local-changes`: the pending draft — the message offered for the commit of that work. */
      suggestedMessage?: string;
      /** `conflicts`: the documents both branches changed, then the user's own files. */
      conflicts?: string[];
      /** `conflicts`: the files to answer and the token naming this reading of them. */
      resolve?: ApplyCommitResolve;
      /** `conflicts`: the files' texts are too large to send. */
      tooLarge?: true;
      /** `resolution-invalid`: the answered file that could not be taken. */
      file?: string;
    };

/**
 * Caller-supplied log row filters (the toolbar's User / Date / Paths
 * chips + Graph Options). Validated SHAPES like every history read:
 * `author` a bounded plain string (matched literally, host-escaped),
 * `authorMe` resolved host-side to the commit pass's own identity,
 * dates strict ISO-8601, `paths` tree paths — anything else refuses
 * typed (`invalid-filter`).
 */
export interface WorkspaceTreeLogFilters {
  author?: string;
  authorMe?: boolean;
  since?: string;
  until?: string;
  paths?: string[];
  noMerges?: boolean;
  firstParent?: boolean;
  topoOrder?: boolean;
  /** Walk every ref instead of one scope (the IDE log's unfiltered
   *  view) — mutually exclusive with `ref`, refused `invalid-filter`. */
  allRefs?: boolean;
}

export type WorkspaceTreeLogRpcResult =
  | { ok: true; entries: CommitLogEntry[] }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-ref' | 'invalid-filter' | 'log-failed';
      detail?: string;
    };

export type WorkspaceTreeRefsRpcResult =
  | { ok: true; refs: RepoRef[]; current: string | null }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'refs-failed'; detail?: string };

/** The Git Remotes dialog's list. */
export type WorkspaceTreeRemotesRpcResult =
  | { ok: true; remotes: RepoRemote[] }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'list-failed'; detail?: string };

/** The Edit pass's fields — a new name and/or a new fetch url; an absent field is left as it is. */
export interface WorkspaceTreeRemotePatch {
  name?: string;
  url?: string;
}

/** One remote add / update / remove: it landed, or a typed refusal. */
export type WorkspaceTreeRemoteOpRpcResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'invalid-name'
        | 'invalid-url'
        | 'exists'
        | 'unknown-remote'
        | 'remote-failed';
      detail?: string;
    };

/** The Compare-with-Current answer (§9 IDE-log): both exclusive sides. */
export type CompareRefsRpcResult =
  | { ok: true; current: string; ref: string; onlyInCurrent: CommitLogEntry[]; onlyInRef: CommitLogEntry[] }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'detached-head' | 'unknown-ref' | 'compare-failed';
      detail?: string;
    };

/** One row of the Console-tab ring: the audit row plus its place in the ring. */
export interface GitConsoleRow extends GitAuditRow {
  /** Host-global monotonic id — the ring appends in order, so a larger id is a later row. */
  seq: number;
}

export type WorkspaceTreeGitConsoleRpcResult = { ok: true; rows: GitConsoleRow[] } | { ok: false; reason: 'not-bound' };

/** A commit's files named by what they belonged to there. */
export type WorkspaceTreeEntitiesAtCommitRpcResult =
  | { ok: true; entities: CommitFileEntity[] }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-commit' | 'unknown-path' };

/** The Jump to Source answer: the entity a tree path belongs to. */
export type WorkspaceTreeEntityAtPathRpcResult =
  | { ok: true; entity: WorkspaceTreeEntityRef }
  | { ok: false; reason: 'not-bound' | 'unknown-path' | 'not-an-entity' | 'read-failed'; detail?: string };

/** The Commit tool window's changes rows — porcelain, path-sorted. */
export type WorkspaceTreeChangesRpcResult =
  | { ok: true; changes: WorkingChange[] }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'status-failed'; detail?: string };

/**
 * The Commit window's user-driven commit gesture: checked paths ride a
 * temp-index pathspec pass (the user's real index is never touched),
 * `amend`/`signOff` are the gear/checkbox options, `bypassHooks` the
 * per-commit "Run Git hooks" inverse (seeded from the binding setting,
 * never written back).
 */
export interface WorkspaceTreeUserCommitInput {
  message: string;
  paths: string[];
  amend?: boolean;
  signOff?: boolean;
  bypassHooks?: boolean;
}

export type WorkspaceTreeUserCommitRpcResult =
  | { ok: true; committed: boolean; sha?: string }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'empty-message'
        | 'invalid-paths'
        | 'no-paths'
        | 'amend-unborn'
        | 'amend-merge'
        | 'amend-pushed'
        | 'stage-failed'
        | 'index-locked'
        | 'commit-failed';
      detail?: string;
    };

/**
 * The Commit window's Add to .gitignore ▸ verbs: `added: false` means
 * the target file already carried the entry (never a duplicate line).
 */
export type WorkspaceTreeIgnoreRpcResult =
  | { ok: true; added: boolean }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-path' | 'ignore-failed';
      detail?: string;
    };

/** Add to VCS: every path is tracked as intent-to-add, or none is. */
export type WorkspaceTreeAddToVcsRpcResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-path' | 'add-failed';
      detail?: string;
    };

/** Rollback on added rows: every path leaves the index, or none does. */
export type WorkspaceTreeUnaddPathsRpcResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-path' | 'unadd-failed';
      detail?: string;
    };

/** Delete…: `deleted` counts the files removed before the first refusal, if any. */
export type WorkspaceTreeDeletePathsRpcResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: 'not-bound' | 'unknown-path' | 'delete-failed'; deleted: number; detail?: string };

/** Stop Ignoring: `removed: false` means the exact entry was not in the target file. */
export type WorkspaceTreeUnignoreRpcResult =
  | { ok: true; removed: boolean }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-path' | 'ignore-failed';
      detail?: string;
    };

export type WorkspaceTreeFileDiffRpcResult =
  | { ok: true; diff: CommitFileDiff }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-commit' | 'unknown-path' | 'diff-failed';
      detail?: string;
    };

/** A commit's change against each of its parents — a merge's files. */
export type WorkspaceTreeCommitParentChangesRpcResult =
  | ({ ok: true } & CommitParentChanges)
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-commit' };

/** The log's Create Patch… — the selected commits as one mailbox-format text. */
export type WorkspaceTreeCommitPatchRpcResult =
  | { ok: true; patch: string }
  | {
      ok: false;
      reason:
        | 'not-bound'
        | 'git-unavailable'
        | 'not-a-repo'
        | 'unknown-commit'
        | 'empty'
        | 'too-large'
        | 'patch-failed';
      detail?: string;
    };

export interface WorkspaceTreeGitStatusRpcResult {
  bound: boolean;
  git: GitAvailability;
  repo: boolean;
  /** The checked-out branch (§6 — one active branch per binding); null when detached/unavailable. */
  branch: string | null;
  /** The commit HEAD resolves to; null when unborn/unavailable. With `branch` null it is the detached HEAD (§3.4). */
  headSha: string | null;
  /** Local branch names — rescue/fork branches appear here naturally. */
  branches: string[];
  /** Tag names — a minted or dropped tag moves the frame (the views refetch on frames). */
  tags: string[];
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
  /** True for a `--depth` clone (§3.4): history views stop at the boundary and a pull past it treats every remote file as changed. */
  shallow: boolean;
}

export interface WorkspaceTreeRuntime {
  /** Reopen persisted bindings; call once after the sync engine boots. */
  start(): Promise<void>;
  /** Rung-1 feed — call on every committed envelope (host hook). */
  onSyncEvent(event: OracleSyncBroadcastEvent): void;
  bind(workspaceId: string, rootDir: string): Promise<BindWorkspaceTreeRpcResult>;
  /**
   * Open an existing tree as a NEW local workspace: mint the record
   * from the manifest (uid preserved, home-Org tenancy), then bind it
   * — the cold sweep fills the workspace from the tree.
   */
  adopt(rootDir: string): Promise<AdoptWorkspaceTreeRpcResult>;
  unbind(workspaceId: string): Promise<{ ok: boolean }>;
  probe(rootDir: string): ReturnType<typeof probeWorkspaceTree>;
  list(): WorkspaceTreeBindingRecord[];
  /** Explicit Commit gesture (§9) — flush, then a temp-index `git commit`. */
  commit(workspaceId: string, message?: string): Promise<CommitWorkspaceTreeRpcResult>;
  /**
   * Explicit Pull gesture (§9, Phase 4): fetch, converge foreign
   * history through the mutators, then fast-forward or record the
   * two-parent merge commit. The pull records the files it wrote and no
   * other; uncommitted work in one of those files is committed first,
   * on `commitLocal` — the pass refuses `local-changes` without it
   * unless commits are automatic on the binding.
   */
  pull(
    workspaceId: string,
    commitLocal?: CommitLocalWork,
    resolution?: ApplyCommitResolution,
  ): Promise<PullWorkspaceTreeRpcResult>;
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
   * Uncommitted work in the files the resolution replaces or re-applies
   * commits first so every choice operates on complete local material;
   * uncommitted work elsewhere stays as it was.
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
  /** Mint a lightweight tag at a FULL commit sha (the log's New Tag…); an existing name refuses typed. */
  createTag(workspaceId: string, name: string, sha: string): Promise<CreateTagRpcResult>;
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
   * local or remote-tracking ref — never raw `git merge`. Uncommitted
   * work is treated exactly like pull's: left alone unless the merge
   * writes its file, then committed first on `commitLocal`.
   */
  mergeBranch(
    workspaceId: string,
    ref: string,
    commitLocal?: CommitLocalWork,
    resolution?: ApplyCommitResolution,
  ): Promise<MergeBranchRpcResult>;
  /**
   * Cherry-Pick (`pick`) or Revert (`revert`) of ONE commit of the log,
   * by its FULL sha, onto the current branch as a new one-parent
   * commit. Never `git cherry-pick` / `git revert`: the commit's own
   * change converges through the mutators. A document both sides
   * changed refuses `conflicts` with nothing written. The commit
   * records the files the change wrote and no other; uncommitted work
   * in one of those files is committed first, on `commitLocal` — the
   * pass refuses `local-changes` without it unless commits are
   * automatic on the binding.
   */
  applyCommit(
    workspaceId: string,
    sha: string,
    mode: 'pick' | 'revert',
    resolution?: ApplyCommitResolution,
    commitLocal?: CommitLocalWork,
  ): Promise<ApplyCommitRpcResult>;
  /** Focus returned to the app — throttled background fetch trigger. */
  notifyAppFocus(): void;
  /** Git slot feed for the card/pill — availability, dirty count, draft message. */
  gitStatus(workspaceId: string): Promise<WorkspaceTreeGitStatusRpcResult>;
  /**
   * Workspace history timeline (§9, Phase 7) — recent commits with
   * changed paths. `ref` scopes the walk to a branch/tag from
   * {@link WorkspaceTreeRuntime.listRefs}'s answer; anything else
   * refuses `unknown-ref`. `filters` are the toolbar's row filters
   * ({@link WorkspaceTreeLogFilters}) — validated shapes, refusing
   * `invalid-filter`.
   */
  log(
    workspaceId: string,
    limit?: number,
    ref?: string,
    filters?: WorkspaceTreeLogFilters,
  ): Promise<WorkspaceTreeLogRpcResult>;
  /**
   * The Commit tool window's changes rows (working tree vs HEAD,
   * porcelain): tracked changes, unversioned files, and — when asked —
   * ignored ones. Pure read off the per-binding chain; the window
   * refetches on status frames.
   */
  changes(workspaceId: string, includeIgnored?: boolean): Promise<WorkspaceTreeChangesRpcResult>;
  /**
   * One file's HEAD-vs-WORKING-TREE diff — the Commit window's
   * double-click feed. Same caps/typed flags as `fileDiff`; `path` is
   * a validated tree path.
   */
  workingFileDiff(workspaceId: string, path: string): Promise<WorkspaceTreeFileDiffRpcResult>;
  /**
   * The Commit window's user commit: checked paths through the
   * temp-index pathspec pass, with the Amend carve-out (typed refusals
   * on unborn/merge/pushed HEAD), Sign-off, and per-commit hooks
   * bypass. The user's real index is never read or written.
   */
  userCommit(workspaceId: string, input: WorkspaceTreeUserCommitInput): Promise<WorkspaceTreeUserCommitRpcResult>;
  /**
   * The Commit window's Add to .gitignore ▸ verbs: append the path's
   * root-anchored entry to `.gitignore` (shared) or `.git/info/exclude`
   * (local-only). On the per-binding chain; a status frame follows.
   */
  ignorePath(workspaceId: string, path: string, target: IgnoreTarget): Promise<WorkspaceTreeIgnoreRpcResult>;
  /**
   * Stop Ignoring — delete the path's exact anchored entry from the
   * target ignore file (the inverse of `ignorePath`; never touches
   * globs). On the per-binding chain; a status frame follows.
   */
  unignorePath(workspaceId: string, path: string, target: IgnoreTarget): Promise<WorkspaceTreeUnignoreRpcResult>;
  /**
   * The Commit window's Add to VCS verb: track the paths as
   * intent-to-add in the user's real index — the rows move to Changes
   * as added, nothing is staged. On the per-binding chain; a status
   * frame follows.
   */
  addToVcs(workspaceId: string, paths: readonly string[]): Promise<WorkspaceTreeAddToVcsRpcResult>;
  /**
   * The Commit window's Rollback… verb over added rows: drop the paths
   * from the user's real index (`git rm --cached`) — the rows return
   * to Unversioned Files, the files stay on disk. On the per-binding
   * chain; a status frame follows.
   */
  unaddPaths(workspaceId: string, paths: readonly string[]): Promise<WorkspaceTreeUnaddPathsRpcResult>;
  /**
   * The Commit window's Delete… verb: remove the files from disk (a
   * tracked file reads as deleted until committed). On the per-binding
   * chain; a status frame follows.
   */
  deletePaths(workspaceId: string, paths: readonly string[]): Promise<WorkspaceTreeDeletePathsRpcResult>;
  /** One path's timeline (`--follow`) — the newest entry is "who last touched this". */
  fileLog(workspaceId: string, path: string, limit?: number): Promise<WorkspaceTreeLogRpcResult>;
  /**
   * Jump to Source: the entity a tree path belongs to, read from the
   * working tree — the manifest itself or a sibling in an entity's
   * directory. The user's own files answer `not-an-entity`.
   */
  entityAtPath(workspaceId: string, path: string): Promise<WorkspaceTreeEntityAtPathRpcResult>;
  /**
   * The entities a commit's files belonged to, from the commit's own
   * manifests (its first parent's for a path it removes), each with the
   * collection and folders above it. A pure read; `sha` is a full sha.
   */
  entitiesAtCommit(
    workspaceId: string,
    sha: string,
    paths: readonly string[],
  ): Promise<WorkspaceTreeEntitiesAtCommitRpcResult>;
  /** The log view's ref tree (§9, Phase 7 slice 2) — local branches, remote-tracking refs, tags. */
  listRefs(workspaceId: string): Promise<WorkspaceTreeRefsRpcResult>;
  /** The Git Remotes dialog's list — a pure read. */
  listRemotes(workspaceId: string): Promise<WorkspaceTreeRemotesRpcResult>;
  /** Add a remote (`git remote add`). On the per-binding chain; a status frame follows. */
  addRemote(workspaceId: string, name: string, url: string): Promise<WorkspaceTreeRemoteOpRpcResult>;
  /** Rename a remote and/or set its fetch url. On the per-binding chain; a status frame follows. */
  updateRemote(
    workspaceId: string,
    name: string,
    patch: WorkspaceTreeRemotePatch,
  ): Promise<WorkspaceTreeRemoteOpRpcResult>;
  /** Remove a remote with its remote-tracking refs. On the per-binding chain; a status frame follows. */
  removeRemote(workspaceId: string, name: string): Promise<WorkspaceTreeRemoteOpRpcResult>;
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
   * `base`, another full hash, moves the old side from the first
   * parent to that commit's blob (the Push window's range read).
   */
  fileDiff(workspaceId: string, sha: string, path: string, base?: string): Promise<WorkspaceTreeFileDiffRpcResult>;
  /**
   * A commit's change against EACH of its parents, first parent first,
   * and — for a merge — the files that differ from every parent. What
   * lists a merge's files: the log's own listing is empty there. A pure
   * read; `sha` is a full sha.
   */
  commitParentChanges(workspaceId: string, sha: string): Promise<WorkspaceTreeCommitParentChangesRpcResult>;
  /**
   * The log's Create Patch…: `shas` (FULL commit hashes, in apply
   * order) as one mailbox-format patch text. Pure read, off the
   * per-binding chain; nothing is written anywhere on the host. A
   * selection git writes no patch for (a merge alone) answers `empty`,
   * a text over the cap `too-large`.
   */
  commitPatch(workspaceId: string, shas: readonly string[]): Promise<WorkspaceTreeCommitPatchRpcResult>;
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
  /**
   * The §6.3 stamp the binding's log pointer currently reflects — the
   * checked-out HEAD (a branch name, `@{<sha>}` detached, `''` when
   * HEAD resolves to nothing); null while unbound or before the first
   * probe. Synchronous: the ws-server stamps it onto a peer's SYNCED
   * (the git-sync plan §3.5) without touching git.
   */
  headStamp(workspaceId: string): string | null;
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

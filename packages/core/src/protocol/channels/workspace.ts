/**
 * Workspace-domain bridge RPCs — workspace list/CRUD, import/export,
 * script-review badges, and the basic connection/rules presence calls.
 */

import type { ImportReport } from '../../import';
import type { ExtensionWorkspace, Rule } from '../../types';
import type { WorkspaceSnapshot } from './common';

export interface WorkspaceRpc {
  // ── Connection / presence ──────────────────────────────────────
  popupOpen: {
    req: Record<string, never>;
    res: {
      type?: string;
      rules: Rule[];
      connected: boolean;
      workspaces: ExtensionWorkspace[];
      activeWorkspaceId: string;
    };
  };

  // ── Workspaces ─────────────────────────────────────────────────
  listWorkspaces: {
    req: Record<string, never>;
    res: WorkspaceSnapshot;
  };
  getActiveWorkspace: {
    req: Record<string, never>;
    res: { workspace: ExtensionWorkspace };
  };
  /**
   * Host-neutral resolver consumed by the `getActiveWorkspaceId`
   * capability. Returns `null` on a host with no active workspace
   * (fresh install, no seed). Cheaper than `getActiveWorkspace` for
   * callers that only need the id (eager-mirror init).
   */
  getActiveWorkspaceId: {
    req: Record<string, never>;
    res: { activeWorkspaceId: string | null };
  };
  duplicateWorkspace: {
    req: {
      id: string;
      name?: string;
      /** Target Org for the copy. Omit to land in the source's Org. */
      targetOrgId?: string;
      /** When false, the copy lands with an empty vault and no OAuth
       *  bundles — the user re-enters secrets in the duplicate. */
      includeSecrets?: boolean;
    };
    res: { success: boolean; workspace?: ExtensionWorkspace; error?: string };
  };
  /**
   * Host-local eviction of a consumed workspace — the Discard leg of
   * removing a backend. Unlike the renderer-direct delete (a synced
   * remove mutation), eviction mints no mutation: it purges the
   * workspace's data and log rows and removes the list entity without
   * a tombstone, so re-joining the backend later syncs the workspace
   * back down. SW-side only — it touches IDB log stripes and
   * per-workspace services the renderer can't reach.
   */
  evictWorkspace: {
    req: { workspaceId: string };
    res: { success: boolean; error?: string };
  };
  exportWorkspace: {
    req: {
      /** Falls back to the active workspace when omitted. */
      workspaceId?: string;
      scope:
        | { kind: 'workspace' }
        | {
            kind: 'selection';
            selection: import('../../types').ExportSelection;
            /**
             * Strict-literal export (design §5.5 Advanced override).
             * When `true`, the gatherer ships exactly the picked uids
             * with no descendant/parent expansion.
             */
            strictLiteral?: boolean;
          };
      /**
       * Vault include mode (design §3.1 / §3.2 / §3.3).
       *
       * Encrypted exports are computed entirely SW-side: the renderer
       * passes the user's passphrase, the SW derives the key, encrypts,
       * zeroes the in-memory passphrase reference, and returns the
       * fingerprints alongside the YAML. The passphrase never lands in
       * persisted state.
       */
      vaultMode?: 'omitted' | 'encrypted' | 'plaintext';
      passphrase?: string;
      passphraseHint?: string;
    };
    res: {
      success: boolean;
      yaml?: string;
      exportId?: string;
      scope?: 'workspace' | 'collection' | 'selection';
      /** Present when `vaultMode === 'encrypted'`. Sender shows these to
       *  the recipient out-of-band ("does yours say `7f:a3:c1`?"). */
      ciphertextFingerprint?: string;
      keyFingerprint?: string;
      error?: string;
    };
  };
  /**
   * Apply a parsed `WorkspaceExport` to a target workspace. SW reads
   * the target's current state under a workspace-import lock, runs the
   * collision diff fresh (handles concurrent edits during preview),
   * resolves the user's per-entity strategies into an ImportPlan, and
   * drives `chrome.storage` writes. Returns the persisted
   * `WorkspaceExportImportReport`.
   */
  importWorkspace: {
    req: {
      /** The validated export envelope (already parsed via `parseWorkspaceExport`). */
      incoming: import('../../workspace-export').WorkspaceExport;
      /** User's per-entity strategy choices from the preview modal. */
      strategies: import('../../workspace-export').StrategyMap;
      /** Backup-restore toggle ("this is mine — prefer update-by-uid"). */
      backupRestore?: boolean;
      /** Advanced override — when true, preserves source enabled flags. */
      trustExport?: boolean;
      /** Advanced override — when true, strips request scripts on import. */
      stripScripts?: boolean;
      /** Advanced override — when true, replaces oauth2 Request.auth with
       *  `{ type: 'none' }` on every imported request. */
      omitOAuthConfigs?: boolean;
      /** Advanced override — when true, `update` collisions on
       *  collections preserve the target's `order` field. */
      keepTargetCollectionOrder?: boolean;
      /** Advanced override — when true and target=new, refuse to
       *  create when an existing workspace carries the export's
       *  `workspace.uid`. */
      refuseUidCollision?: boolean;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      /** SHA-256 of the original raw bytes (`sha256:<hex>`). */
      sourceHash: string;
    };
    res: {
      success: boolean;
      report?: import('../../import').WorkspaceExportImportReport;
      targetWorkspaceId?: string;
      error?: string;
    };
  };
  /**
   * Preview-time analog of `importWorkspace`. Reads (no writes) the
   * chosen target workspace and runs the collision diff +
   * missing-deps walk. The renderer drives the preview modal off
   * this; on submit it calls `importWorkspace`, which re-runs the
   * diff under the workspace-import lock for authoritative state.
   * `snapshotHash` lets the renderer detect concurrent edits between
   * preview-open and submit.
   */
  previewWorkspaceImport: {
    req: {
      incoming: import('../../workspace-export').WorkspaceExport;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      backupRestore?: boolean;
    };
    res: {
      success: boolean;
      diff?: import('../../workspace-export').DiffResult;
      missingDeps?: import('../../workspace-export').MissingDep[];
      snapshotHash?: string;
      targetWorkspaceId?: string | null;
      error?: string;
    };
  };
  /**
   * Read the per-entity YAML snapshots written by the most recent
   * `importWorkspace` call for `workspaceId`. Keys are entity uids
   * (plus `__singleton.workspaceVars__` / `__singleton.vault__` for
   * the two singletons); values are the canonical YAML form of each
   * entity AS IT WAS IMPORTED.
   *
   * Drives the merge editor's 3-pane ancestor on re-imports
   * (`MERGE_CONFLICT_EDITOR_PLAN.md` §7): collisions on a uid present
   * here merge against the snapshot as the common base; collisions on
   * a uid not present here fall back to 2-pane.
   *
   * Empty record when the workspace has never been imported into.
   */
  getLastImportedSnapshots: {
    req: { workspaceId: string };
    res: { snapshots: Record<string, string> };
  };
  /**
   * Walk every workspace's `importReports` ring for prior imports
   * matching the incoming export's `exportId` or source-workspace
   * uid. Drives the soft-dedup banner in the preview modal
   * (design §5.2 precedence — exportId beats workspace.uid; same-
   * target beats different-target).
   */
  findWorkspaceExportImportMatches: {
    req: { exportId: string; workspaceUid: string; currentTargetWorkspaceId: string | null };
    res: import('../../types').DedupMatchesResult;
  };
  /**
   * Read the active workspace's set of imported request uids that
   * carry `preRequestScript` / `postResponseScript` and haven't been
   * opened in the inspector since import. The sidebar surfaces these
   * as a "scripts" badge per design §5.5; opening the inspector calls
   * `clearRequestScriptsReviewPending` to drop the uid.
   */
  getRequestScriptsReviewPending: {
    req: Record<string, never>;
    res: { uids: string[] };
  };
  /**
   * Drop a uid from the pending-scripts-review set (active workspace).
   * Called when the user opens the request in the inspector — the
   * badge clears as soon as the script is visible to the eye.
   */
  clearRequestScriptsReviewPending: {
    req: { uid: string };
    res: { success: boolean };
  };
  checkConnection: {
    req: Record<string, never>;
    res: { connected: boolean };
  };
  getRules: {
    req: Record<string, never>;
    res: { rules: Rule[]; isConnected: boolean };
  };
  rulesUpdated: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };

  // ── Import reports (per-workspace ring, ARCHITECTURE §23) ────────
  /** Record an import report. Dedupes by `sourceHash` (non-empty
   *  replaces prior entry; empty string appends as a distinct event). */
  recordImportReport: {
    req: { report: ImportReport };
    res: { success: boolean; error?: string };
  };
  /** Read the full ring — oldest first. Callers typically reverse()
   *  for most-recent-first display. `workspaceId` targets an explicit
   *  workspace's ring (the migration report view reads per-workspace
   *  rings without switching); omitted, the active workspace applies. */
  listImportReports: {
    req: { workspaceId?: string };
    res: { reports: ImportReport[] };
  };
  /** Drop every report for the active workspace. */
  clearImportReports: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };
  /**
   * Look up a prior import report by `sourceHash` for the active
   * workspace. Returns `null` when no match exists — the UI uses
   * this to decide whether to render the re-import-diff panel
   * (ARCHITECTURE §23). Empty-hash inputs always return null since
   * those aren't considered identifying.
   */
  findImportReportBySourceHash: {
    req: { sourceHash: string };
    res: { report: ImportReport | null };
  };

  // ── Workspace-tree bindings (GIT_PLAN.md Phase 2, Node hosts) ────
  //
  // The settings Git card's host surface. Answered by the daemon
  // spine's workspace-tree runtime; refusal reasons are the four typed
  // dialogs of GIT_PLAN.md §9 plus the runtime's own registry guards.
  // Wire shapes are structural (never imported from the Node host
  // package — dependency direction).

  /** Bind a workspace to an on-disk folder (init when empty). */
  'oh.workspaceTree.bind': {
    req: { workspaceId: string; rootDir: string };
    res:
      | { ok: true; initialized: boolean; sweep: WorkspaceTreeSweepSummary | null }
      | { ok: false; reason: 'unknown-workspace' | 'already-bound' }
      | { ok: false; reason: 'locked'; holder: { pid: number; hostId: string; acquiredAt: string } }
      | { ok: false; reason: 'uuid-collision' | 'identity-mismatch'; treeWorkspaceUid: string }
      | { ok: false; reason: 'invalid-manifest'; message: string };
  };
  /** Release the binding; the folder stays a valid workspace tree. */
  'oh.workspaceTree.unbind': {
    req: { workspaceId: string };
    res: { ok: boolean };
  };
  /** Identity probe — what workspace (if any) a folder claims to be. */
  'oh.workspaceTree.probe': {
    req: { rootDir: string };
    res: { present: false } | { present: true; workspaceUid: string; name: string } | { present: true; error: string };
  };
  /** Current bindings + each binding's latest sweep issues. */
  'oh.workspaceTree.list': {
    req: Record<string, never>;
    res: { bindings: Array<{ workspaceId: string; rootDir: string; issues: WorkspaceTreeIssueWire[] }> };
  };
  /**
   * Native directory picker — desktop shell only (Electron dialog);
   * other hosts answer the not-implemented error and the card falls
   * back to a plain path input.
   */
  'oh.workspaceTree.pickFolder': {
    req: Record<string, never>;
    res: { path: string | null };
  };
  /**
   * Explicit Commit gesture (GIT_PLAN.md §9, Phase 3): flush the tree,
   * then a REAL `git commit` via a temp index — hooks and signing run,
   * the user's staging area is untouched (§3.3). `message` overrides
   * the semantic draft; empty/absent uses the suggestion.
   */
  'oh.workspaceTree.commit': {
    req: { workspaceId: string; message?: string };
    res: WorkspaceTreeCommitWire;
  };
  /** Git slot feed for the card/pill — availability, dirty count, draft message, cadence. */
  'oh.workspaceTree.gitStatus': {
    req: { workspaceId: string };
    res: WorkspaceTreeGitStatusWire;
  };
  /** Commit cadence (§3.2): explicit by default; every other value opts into automation. */
  'oh.workspaceTree.setCommitCadence': {
    req: { workspaceId: string; cadence: WorkspaceTreeCommitCadence };
    res: { ok: boolean };
  };
  /**
   * The explicit setting behind `--no-verify` (§3.3: the engine never
   * bypasses hooks unless the user flips this). Per binding, like the
   * cadence — host-local config, no settings-schema plumbing.
   */
  'oh.workspaceTree.setBypassHooks': {
    req: { workspaceId: string; bypassHooks: boolean };
    res: { ok: boolean };
  };
  /**
   * Explicit Pull gesture (GIT_PLAN.md §9, Phase 4; §11.4 mechanics):
   * fetch, then converge the foreign head through the mutators as
   * virtual batches and record a TWO-PARENT merge commit through the
   * temp-index path — `git merge` is never invoked. Local uncommitted
   * work commits first under its own semantic draft.
   */
  'oh.workspaceTree.pull': {
    req: { workspaceId: string };
    res: WorkspaceTreePullWire;
  };
  /**
   * Explicit Push gesture (GIT_PLAN.md §9, Phase 5): push the current
   * branch to its upstream (establishing tracking on a lone remote
   * when none is configured). Non-fast-forward rejections and
   * permission failures come back as typed reasons the card renders
   * as the pull-first nudge / the §8.2 read-only affordance; a
   * detected force-push (§16) refuses until the trichotomy resolves.
   */
  'oh.workspaceTree.push': {
    req: { workspaceId: string };
    res: WorkspaceTreePushWire;
  };
  /**
   * The §8.2 read-only-remote affordance: publish local commits as a
   * NEW branch on the remote (`HEAD:refs/heads/<branch>`) so a
   * write-protected base branch can still receive the work as a
   * merge/pull request on the user's own git host.
   */
  'oh.workspaceTree.pushNewBranch': {
    req: { workspaceId: string; branch: string };
    res: WorkspaceTreePushWire;
  };
  /**
   * Opt-in auto-push after every engine commit (§3.2: push is NEVER
   * automatic except through this explicit toggle). Per binding, like
   * cadence and bypassHooks.
   */
  'oh.workspaceTree.setAutoPushOnCommit': {
    req: { workspaceId: string; autoPushOnCommit: boolean };
    res: { ok: boolean };
  };
  /**
   * Resolve a detected remote history rewrite (§16 trichotomy):
   * `abandon` converges the engine to the rewritten head, `rescue`
   * first preserves the pre-rewrite local history on a new
   * `oh-rescue-<ts>` branch (never a history edit), `reapply`
   * re-lands local changes as a fresh commit on top of the new
   * history. Local uncommitted work commits first in every case.
   */
  'oh.workspaceTree.resolveForcePush': {
    req: { workspaceId: string; choice: 'abandon' | 'rescue' | 'reapply' };
    res: WorkspaceTreeForcePushResolveWire;
  };
  /**
   * In-app branch switch (GIT_PLAN.md §6; DATA_PLANE_TOPOLOGIES.md
   * §6.2): a wrapped `git checkout` carrying the uncommitted-changes
   * answer — `commit` lands the engine commit first, `stash` pushes
   * onto the user's own stash stack, `discard` force-checks-out and
   * cleans (danger-confirmed in the card). A dirty tree with no
   * `dirtyAction` refuses with the count so the surface raises the
   * prompt. The engine converges to the new branch's tree through the
   * same rung-2 sweep an external terminal checkout takes.
   */
  'oh.workspaceTree.switchBranch': {
    req: { workspaceId: string; branch: string; dirtyAction?: 'commit' | 'stash' | 'discard' };
    res: WorkspaceTreeSwitchBranchWire;
  };
  /** Create a branch at HEAD and switch to it (`checkout -b` — dirty work rides along). */
  'oh.workspaceTree.createBranch': {
    req: { workspaceId: string; branch: string };
    res: WorkspaceTreeCreateBranchWire;
  };
  /**
   * In-app branch merge (§6): the Phase 4 pull machinery pointed at a
   * local or remote-tracking ref — raw `git merge` is never invoked,
   * so the no-`<<<<<<<` guarantee holds. Local uncommitted work
   * commits first; an un-diverged branch fast-forwards, genuine
   * divergence records a two-parent commit with `Co-Authored-By:`
   * trailers.
   */
  'oh.workspaceTree.mergeBranch': {
    req: { workspaceId: string; ref: string };
    res: WorkspaceTreeMergeBranchWire;
  };
  /**
   * Workspace history timeline (GIT_PLAN.md §9, Phase 7): recent
   * commits with their changed paths — `git log` as the canonical
   * audit trail (DATA_PLANE_TOPOLOGIES.md §7.1). Read-only; an unborn
   * HEAD answers an empty list.
   */
  'oh.workspaceTree.log': {
    req: {
      workspaceId: string;
      limit?: number;
      /** Scope the walk to a branch/tag from `listRefs` — a validated
       *  ref NAME, never a revision expression; unknown names refuse. */
      ref?: string;
    };
    res: WorkspaceTreeLogWire;
  };
  /**
   * The log view's ref tree (§9, Phase 7 slice 2): local branches,
   * remote-tracking refs (as of the last background fetch — the panel
   * never touches the network), and tags. Pure read; `current` names
   * the checked-out branch for the ★ marker.
   */
  'oh.workspaceTree.listRefs': {
    req: { workspaceId: string };
    res: WorkspaceTreeRefsWire;
  };
  /**
   * One path's timeline (`--follow`, renames included) — the blame
   * answer: the newest entry is "who last touched this". Entries carry
   * no file lists (the diff isn't asked for).
   */
  'oh.workspaceTree.fileLog': {
    req: { workspaceId: string; path: string; limit?: number };
    res: WorkspaceTreeLogWire;
  };
  /**
   * One file's change in one commit (§9, Phase 7 slice 3): the old and
   * new blob contents as a pair — the Monaco diff pane's feed. `sha`
   * must be a full commit hash from `log`'s answer (never a revision
   * expression); the old side is the first parent's blob. Binary files
   * and blobs over the size cap answer typed flags with no contents.
   */
  'oh.workspaceTree.fileDiff': {
    req: { workspaceId: string; sha: string; path: string };
    res: WorkspaceTreeFileDiffWire;
  };
  /**
   * Focus left the app (every window blurred) — the `on-blur` cadence
   * trigger. Fired by the host shell (desktop main observes its own
   * windows); bindings on other cadences ignore it.
   */
  'oh.workspaceTree.appBlur': {
    req: Record<string, never>;
    res: { ok: boolean };
  };
  /**
   * Focus returned to the app — throttled background-fetch trigger so
   * the ahead/behind affordance is fresh when the user looks (§3.2:
   * fetch is always on and non-mutating; pull stays explicit).
   */
  'oh.workspaceTree.appFocus': {
    req: Record<string, never>;
    res: { ok: boolean };
  };
}

export type WorkspaceTreeCommitCadence = 'off' | 'auto' | 'on-blur' | 'every-5m' | 'every-15m' | 'every-30m';

export type WorkspaceTreeCommitWire =
  | { ok: true; committed: boolean; sha?: string }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'stage-failed' | 'commit-failed';
      /** stderr/stdout of the failing git invocation — hook output lands here (§3.3). */
      detail?: string;
    };

export type WorkspaceTreePullWire =
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
      /** stderr of the failing git invocation / the offending marker or uid. */
      detail?: string;
    };

export type WorkspaceTreePushWire =
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
      /** stderr of the failing git invocation — the honest §8.2 surface. */
      detail?: string;
    };

export type WorkspaceTreeForcePushResolveWire =
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

export type WorkspaceTreeSwitchBranchWire =
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
      /** Porcelain count when `reason` is `dirty` — the §6.2 prompt's feed. */
      dirtyFiles?: number;
    };

export type WorkspaceTreeCreateBranchWire =
  | { ok: true; branch: string }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'create-failed'; detail?: string };

export type WorkspaceTreeMergeBranchWire =
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

/** One changed path in a history entry; rename/copy records report the new path. */
export interface WorkspaceTreeLogFileWire {
  /** Porcelain status letter (`A`/`M`/`D`/`T`/`R`/`C`). */
  status: string;
  path: string;
}

/** One commit in the §9 history view. */
export interface WorkspaceTreeLogEntryWire {
  sha: string;
  authorName: string;
  authorEmail: string;
  /** Author date, strict ISO-8601. */
  authoredAt: string;
  subject: string;
  /** `Co-Authored-By:` trailer values (`Name <email>`) — §23.6 attribution. */
  coAuthors: string[];
  /** Changed paths; empty on path-scoped (`fileLog`) entries. */
  files: WorkspaceTreeLogFileWire[];
}

export type WorkspaceTreeLogWire =
  | { ok: true; entries: WorkspaceTreeLogEntryWire[] }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-ref' | 'log-failed';
      detail?: string;
    };

/** One ref in the log view's tree (Phase 7 slice 2), grouped by namespace. */
export interface WorkspaceTreeRefWire {
  /** Short name (`main`, `origin/main`, `v1.0`). */
  name: string;
  kind: 'local' | 'remote' | 'tag';
  /** Commit sha (annotated tags report the peeled commit). */
  sha: string;
}

export type WorkspaceTreeRefsWire =
  | { ok: true; refs: WorkspaceTreeRefWire[]; current: string | null }
  | { ok: false; reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'refs-failed'; detail?: string };

/** One file's old/new blob pair in one commit (Phase 7 slice 3) — the diff pane's feed. */
export interface WorkspaceTreeFileDiffPairWire {
  path: string;
  /** Old blob text; null when the commit added the file (or the blob is binary/over-cap). */
  oldContent: string | null;
  /** New blob text; null when the commit deleted the file (or the blob is binary/over-cap). */
  newContent: string | null;
  /** True when either side is binary — no text contents ride along. */
  binary: boolean;
  /** True when either side exceeds the size cap — no contents ride along. */
  tooLarge: boolean;
  /** Byte size per side; null on an absent side. */
  oldSize: number | null;
  newSize: number | null;
}

export type WorkspaceTreeFileDiffWire =
  | { ok: true; diff: WorkspaceTreeFileDiffPairWire }
  | {
      ok: false;
      reason: 'not-bound' | 'git-unavailable' | 'not-a-repo' | 'unknown-commit' | 'unknown-path' | 'diff-failed';
      detail?: string;
    };

/** A detected remote history rewrite (§16) — the trichotomy dialog's feed. */
export interface WorkspaceTreeForcePushStateWire {
  /** The rewritten remote head. */
  remoteSha: string;
  /** The last remote sha this engine integrated — no longer an ancestor. */
  lastSyncedSha: string;
}

export interface WorkspaceTreeGitStatusWire {
  bound: boolean;
  git: { available: true; version: string } | { available: false; reason: 'missing' | 'below-floor'; version?: string };
  repo: boolean;
  /** The checked-out branch (§6 — one active branch per binding); null when detached/unavailable. */
  branch: string | null;
  /** Local branch names — rescue/fork branches appear here naturally. */
  branches: string[];
  /** `git status --porcelain` entry count — never an app ledger (§3.3); null when unreadable. */
  dirtyFiles: number | null;
  userIndexBusy: boolean;
  suggestedMessage: string;
  cadence: WorkspaceTreeCommitCadence;
  /** The explicit `--no-verify` setting (§3.3); false unless the user flipped it. */
  bypassHooks: boolean;
  /** Remote-tracking ref (`origin/main`); null when no upstream is configured. */
  upstream: string | null;
  /** Local commits the upstream lacks; null without an upstream. */
  ahead: number | null;
  /** Upstream commits the local branch lacks — the Pull affordance; null without an upstream. */
  behind: number | null;
  /** Opt-in auto-push after every engine commit (§3.2); false unless the user flipped it. */
  autoPushOnCommit: boolean;
  /** Non-null while a remote history rewrite is detected (§16) — holds pull/push. */
  forcePush: WorkspaceTreeForcePushStateWire | null;
}

/** One per-document read failure — the §13.3 quarantine seam's wire shape. */
export interface WorkspaceTreeIssueWire {
  path: string;
  message: string;
}

export type WorkspaceTreeSweepSummary =
  | { ok: true; applied: number; changed: number; removed: number; issues: WorkspaceTreeIssueWire[] }
  | { ok: false; reason: 'unreadable-manifest' | 'identity-mismatch'; issues: WorkspaceTreeIssueWire[] };

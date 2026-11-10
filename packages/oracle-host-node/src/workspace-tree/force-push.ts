/**
 * Force-push resolution pass — a detected remote history rewrite is
 * resolved by the §16 trichotomy, never merged silently and never
 * auto-rebased (the git-sync plan §10 Phase 5; the sync-engine design §16;
 * the data-plane topologies design §6.4).
 *
 * The resolution records the files IT wrote and no other
 * (`pass-writes.ts`). Uncommitted work in a file the two heads hold
 * differently — the files the resolution replaces or re-applies — is
 * committed first on the pre-resolution head, without a second
 * question: the dialog's choice is the word. Uncommitted work anywhere
 * else, and every unversioned file, stays as it was across the ref
 * move. The pre-resolution HEAD with those commits carries the local
 * material every choice works from — the §9.3 commit watermark
 * guarantees the mutations behind it were never compacted away. The
 * three choices:
 *
 *   - `abandon` — the rewritten remote head becomes the workspace
 *     state: the engine converges to the foreign snapshot wholesale
 *     (full-tree delta through the mutators — still no second data
 *     plane), the branch ref moves to the remote head, and any
 *     canonicalization residue commits as an ordinary follow-up. The
 *     pre-resolution history stays reachable only through the reflog.
 *   - `rescue` — identical to `abandon`, but the pre-resolution HEAD
 *     is preserved on a NEW `oh-rescue-<ts>` branch
 *     (`update-ref` with a must-not-exist guard — a rescue is never a
 *     history edit) so the user can merge or inspect it later.
 *   - `reapply` — local changes survive on top of the new history:
 *     only what the remote genuinely changed since the last-synced
 *     watermark enters as virtual batches (three-way against the
 *     watermark tree — both histories knew it), the branch ref moves
 *     to the remote head, and the local-side difference commits as a
 *     fresh single-parent commit ("re-applied as new commits").
 *
 * Schema-invalid foreign documents quarantine exactly as on pull
 * (§13.3): engine value stands, foreign bytes land off-baseline, the
 * issue rows surface through the card's feed.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import type {
  EmissionBatch,
  LiveSetEntriesReader,
} from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import {
  readWorkspaceTree,
  type TreeIssue,
  type WorkspaceTreeState,
  withCommitSecretRows,
} from '@openheaders/core/workspace-tree';
import {
  commitWorkspaceTree,
  createRescueBranch,
  diffForeignPaths,
  fastForwardWorkspaceBranch,
  fetchWorkspaceRemote,
  type GitRunner,
  gitOperationInProgress,
  isAncestorOf,
  listTreeYamlPaths,
  localHeadSha,
  readCommitTreeFiles,
  resolveRefSha,
  resolveUpstream,
  snapshotWorkingTree,
} from '../git';
import { landForeignOwnFiles } from './own-files';
import { type LocalWorkDeps, readPassWrites, recordablePaths, uncommittedAmong } from './pass-writes';
import { releaseHealedQuarantine, writeForeignQuarantine } from './pull';

export type ForcePushChoice = 'abandon' | 'rescue' | 'reapply';

export interface ResolveForcePushOptions {
  run: GitRunner;
  rootDir: string;
  choice: ForcePushChoice;
  /** The bound workspace's identity — a foreign tree claiming another uid is refused. */
  workspaceUid: string;
  /** The remote sha this engine last integrated — the rewrite baseline. */
  lastSyncedRemoteSha: string;
  /** Rescue-branch timestamp source — injectable for tests. */
  now?: () => Date;
  readSnapshot: () => Promise<WorkspaceTreeState>;
  nextCtx: () => MutatorContext;
  liveSetEntries: LiveSetEntriesReader;
  apply: (batches: EmissionBatch[]) => Promise<void>;
  flush: () => Promise<unknown>;
  /** Record uncommitted work in the files the resolution writes, as its own commit on the pre-resolution head. */
  commitLocalWork: LocalWorkDeps['commitLocalWork'];
  identityEnv: Record<string, string>;
  bypassHooks: boolean;
}

export type ResolveForcePushResult =
  | {
      ok: true;
      sha: string;
      remoteSha: string;
      rescueBranch: string | null;
      issues: TreeIssue[];
      /** Files of the resolution that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
    }
  | {
      ok: false;
      reason:
        | 'op-in-progress'
        | 'no-upstream'
        | 'fetch-failed'
        | 'not-rewritten'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'ref-update-failed'
        | 'commit-failed';
      detail?: string;
      issues: TreeIssue[];
    };

function rescueBranchName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `oh-rescue-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

export async function resolveForcePushWorkspaceTree(options: ResolveForcePushOptions): Promise<ResolveForcePushResult> {
  const { run, rootDir, choice } = options;

  const opMarker = await gitOperationInProgress(rootDir);
  if (opMarker !== null) return { ok: false, reason: 'op-in-progress', detail: opMarker, issues: [] };

  if ((await resolveUpstream(run, rootDir)) === null) return { ok: false, reason: 'no-upstream', issues: [] };

  const fetched = await fetchWorkspaceRemote(run, rootDir);
  if (!fetched.ok) return { ok: false, reason: 'fetch-failed', detail: fetched.detail, issues: [] };

  const upstream = await resolveUpstream(run, rootDir);
  if (upstream === null) return { ok: false, reason: 'no-upstream', issues: [] };

  // Re-verify against the freshly fetched head: the rewrite may have
  // been rewritten AGAIN (back to normal, or to yet another history)
  // between detection and this resolution.
  if (
    upstream.sha === options.lastSyncedRemoteSha ||
    (await isAncestorOf(run, rootDir, options.lastSyncedRemoteSha, upstream.sha))
  ) {
    return { ok: false, reason: 'not-rewritten', detail: upstream.sha, issues: [] };
  }

  const foreignFiles = await readCommitTreeFiles(run, rootDir, upstream.sha);
  if (foreignFiles === null) {
    return { ok: false, reason: 'foreign-invalid', detail: `unreadable tree for ${upstream.sha}`, issues: [] };
  }
  const foreign = readWorkspaceTree(foreignFiles);
  if (foreign.state.workspace === null) {
    return {
      ok: false,
      reason: 'foreign-invalid',
      detail: 'foreign workspace.yaml missing or unparseable',
      issues: foreign.issues,
    };
  }
  if (foreign.state.workspace.uid !== options.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', detail: foreign.state.workspace.uid, issues: foreign.issues };
  }

  const oldHead = await localHeadSha(run, rootDir);
  if (oldHead === null) return { ok: false, reason: 'ref-update-failed', detail: 'no local HEAD', issues: [] };

  const unreadable = (): ResolveForcePushResult => ({
    ok: false,
    reason: 'commit-failed',
    detail: 'the working tree could not be read',
    issues: foreign.issues,
  });

  // The rescue ref is cut further down, on the head that holds every
  // commit of local work — its name has to be free before anything is
  // written.
  let rescueBranch: string | null = null;
  if (choice === 'rescue') {
    rescueBranch = rescueBranchName((options.now ?? (() => new Date()))());
    if ((await resolveRefSha(run, rootDir, `refs/heads/${rescueBranch}`)) !== null) {
      return {
        ok: false,
        reason: 'ref-update-failed',
        detail: `${rescueBranch} already exists`,
        issues: foreign.issues,
      };
    }
  }

  // Local work first. What the engine still has pending reaches the
  // disk, the working tree is read once, and uncommitted work in a file
  // the two heads hold differently is committed on the pre-resolution
  // head — the resolution is about to replace or re-apply those files.
  // Uncommitted work anywhere else is not the resolution's to commit.
  await options.flush();
  const heads = await diffForeignPaths(run, rootDir, oldHead, upstream.sha);
  const before = await snapshotWorkingTree(run, rootDir);
  if (heads === null || before === null) return unreadable();
  const between = [...heads.changed, ...heads.removed];
  const committedFirst = await uncommittedAmong(run, rootDir, between);
  if (committedFirst === null) return unreadable();
  if (committedFirst.length > 0) {
    const local = await options.commitLocalWork({ tree: before, paths: committedFirst });
    if (!local.ok) return { ok: false, reason: 'commit-failed', detail: local.detail, issues: foreign.issues };
  }

  // The path classification that gates the delta: `abandon`/`rescue`
  // converge the FULL tree to the foreign snapshot (everything foreign
  // is tree-authored; everything local-only tombstones); `reapply`
  // ingests only what the remote genuinely changed since the watermark
  // — everything else stays engine-owned, so local work survives.
  let changed: Set<string>;
  let removed: Set<string>;
  if (choice === 'reapply') {
    const diff = await diffForeignPaths(run, rootDir, options.lastSyncedRemoteSha, upstream.sha);
    if (diff === null) {
      return {
        ok: false,
        reason: 'foreign-invalid',
        detail: `undiffable range ${options.lastSyncedRemoteSha}..${upstream.sha}`,
        issues: foreign.issues,
      };
    }
    changed = diff.changed;
    removed = diff.removed;
  } else {
    const foreignPaths = new Set(foreignFiles.map((file) => file.path));
    const localPaths = (await listTreeYamlPaths(run, rootDir, 'HEAD')) ?? [];
    changed = foreignPaths;
    removed = new Set(localPaths.filter((entry) => !foreignPaths.has(entry)));
  }

  const snapshot = await options.readSnapshot();
  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: withCommitSecretRows({
      state: foreign.state,
      files: foreignFiles,
      local: snapshot.environments,
      touched: (filePath) => changed.has(filePath) || removed.has(filePath),
    }),
    changedPaths: changed,
    removedPaths: removed,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
  });
  if (batches.length > 0) {
    await options.apply(batches);
  }

  await releaseHealedQuarantine(rootDir, foreign.issues);
  await writeForeignQuarantine(rootDir, foreignFiles, foreign.issues, changed);

  await options.flush();

  // The user's own files follow the choice too (`own-files.ts`), while
  // HEAD is still the pre-resolution head: `reapply` reads three-way
  // against the watermark, so a local change survives; `abandon` and
  // `rescue` take the foreign side's file wherever the two heads differ.
  const own = await landForeignOwnFiles(run, rootDir, {
    baseRef: choice === 'reapply' ? options.lastSyncedRemoteSha : 'HEAD',
    foreignRef: upstream.sha,
  });
  if (!own.ok) return { ok: false, reason: 'commit-failed', detail: own.detail, issues: foreign.issues };

  // The second reading: what the two differ in is what the resolution
  // wrote. A file it wrote outside the two heads' difference that held
  // uncommitted work is committed first too, as it stood before.
  const pass = await readPassWrites(run, rootDir, before);
  if (pass === null) return unreadable();
  const late = pass.wrote.filter((filePath) => pass.uncommitted.has(filePath));
  if (late.length > 0) {
    const local = await options.commitLocalWork({ tree: before, paths: late });
    if (!local.ok) return { ok: false, reason: 'commit-failed', detail: local.detail, issues: foreign.issues };
  }
  const committedLocal = [...new Set([...committedFirst, ...late])].sort();

  // The rescue ref takes the pre-resolution head with those commits on
  // it — the complete local history, never a history edit.
  if (rescueBranch !== null) {
    const rescued = await createRescueBranch(run, rootDir, rescueBranch, (await localHeadSha(run, rootDir)) ?? oldHead);
    if (!rescued.ok) return { ok: false, reason: 'ref-update-failed', detail: rescued.detail, issues: foreign.issues };
  }

  // The deliberate ref move the user chose in the dialog — CAS on the
  // pre-resolution head, §3.3 index resync; ancestry is irrelevant by
  // construction here.
  const moved = await fastForwardWorkspaceBranch(run, rootDir, upstream.sha);
  if (!moved.ok) return { ok: false, reason: 'ref-update-failed', detail: moved.detail, issues: foreign.issues };

  // The follow-up carries the resolution's own files — where the two
  // heads differed, and what the pass wrote — as the tree holds them
  // now: on `reapply` that is the local side re-applied, otherwise the
  // engine's residue. Uncommitted work elsewhere stays uncommitted.
  const paths = await recordablePaths(run, rootDir, pass.after, [...new Set([...between, ...pass.wrote])].sort());
  if (paths === null) return unreadable();
  const followUp = await commitWorkspaceTree({
    run,
    rootDir,
    message: choice === 'reapply' ? 'Re-apply local changes' : 'Normalize pulled changes',
    identityEnv: options.identityEnv,
    bypassHooks: options.bypassHooks,
    fromTree: pass.after,
    paths,
  });
  if (!followUp.ok) return { ok: false, reason: 'commit-failed', detail: followUp.detail, issues: foreign.issues };
  const sha = followUp.committed ? followUp.sha : upstream.sha;

  return {
    ok: true,
    sha,
    remoteSha: upstream.sha,
    rescueBranch,
    issues: foreign.issues,
    ...(committedLocal.length > 0 ? { committedLocal } : {}),
  };
}

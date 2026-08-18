/**
 * Force-push resolution pass — a detected remote history rewrite is
 * resolved by the §16 trichotomy, never merged silently and never
 * auto-rebased (the git-sync plan §10 Phase 5; the sync-engine design §16;
 * the data-plane topologies design §6.4).
 *
 * The caller (runtime) has already committed local uncommitted work
 * under its own semantic draft, so the pre-resolution HEAD carries the
 * complete local material — the §9.3 commit watermark guarantees the
 * mutations behind it were never compacted away. The three choices:
 *
 *   - `abandon` — the rewritten remote head becomes the workspace
 *     state: the engine converges to the foreign snapshot wholesale
 *     (full-tree delta through the mutators — still no second data
 *     plane), the branch ref moves to the remote head, and any
 *     canonicalization residue commits as an ordinary follow-up. The
 *     pre-resolution history stays reachable only through the reflog.
 *   - `rescue` — identical to `abandon`, but the pre-resolution HEAD
 *     is first preserved on a NEW `oh-rescue-<ts>` branch
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
import { readWorkspaceTree, type TreeIssue, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
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
  resolveUpstream,
} from '../git';
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
  identityEnv: Record<string, string>;
  bypassHooks: boolean;
}

export type ResolveForcePushResult =
  | { ok: true; sha: string; remoteSha: string; rescueBranch: string | null; issues: TreeIssue[] }
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

  let rescueBranch: string | null = null;
  if (choice === 'rescue') {
    rescueBranch = rescueBranchName((options.now ?? (() => new Date()))());
    const rescued = await createRescueBranch(run, rootDir, rescueBranch, oldHead);
    if (!rescued.ok) return { ok: false, reason: 'ref-update-failed', detail: rescued.detail, issues: foreign.issues };
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
    next: foreign.state,
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

  // The deliberate ref move the user chose in the dialog — CAS on the
  // pre-resolution head, §3.3 index resync; ancestry is irrelevant by
  // construction here.
  const moved = await fastForwardWorkspaceBranch(run, rootDir, upstream.sha);
  if (!moved.ok) return { ok: false, reason: 'ref-update-failed', detail: moved.detail, issues: foreign.issues };

  const followUp = await commitWorkspaceTree({
    run,
    rootDir,
    message: choice === 'reapply' ? 'Re-apply local changes' : 'Normalize pulled changes',
    identityEnv: options.identityEnv,
    bypassHooks: options.bypassHooks,
  });
  if (!followUp.ok) return { ok: false, reason: 'commit-failed', detail: followUp.detail, issues: foreign.issues };
  const sha = followUp.committed ? followUp.sha : upstream.sha;

  return { ok: true, sha, remoteSha: upstream.sha, rescueBranch, issues: foreign.issues };
}

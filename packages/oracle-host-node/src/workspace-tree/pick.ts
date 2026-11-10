/**
 * Pick pass — ONE commit's own change onto the current branch, as a
 * new one-parent commit (Cherry-Pick), or the same change undone
 * (Revert). `git cherry-pick` / `git revert` are never invoked: they
 * merge text and can stop mid-way with markers in the tree; here the
 * change converges through the mutators like every other tree-borne
 * edit, and the pass either records its commit or leaves the branch
 * exactly as it found it.
 *
 * The pull's shape does not fit — it makes each touched entity take
 * the foreign document whole, which would drag in everything the
 * commit's branch did before it. So the commit is read as two trees
 * (its parent and itself) and `applyCommitChange` lays only that step
 * over the engine's snapshot; the ordinary delta runs on the result.
 *
 * The sequence, on the binding's chain:
 *
 *   1. hold if a git operation is in progress; refuse a sha the repo
 *      does not hold and a commit without exactly one parent (a merge
 *      has no single change of its own; the first commit has none to
 *      read against);
 *   2. read both trees; a document the commit touched that does not
 *      parse refuses the pass — an unreadable side would read as a
 *      creation or a deletion;
 *   3. lay the change over the snapshot. A document BOTH sides changed
 *      in the same place stops the pass here, named, with nothing
 *      written — not even the local work's commit;
 *   4. local uncommitted work commits first under its own draft (the
 *      pull's posture), so the pick's commit carries the pick alone;
 *   5. the delta's batches apply, the tree materializes, and the
 *      commit's changes to the user's own files land by the own-files
 *      rule (`own-files.ts`: a file the branch also changed keeps its
 *      local bytes and is named);
 *   6. one temp-index commit records it, authored by the operator.
 *      A pick that changes nothing answers `empty`.
 */

import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import {
  applyCommitChange,
  type CommitChangeSkip,
  readWorkspaceTree,
  type TreeIssue,
} from '@openheaders/core/workspace-tree';
import {
  commitParents,
  commitWorkspaceTree,
  composePickMessage,
  composeRevertMessage,
  diffForeignPaths,
  gitOperationInProgress,
  isCommitSha,
  readCommitAuthorIdentity,
  readCommitMeta,
  readCommitTreeFiles,
  resolveRefSha,
} from '../git';
import { landForeignOwnFiles } from './own-files';
import type { IntegrateForeignDeps } from './pull';

/** `pick` lays the commit's change over the branch; `revert` lays its opposite. */
export type ApplyCommitMode = 'pick' | 'revert';

export interface ApplyWorkspaceCommitOptions extends IntegrateForeignDeps {
  /** The FULL sha of the commit whose change is applied. */
  sha: string;
  mode: ApplyCommitMode;
  /** Commit the local uncommitted work under its own draft — called once the change is known to apply. */
  commitLocalWork: () => Promise<{ ok: true } | { ok: false; detail: string }>;
}

export type ApplyWorkspaceCommitResult =
  | {
      ok: true;
      sha: string;
      /** Parts of the change that were not taken (`applyCommitChange`). */
      skipped: CommitChangeSkip[];
      /** The user's own files both sides changed — the local file stood. */
      keptLocal?: string[];
    }
  | {
      ok: false;
      reason:
        | 'op-in-progress'
        | 'unknown-commit'
        | 'unsupported-commit'
        | 'foreign-invalid'
        | 'identity-mismatch'
        | 'conflicts'
        | 'empty'
        | 'commit-failed';
      detail?: string;
      /** `conflicts`: the documents both sides changed, by their path in the commit. */
      conflicts?: string[];
      /** `empty`: what was not taken, when that is why nothing changed. */
      skipped?: CommitChangeSkip[];
      keptLocal?: string[];
      issues: TreeIssue[];
    };

const dirOf = (filePath: string): string => {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
};

export async function applyWorkspaceCommit(options: ApplyWorkspaceCommitOptions): Promise<ApplyWorkspaceCommitResult> {
  const { run, rootDir, sha, mode } = options;

  const opMarker = await gitOperationInProgress(rootDir);
  if (opMarker !== null) return { ok: false, reason: 'op-in-progress', detail: opMarker, issues: [] };

  if (!isCommitSha(sha) || (await resolveRefSha(run, rootDir, sha)) === null) {
    return { ok: false, reason: 'unknown-commit', detail: sha, issues: [] };
  }
  const parents = await commitParents(run, rootDir, sha);
  const source = await readCommitMeta(run, rootDir, sha);
  if (parents === null || source === null) return { ok: false, reason: 'unknown-commit', detail: sha, issues: [] };
  if (parents.length !== 1) {
    return { ok: false, reason: 'unsupported-commit', detail: parents.length === 0 ? 'root' : 'merge', issues: [] };
  }
  const parent = parents[0];

  const commitFiles = await readCommitTreeFiles(run, rootDir, sha);
  const parentFiles = await readCommitTreeFiles(run, rootDir, parent);
  const diff = await diffForeignPaths(run, rootDir, parent, sha);
  if (commitFiles === null || parentFiles === null || diff === null) {
    return { ok: false, reason: 'foreign-invalid', detail: `unreadable tree for ${sha}`, issues: [] };
  }
  const commitTree = readWorkspaceTree(commitFiles);
  const parentTree = readWorkspaceTree(parentFiles);
  if (commitTree.state.workspace === null) {
    return {
      ok: false,
      reason: 'foreign-invalid',
      detail: 'workspace.yaml missing or unparseable in the commit',
      issues: commitTree.issues,
    };
  }
  if (commitTree.state.workspace.uid !== options.workspaceUid) {
    return { ok: false, reason: 'identity-mismatch', detail: commitTree.state.workspace.uid, issues: [] };
  }
  const touchedDirs = new Set([...diff.changed, ...diff.removed].map(dirOf));
  const unreadable = [...commitTree.issues, ...parentTree.issues].filter((issue) => touchedDirs.has(dirOf(issue.path)));
  if (unreadable.length > 0) {
    return { ok: false, reason: 'foreign-invalid', detail: unreadable[0].path, issues: unreadable };
  }

  const picking = mode === 'pick';
  const snapshot = await options.readSnapshot();
  const change = applyCommitChange({
    current: snapshot,
    from: picking ? parentTree.state : commitTree.state,
    to: picking ? commitTree.state : parentTree.state,
  });
  if (change.conflicts.length > 0) {
    return { ok: false, reason: 'conflicts', conflicts: change.conflicts.map((document) => document.path), issues: [] };
  }

  const local = await options.commitLocalWork();
  if (!local.ok) return { ok: false, reason: 'commit-failed', detail: local.detail, issues: [] };

  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: change.next,
    changedPaths: change.changedPaths,
    removedPaths: change.removedPaths,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
  });
  if (batches.length > 0) await options.apply(batches);
  await options.flush();

  // The commit below stages the working tree — the change's own files
  // must be on disk before it does.
  const own = await landForeignOwnFiles(
    run,
    rootDir,
    picking ? { baseRef: parent, foreignRef: sha } : { baseRef: sha, foreignRef: parent },
  );
  if (!own.ok) return { ok: false, reason: 'commit-failed', detail: own.detail, issues: [] };
  const withKept = own.kept.length > 0 ? { keptLocal: own.kept } : {};

  const operator = await readCommitAuthorIdentity(run, rootDir, options.identityEnv);
  const commit = await commitWorkspaceTree({
    run,
    rootDir,
    message: picking ? composePickMessage(source, sha, operator?.email ?? null) : composeRevertMessage(source, sha),
    identityEnv: options.identityEnv,
    bypassHooks: options.bypassHooks,
  });
  if (!commit.ok) return { ok: false, reason: 'commit-failed', detail: commit.detail, issues: [] };
  if (!commit.committed) {
    return {
      ok: false,
      reason: 'empty',
      ...(change.skipped.length > 0 ? { skipped: change.skipped } : {}),
      ...withKept,
      issues: [],
    };
  }
  return { ok: true, sha: commit.sha, skipped: change.skipped, ...withKept };
}

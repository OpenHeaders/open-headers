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
 *      written — not even the local work's commit. The refusal carries
 *      the files to answer and a token naming this reading of them; a
 *      call that hands the token back with an answer per file goes on,
 *      with those documents as answered (`commit-conflicts.ts`). A
 *      token the branch has moved away from refuses again, with the
 *      files as they stand now. A file of the user's own (a README, a
 *      script) both sides changed is one more file to answer when it is
 *      text on every side — the working tree is the branch's side;
 *   4. the delta's batches apply, the tree materializes, and the
 *      commit's changes to the user's own files land by the own-files
 *      rule (`own-files.ts`: an answered file is written as answered; a
 *      file the branch also changed that could not be shown keeps its
 *      local bytes and is named). The working tree is read as a tree
 *      object before and after — the two differ in exactly the files
 *      the pass wrote;
 *   5. one temp-index commit records those files and no other, authored
 *      by the operator. Uncommitted work elsewhere — a modified file
 *      the change did not touch, an unversioned file — is not the
 *      pass's to commit and stays as it was. Uncommitted work IN a file
 *      the pass wrote is committed first, from the first reading, so
 *      the pick's commit still carries the pick alone.
 *      A pick that writes nothing answers `empty`.
 */

import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import {
  applyCommitChange,
  type CommitChangeSkip,
  type CommitConflictFile,
  type CommitResolution,
  commitConflictDocuments,
  readCommitResolutions,
  readWorkspaceTree,
  type TreeIssue,
  withCommitSecretRows,
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
  snapshotWorkingTree,
} from '../git';
import { landForeignOwnFiles, readOwnFileConflicts } from './own-files';
import type { IntegrateForeignDeps } from './pull';
import { hashTreeContent } from './sidecar';

/** `pick` lays the commit's change over the branch; `revert` lays its opposite. */
export type ApplyCommitMode = 'pick' | 'revert';

/** A `conflicts` refusal sends its files only while their texts fit in this many characters. */
export const COMMIT_CONFLICT_MAX_CHARS = 2 * 1_048_576;

/** The files of a `conflicts` refusal, and the token that names this reading of them. */
export interface ApplyCommitResolve {
  token: string;
  files: CommitConflictFile[];
}

/** The answers to a `conflicts` refusal, with the token they were made against. */
export interface ApplyCommitResolution {
  token: string;
  files: CommitResolution[];
}

export interface ApplyWorkspaceCommitOptions extends IntegrateForeignDeps {
  /** The FULL sha of the commit whose change is applied. */
  sha: string;
  mode: ApplyCommitMode;
  /** Answers to the documents both sides changed — absent on the first call. */
  resolution?: ApplyCommitResolution;
  /** Record the uncommitted work in the files the change wrote, as its own commit, before the change's. */
  commitLocalWork: (work: LocalWorkFirst) => Promise<{ ok: true } | { ok: false; detail: string }>;
}

/** Uncommitted work the change's commit would otherwise carry: `paths` as `tree` holds them. */
export interface LocalWorkFirst {
  /** The working tree as it stood before the pass wrote (`snapshotWorkingTree`). */
  tree: string;
  paths: string[];
}

export type ApplyWorkspaceCommitResult =
  | {
      ok: true;
      sha: string;
      /** Parts of the change that were not taken (`applyCommitChange`). */
      skipped: CommitChangeSkip[];
      /** The user's own files both sides changed — the local file stood. */
      keptLocal?: string[];
      /** Files the change wrote that held uncommitted work — that work was committed first. */
      committedLocal?: string[];
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
        | 'resolution-invalid'
        | 'empty'
        | 'commit-failed';
      detail?: string;
      /** `conflicts`: the documents both sides changed, by their path in the commit, then the user's own files. */
      conflicts?: string[];
      /** `conflicts`: the files to answer — absent when their texts are too large to send. */
      resolve?: ApplyCommitResolve;
      /** `conflicts`: the files' texts are too large to send — there is nothing to answer here. */
      tooLarge?: true;
      /** `resolution-invalid`: the answered file that could not be taken. */
      file?: string;
      /** `empty`: what was not taken, when that is why nothing changed. */
      skipped?: CommitChangeSkip[];
      keptLocal?: string[];
      issues: TreeIssue[];
    };

const dirOf = (filePath: string): string => {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
};

const textsOf = (file: CommitConflictFile): Array<string | null> => [
  file.base ?? null,
  file.theirs ?? null,
  file.mine ?? null,
];

/** Names one reading of the conflicted files: the commit, the direction, and every text on every side. */
function conflictToken(sha: string, mode: ApplyCommitMode, files: readonly CommitConflictFile[]): string {
  return hashTreeContent(JSON.stringify([sha, mode, files.map((file) => [file.path, ...textsOf(file)])]));
}

function fitsOnTheWire(files: readonly CommitConflictFile[]): boolean {
  let chars = 0;
  for (const file of files) {
    for (const text of textsOf(file)) chars += text?.length ?? 0;
  }
  return chars <= COMMIT_CONFLICT_MAX_CHARS;
}

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
  // Neither tree carries a secret file; both read their secret rows
  // from the template they committed, so a commit that did not touch
  // one leaves the branch's secret rows out of the change.
  const commitState = withCommitSecretRows({
    state: commitTree.state,
    files: commitFiles,
    local: snapshot.environments,
  });
  const parentState = withCommitSecretRows({
    state: parentTree.state,
    files: parentFiles,
    local: snapshot.environments,
  });
  const from = picking ? parentState : commitState;
  const to = picking ? commitState : parentState;
  // The user's own files both sides changed, as far as a person can
  // answer them. Read before anything is written — the working tree is
  // still the branch's side, uncommitted work included.
  const ownRefs = picking ? { baseRef: parent, foreignRef: sha } : { baseRef: sha, foreignRef: parent };
  const ownConflicts = await readOwnFileConflicts(run, rootDir, ownRefs);
  if (!ownConflicts.ok) return { ok: false, reason: 'foreign-invalid', detail: ownConflicts.detail, issues: [] };

  let change = applyCommitChange({ current: snapshot, from, to });
  const documents =
    change.conflicts.length > 0
      ? commitConflictDocuments({ current: snapshot, from, to, conflicts: change.conflicts })
      : [];
  const documentFiles = documents.flatMap((document) => document.files);
  // The own files join the answer while every text still fits; past
  // that they stay kept and named, and the documents alone are asked.
  const ownFiles = fitsOnTheWire([...documentFiles, ...ownConflicts.files]) ? ownConflicts.files : [];
  const files = [...documentFiles, ...ownFiles];

  // Conflicts no file shows: the branch's document stands, and the answer says so.
  const shown = new Set(documents.filter((document) => document.files.length > 0).map((document) => document.uid));
  const unshown: CommitChangeSkip[] = change.conflicts
    .filter((conflict) => !shown.has(conflict.uid))
    .map((conflict) => ({ ...conflict, reason: 'conflict-unshown' }));

  const ownAnswers = new Map<string, string>();
  let documentAnswers: readonly CommitResolution[] = options.resolution?.files ?? [];
  if (files.length > 0) {
    const token = conflictToken(sha, mode, files);
    const answered = options.resolution;
    if (answered?.token !== token) {
      const conflicts = [...change.conflicts.map((document) => document.path), ...ownFiles.map((file) => file.path)];
      if (!fitsOnTheWire(files)) return { ok: false, reason: 'conflicts', conflicts, tooLarge: true, issues: [] };
      return { ok: false, reason: 'conflicts', conflicts, resolve: { token, files }, issues: [] };
    }
    const ownPaths = new Set(ownFiles.map((file) => file.path));
    for (const answer of answered.files) {
      if (ownPaths.has(answer.path)) ownAnswers.set(answer.path, answer.content);
    }
    for (const file of ownFiles) {
      if (!ownAnswers.has(file.path)) {
        return {
          ok: false,
          reason: 'resolution-invalid',
          detail: 'no answer for this file',
          file: file.path,
          issues: [],
        };
      }
    }
    documentAnswers = answered.files.filter((answer) => !ownPaths.has(answer.path));
    if (documentFiles.length === 0 && documentAnswers.length > 0) {
      return {
        ok: false,
        reason: 'resolution-invalid',
        detail: 'not a file of this conflict',
        file: documentAnswers[0].path,
        issues: [],
      };
    }
  }
  if (change.conflicts.length > 0) {
    // A conflict whose texts show nothing apart has no file to answer —
    // the branch's document stands, named as left out, and the pass goes on.
    const read = readCommitResolutions({ current: snapshot, documents, resolutions: documentAnswers });
    if (!read.ok) {
      return { ok: false, reason: 'resolution-invalid', detail: read.message, file: read.path, issues: [] };
    }
    change = applyCommitChange({ current: snapshot, from, to, resolved: read.resolved });
    if (change.conflicts.length > 0) {
      return {
        ok: false,
        reason: 'conflicts',
        conflicts: change.conflicts.map((document) => document.path),
        issues: [],
      };
    }
  }

  const skipped = [...change.skipped, ...unshown];

  // From here the pass writes. What the engine still has pending is
  // local work, not the change's: it reaches the disk first, and the
  // working tree is read as it stands before and after the pass — the
  // two readings differ in the change's own writes and nothing else.
  await options.flush();
  const before = await snapshotWorkingTree(run, rootDir);
  if (before === null) {
    return { ok: false, reason: 'commit-failed', detail: 'the working tree could not be read', issues: [] };
  }

  const batches = synthesizeWorkspaceTreeDelta({
    prev: snapshot,
    next: change.next,
    changedPaths: change.changedPaths,
    removedPaths: change.removedPaths,
    deps: { nextCtx: options.nextCtx, liveSetEntries: options.liveSetEntries },
  });
  if (batches.length > 0) await options.apply(batches);
  await options.flush();

  // The second reading is taken once the change's own files are on disk too.
  const own = await landForeignOwnFiles(run, rootDir, ownRefs, ownAnswers);
  if (!own.ok) return { ok: false, reason: 'commit-failed', detail: own.detail, issues: [] };
  const withKept = own.kept.length > 0 ? { keptLocal: own.kept } : {};

  const after = await snapshotWorkingTree(run, rootDir);
  const wrote = after === null ? null : await diffForeignPaths(run, rootDir, before, after);
  const uncommitted = await diffForeignPaths(run, rootDir, 'HEAD', before);
  if (after === null || wrote === null || uncommitted === null) {
    return { ok: false, reason: 'commit-failed', detail: 'the working tree could not be read', issues: [] };
  }
  const paths = [...wrote.changed, ...wrote.removed].sort();
  const empty: ApplyWorkspaceCommitResult = {
    ok: false,
    reason: 'empty',
    ...(skipped.length > 0 ? { skipped } : {}),
    ...withKept,
    issues: [],
  };
  if (paths.length === 0) return empty;

  // Uncommitted work in a file the change wrote would ride into the
  // change's commit — it is recorded first, as the file stood before
  // the pass. Work in any other file is not the pass's to commit.
  const shared = paths.filter((filePath) => uncommitted.changed.has(filePath) || uncommitted.removed.has(filePath));
  if (shared.length > 0) {
    const local = await options.commitLocalWork({ tree: before, paths: shared });
    if (!local.ok) return { ok: false, reason: 'commit-failed', detail: local.detail, issues: [] };
  }

  const operator = await readCommitAuthorIdentity(run, rootDir, options.identityEnv);
  const commit = await commitWorkspaceTree({
    run,
    rootDir,
    message: picking ? composePickMessage(source, sha, operator?.email ?? null) : composeRevertMessage(source, sha),
    identityEnv: options.identityEnv,
    bypassHooks: options.bypassHooks,
    fromTree: after,
    paths,
  });
  if (!commit.ok) return { ok: false, reason: 'commit-failed', detail: commit.detail, issues: [] };
  if (!commit.committed) return empty;
  return { ok: true, sha: commit.sha, skipped, ...withKept, ...(shared.length > 0 ? { committedLocal: shared } : {}) };
}

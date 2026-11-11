/**
 * A change laid over the branch, decided before anything is written —
 * the half every pass that lands another commit's work shares: a pick,
 * a revert, a pull, a branch merge.
 *
 * `applyCommitChange` lays the change (`from` → `to`) over the engine's
 * snapshot value by value and names the documents both sides changed in
 * one value. Those, and the user's own text files both sides changed,
 * are files a person answers: the pass refuses `conflicts` carrying them
 * with a token naming this reading, and the same call with an answer
 * per file and that token goes on with the documents as answered. The
 * answer may instead be one side for all of them: every value both
 * sides changed goes to that side, what only one side changed still
 * stands on both, and an own file takes that side whole. A token the
 * branch has moved away from refuses again, with the files as they
 * stand now. A conflict none of its files shows keeps the branch's
 * document and is named among the parts not taken.
 *
 * Before either, a change about to write a file that holds uncommitted
 * work refuses `local-changes`, naming the files, unless that work may
 * be committed first without asking.
 *
 * Nothing here writes: a refusal leaves the branch and the tree as they
 * were.
 */

import {
  applyCommitChange,
  type CommitChange,
  type CommitChangeDocument,
  type CommitChangeSide,
  type CommitChangeSkip,
  type CommitConflictFile,
  type CommitResolution,
  commitConflictDocuments,
  readCommitResolutions,
  type TreeReadResult,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import type { GitRunner } from '../git';
import { type OwnFileRefs, readOwnFileConflicts } from './own-files';
import { uncommittedAmong } from './pass-writes';
import { hashTreeContent } from './sidecar';

/** A `conflicts` refusal sends its files only while their texts fit in this many characters. */
export const COMMIT_CONFLICT_MAX_CHARS = 2 * 1_048_576;

/** The files of a `conflicts` refusal, and the token that names this reading of them. */
export interface ApplyCommitResolve {
  token: string;
  files: CommitConflictFile[];
}

/** The answers to a `conflicts` refusal, with the token they were made against: one per file, or one side for all. */
export type ApplyCommitResolution =
  | { token: string; files: CommitResolution[] }
  | { token: string; side: CommitChangeSide };

export interface DecideChangeArgs {
  run: GitRunner;
  rootDir: string;
  /** What names the change in the token: the commit and the direction, or the foreign head. */
  subject: readonly string[];
  /** The engine's snapshot — the branch as it stands. */
  current: WorkspaceTreeState;
  from: TreeReadResult['state'];
  to: TreeReadResult['state'];
  /** The files the change removed, when a diff of its two commits names them (`applyCommitChange`). */
  removedPaths?: ReadonlySet<string>;
  /** The commits the user's own files are read between. */
  ownRefs: OwnFileRefs;
  /** Answers to a `conflicts` refusal — absent on the first call. */
  resolution?: ApplyCommitResolution;
  mayCommitLocalWork: boolean;
  /** The files the pass is about to write — the question about uncommitted work is asked of these. */
  writes: (change: CommitChange, ownFiles: readonly CommitConflictFile[]) => readonly string[];
  /**
   * A conflict the caller rules for the change without asking — a
   * document the change's start did not read has no value to compare
   * against, so the change's document stands.
   */
  unasked?: (conflict: CommitChangeDocument) => boolean;
}

export type ChangeDecision =
  | {
      ok: true;
      /** The change over the branch, as answered. */
      change: CommitChange;
      /** Parts of the change that were not taken, the conflicts no file shows among them. */
      skipped: CommitChangeSkip[];
      /** The answers to the user's own files, by path. */
      ownAnswers: Map<string, string>;
    }
  | {
      ok: false;
      reason: 'foreign-invalid' | 'local-changes' | 'conflicts' | 'resolution-invalid' | 'commit-failed';
      detail?: string;
      /** `local-changes`: the files the change would write that hold uncommitted work. */
      localChanges?: string[];
      /** `conflicts`: the documents both sides changed, by their path in the change, then the user's own files. */
      conflicts?: string[];
      /** `conflicts`: the files to answer — absent when their texts are too large to send. */
      resolve?: ApplyCommitResolve;
      /** `conflicts`: the files' texts are too large to send — there is nothing to answer here. */
      tooLarge?: true;
      /** `resolution-invalid`: the answered file that could not be taken. */
      file?: string;
    };

const textsOf = (file: CommitConflictFile): Array<string | null> => [
  file.base ?? null,
  file.theirs ?? null,
  file.mine ?? null,
];

/** Names one reading of the conflicted files: the change, and every text on every side. */
function conflictToken(subject: readonly string[], files: readonly CommitConflictFile[]): string {
  return hashTreeContent(JSON.stringify([...subject, files.map((file) => [file.path, ...textsOf(file)])]));
}

function fitsOnTheWire(files: readonly CommitConflictFile[]): boolean {
  let chars = 0;
  for (const file of files) {
    for (const text of textsOf(file)) chars += text?.length ?? 0;
  }
  return chars <= COMMIT_CONFLICT_MAX_CHARS;
}

export async function decideChange(args: DecideChangeArgs): Promise<ChangeDecision> {
  const { run, rootDir, current, from, to } = args;
  const range = { current, from, to, ...(args.removedPaths !== undefined ? { removedPaths: args.removedPaths } : {}) };
  const asked = (change: CommitChange): CommitChangeDocument[] =>
    args.unasked === undefined ? change.conflicts : change.conflicts.filter((conflict) => !args.unasked?.(conflict));

  // The user's own files both sides changed, as far as a person can
  // answer them. Read before anything is written — the working tree is
  // still the branch's side, uncommitted work included.
  const ownConflicts = await readOwnFileConflicts(run, rootDir, args.ownRefs);
  if (!ownConflicts.ok) return { ok: false, reason: 'foreign-invalid', detail: ownConflicts.detail };

  let change = applyCommitChange(range);
  const conflicts = asked(change);
  const documents = conflicts.length > 0 ? commitConflictDocuments({ current, from, to, conflicts }) : [];
  const documentFiles = documents.flatMap((document) => document.files);
  // The own files join the answer while every text still fits; past
  // that they stay kept and named, and the documents alone are asked.
  const ownFiles = fitsOnTheWire([...documentFiles, ...ownConflicts.files]) ? ownConflicts.files : [];
  const files = [...documentFiles, ...ownFiles];

  // Uncommitted work in a file the change is about to write has to be
  // committed first, or it would ride into the change's commit — that
  // is asked before anything else, while nothing is written.
  if (!args.mayCommitLocalWork) {
    const localChanges = await uncommittedAmong(run, rootDir, args.writes(change, ownFiles));
    if (localChanges === null) {
      return { ok: false, reason: 'commit-failed', detail: 'the working tree could not be read' };
    }
    if (localChanges.length > 0) return { ok: false, reason: 'local-changes', localChanges };
  }

  // Conflicts no file shows: the branch's document stands, and the answer says so.
  const shown = new Set(documents.filter((document) => document.files.length > 0).map((document) => document.uid));
  const unshown: CommitChangeSkip[] = conflicts
    .filter((conflict) => !shown.has(conflict.uid))
    .map((conflict) => ({ ...conflict, reason: 'conflict-unshown' }));

  const ownAnswers = new Map<string, string>();
  const answered = args.resolution;
  const side = answered !== undefined && 'side' in answered ? answered.side : undefined;
  const fileAnswers: readonly CommitResolution[] = answered !== undefined && 'files' in answered ? answered.files : [];
  let documentAnswers = fileAnswers;
  if (files.length > 0) {
    const token = conflictToken(args.subject, files);
    if (answered?.token !== token) {
      const named = [...conflicts.map((document) => document.path), ...ownFiles.map((file) => file.path)];
      if (!fitsOnTheWire(files)) return { ok: false, reason: 'conflicts', conflicts: named, tooLarge: true };
      return { ok: false, reason: 'conflicts', conflicts: named, resolve: { token, files } };
    }
    const ownPaths = new Set(ownFiles.map((file) => file.path));
    if (side !== undefined) {
      // One side for all: an own file takes that side's text whole — a side that holds none means gone.
      for (const file of ownFiles) ownAnswers.set(file.path, file[side] ?? '');
    }
    for (const answer of fileAnswers) {
      if (ownPaths.has(answer.path)) ownAnswers.set(answer.path, answer.content);
    }
    for (const file of ownFiles) {
      if (!ownAnswers.has(file.path)) {
        return { ok: false, reason: 'resolution-invalid', detail: 'no answer for this file', file: file.path };
      }
    }
    documentAnswers = fileAnswers.filter((answer) => !ownPaths.has(answer.path));
    if (documentFiles.length === 0 && documentAnswers.length > 0) {
      return {
        ok: false,
        reason: 'resolution-invalid',
        detail: 'not a file of this conflict',
        file: documentAnswers[0].path,
      };
    }
  }
  if (conflicts.length > 0) {
    // A conflict whose texts show nothing apart has no file to answer —
    // the branch's document stands, named as left out, and the pass goes on.
    // With one side ruled for all, only those documents are read as
    // answers; every other takes its values from the model.
    const read = readCommitResolutions(
      side === undefined
        ? { current, documents, resolutions: documentAnswers }
        : { current, documents: documents.filter((document) => document.files.length === 0), resolutions: [] },
    );
    if (!read.ok) return { ok: false, reason: 'resolution-invalid', detail: read.message, file: read.path };
    change = applyCommitChange({ ...range, resolved: read.resolved, ...(side !== undefined ? { side } : {}) });
    const left = asked(change);
    if (left.length > 0) {
      return { ok: false, reason: 'conflicts', conflicts: left.map((document) => document.path) };
    }
  }

  return { ok: true, change, skipped: [...change.skipped, ...unshown], ownAnswers };
}

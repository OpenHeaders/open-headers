/**
 * Which git operation a working tree is mid-way through — the name
 * behind the in-progress marker the reconcile passes hold on
 * ({@link gitOperationInProgress}). A person who started a rebase, a
 * merge, a cherry-pick, a revert or a bisect outside the app is told
 * which, instead of a surface that only stands still — and can end it
 * from there: the abort is git's own, for the operation git says is in
 * progress, never one of ours.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { resolveGitDirs } from './git-dir';
import type { GitRunner } from './git-exec';
import { failureDetail, gitOperationInProgress } from './repo';
import { repoArgs } from './repo-args';

export type GitOperation = 'rebase' | 'merge' | 'cherry-pick' | 'revert' | 'bisect';

const BY_MARKER: Readonly<Record<string, GitOperation>> = {
  'rebase-merge': 'rebase',
  'rebase-apply': 'rebase',
  MERGE_HEAD: 'merge',
  CHERRY_PICK_HEAD: 'cherry-pick',
  REVERT_HEAD: 'revert',
  BISECT_LOG: 'bisect',
};

/**
 * The operation in progress, or null when the repo is at rest. Between
 * the steps of a several-commit cherry-pick or revert only the
 * sequencer's directory is left: its todo's next instruction names
 * which of the two it is.
 */
export async function gitOperationKind(rootDir: string): Promise<GitOperation | null> {
  const marker = await gitOperationInProgress(rootDir);
  if (marker === null) return null;
  if (marker !== 'sequencer') return BY_MARKER[marker] ?? null;
  try {
    const { gitDir } = await resolveGitDirs(rootDir);
    const todo = await fs.readFile(path.join(gitDir, 'sequencer', 'todo'), 'utf-8');
    return /^\s*revert\b/.test(todo) ? 'revert' : 'cherry-pick';
  } catch {
    return 'cherry-pick';
  }
}

/** Git's own way out of each operation — the tree and HEAD go back to where the operation found them. */
const ABORT: Readonly<Record<GitOperation, readonly string[]>> = {
  rebase: ['rebase', '--abort'],
  merge: ['merge', '--abort'],
  'cherry-pick': ['cherry-pick', '--abort'],
  revert: ['revert', '--abort'],
  bisect: ['bisect', 'reset'],
};

export type AbortGitOperationResult =
  | { ok: true; operation: GitOperation }
  | { ok: false; reason: 'nothing-in-progress' }
  | { ok: false; reason: 'abort-failed'; operation: GitOperation; detail: string };

/**
 * Abort the operation in progress, whichever it is. Git takes its own
 * index lock for it and refuses in its own words when it cannot; the
 * caller reconciles afterwards as after any change made outside.
 */
export async function abortGitOperation(run: GitRunner, rootDir: string): Promise<AbortGitOperationResult> {
  const operation = await gitOperationKind(rootDir);
  if (operation === null) return { ok: false, reason: 'nothing-in-progress' };
  const result = await run([...repoArgs(rootDir), ...ABORT[operation]], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, reason: 'abort-failed', operation, detail: failureDetail(result) };
  return { ok: true, operation };
}

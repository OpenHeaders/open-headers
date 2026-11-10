/**
 * What a pass wrote, read from the working tree itself — the rule every
 * pass that lands another commit's work on the branch shares (a pick, a
 * revert, a pull, a branch merge): the pass records the files it wrote
 * and no other, and uncommitted work in one of THOSE files is committed
 * first, as its own commit.
 *
 * The working tree is read as a tree object before the pass writes and
 * again after it. The two readings differ in exactly the pass's own
 * writes — documents the engine materialized and the user's own files
 * alike — so no guess decides what is recorded. What the branch's HEAD
 * and the first reading differ in is the uncommitted work that was
 * there before the pass: any of it elsewhere, and every unversioned
 * file, is not the pass's to commit and stays as it was.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  diffForeignPaths,
  type GitRunner,
  type HeldIndexLock,
  listTreeEntries,
  listWorkingChanges,
  snapshotWorkingTree,
} from '../git';

/** Uncommitted work the pass's commit would otherwise carry: `paths` as `tree` holds them. */
export interface LocalWorkFirst {
  /** The working tree as it stood before the pass wrote (`snapshotWorkingTree`). */
  tree: string;
  paths: string[];
  /** The real index's lock the pass holds — the commit rides it. */
  indexLock: HeldIndexLock;
}

/** How a pass gets uncommitted work in the files it writes committed first. */
export interface LocalWorkDeps {
  /**
   * That work may be committed first without asking — the person said
   * so for this pass, or commits are automatic here. Otherwise the pass
   * refuses `local-changes` before it writes, naming those files.
   */
  mayCommitLocalWork: boolean;
  /** Record that work as its own commit, before the pass's. */
  commitLocalWork: (work: LocalWorkFirst) => Promise<{ ok: true } | { ok: false; detail: string }>;
}

export interface PassWrites {
  /** The working tree once the pass has written (`snapshotWorkingTree`). */
  after: string;
  /** The files the pass wrote — what the two readings differ in. */
  wrote: string[];
  /** The files that held uncommitted work before the pass wrote. */
  uncommitted: ReadonlySet<string>;
}

/**
 * Take the second reading and compare. `before` is the first reading,
 * taken once the engine's pending local work was on disk and before the
 * pass wrote anything; HEAD must still be where it was then. Null when
 * the tree cannot be read.
 */
export async function readPassWrites(run: GitRunner, rootDir: string, before: string): Promise<PassWrites | null> {
  const after = await snapshotWorkingTree(run, rootDir);
  if (after === null) return null;
  const wrote = await diffForeignPaths(run, rootDir, before, after);
  const uncommitted = await diffForeignPaths(run, rootDir, 'HEAD', before);
  if (wrote === null || uncommitted === null) return null;
  return {
    after,
    wrote: [...wrote.changed, ...wrote.removed].sort(),
    uncommitted: new Set([...uncommitted.changed, ...uncommitted.removed]),
  };
}

/**
 * The `paths` a commit staged from the reading `tree` may carry. A file
 * the reading could not see — an ignored file standing on disk where
 * the tree holds none — is left out: staged, its absence from the tree
 * would be recorded as a deletion of whatever the branch holds there.
 * Null when the tree cannot be read.
 */
export async function recordablePaths(
  run: GitRunner,
  rootDir: string,
  tree: string,
  paths: readonly string[],
): Promise<string[] | null> {
  const held = await listTreeEntries(run, rootDir, tree);
  if (held === null) return null;
  const recordable: string[] = [];
  for (const filePath of paths) {
    if (held.has(filePath)) {
      recordable.push(filePath);
      continue;
    }
    const unseen = await fs
      .lstat(path.join(rootDir, ...filePath.split('/')))
      .then(() => true)
      .catch(() => false);
    if (!unseen) recordable.push(filePath);
  }
  return recordable;
}

/** The `paths` that hold uncommitted work — modified, deleted or unversioned. Null when the tree cannot be read. */
export async function uncommittedAmong(
  run: GitRunner,
  rootDir: string,
  paths: readonly string[],
): Promise<string[] | null> {
  if (paths.length === 0) return [];
  const changes = await listWorkingChanges(run, rootDir);
  if (changes === null) return null;
  const dirty = new Set(
    changes.flatMap((change) => (change.renamedFrom !== undefined ? [change.path, change.renamedFrom] : [change.path])),
  );
  return [...new Set(paths)].filter((filePath) => dirty.has(filePath)).sort();
}

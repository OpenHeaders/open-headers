/**
 * What a pass wrote, by the account of its own writers — the rule every
 * pass that lands another commit's work on the branch shares (a pick, a
 * revert, a pull, a branch merge, a force-push resolution): the pass
 * records the files it wrote and no other, and uncommitted work in one
 * of THOSE files is committed first, as its own commit.
 *
 * The working tree is read as a tree object once, before the pass
 * writes. Each writer of the pass then says what it wrote: the flush its
 * documents and the hygiene files, the quarantine what git checked out
 * for it, the own-files landing what it checked out, removed and
 * answered. Those paths, as they stand once the pass has written, are
 * laid over that reading (`treeWithWorkingFiles`); a path no writer
 * names stays as the reading has it. A pass runs alone on its folder's
 * chain, so no other flush writes a document while it does.
 *
 * The tree is not read whole a second time. What git sees of a folder
 * follows its ignore files, and a pass can land one: a file of the
 * user's that came into sight between two readings, or left it, would
 * differ in them though the pass never wrote it — recorded in the pass's
 * commit, or committed first as work nobody was asked about.
 *
 * A document the folder's boundary kept the flush from writing — a link
 * stands on the way to it — is in no reading: git sees the link, and
 * nothing beneath it. The commit records what the ENGINE holds there all
 * the same. Each flush answers the planned text of what it was refused,
 * and that is laid over both ends: the engine's pending work as the
 * flush before the pass was refused it, the pass's own as the flush that
 * wrote the pass's work was. A document the pass changed is then the
 * pass's write wherever it could not be written, uncommitted work in one
 * is committed first or carried like any other file's, and the commit
 * holds the document its collection's order names — where it held the
 * order alone, and a merged pull's read as a deletion against the peer's
 * head. The link itself, which the lay takes out of the trees, is no
 * write of the pass. One thing stays as the branch has it: a document
 * beneath a link or a file the branch's own HEAD holds. That entry is
 * the branch's, and a file laid beneath it would take it out of the
 * commit.
 *
 * What the branch's HEAD and the reading differ in is the uncommitted
 * work that was there before the pass: any of it elsewhere, and every
 * unversioned file, is not the pass's to commit and stays as it was.
 */

import { promises as fs } from 'node:fs';
import {
  diffForeignPaths,
  failureCode,
  type GitRunner,
  type HeldIndexLock,
  isGone,
  listTreeEntries,
  listWorkingChanges,
  TreeBoundary,
  treeWithFiles,
  treeWithWorkingFiles,
} from '../git';

/**
 * What a flush says of itself: the files it wrote and removed, how many
 * git's writing held off the disk, and the documents the folder's
 * boundary kept it from writing, each as planned.
 */
export interface FlushAccount {
  held?: number;
  written: readonly string[];
  deleted: readonly string[];
  refused: ReadonlyMap<string, string>;
}

export const flushedPaths = (flush: FlushAccount): string[] => [...flush.written, ...flush.deleted];

/** What a pass's writers say of it. */
export interface PassAccount {
  /** Every path a writer of the pass says it wrote or removed. */
  written: readonly string[];
  /** What the flush BEFORE the pass was refused: the engine's pending work, as planned. */
  refusedBefore: FlushAccount['refused'];
  /** What the flush that wrote the pass's own work was refused. */
  refusedAfter: FlushAccount['refused'];
}

/** Uncommitted work the pass's commit would otherwise carry: `paths` as `tree` holds them. */
export interface LocalWorkFirst {
  /** The folder as it stood before the pass wrote (`PassWrites.before`). */
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
  /** The reading with what the flush before the pass was refused laid over it: the folder as the engine meant it. */
  before: string;
  /** The reading with the pass's writes laid over it (`treeWithWorkingFiles`), and what its flush was refused. */
  after: string;
  /** The files the pass wrote — the paths its writers name that the laying changed. */
  wrote: string[];
  /** The files that held uncommitted work before the pass wrote. */
  uncommitted: ReadonlySet<string>;
  /** The refused documents the two trees hold as the engine means them — a commit takes them as its tree has them. */
  meant: ReadonlySet<string>;
}

/** Whether `head` holds a file or a link at a directory above `filePath`. */
function beneathAnEntry(head: ReadonlyMap<string, string>, filePath: string): boolean {
  for (let cut = filePath.indexOf('/'); cut !== -1; cut = filePath.indexOf('/', cut + 1)) {
    if (head.has(filePath.slice(0, cut))) return true;
  }
  return false;
}

/**
 * Lay the pass's writes over the reading and compare. `reading` is the
 * working tree as a tree object, taken once the engine's pending local
 * work was flushed and before the pass wrote anything; HEAD must still
 * be where it was then. Null when a tree cannot be read or written.
 */
export async function readPassWrites(
  run: GitRunner,
  rootDir: string,
  reading: string,
  account: PassAccount,
): Promise<PassWrites | null> {
  const head = await listTreeEntries(run, rootDir, 'HEAD');
  if (head === null) return null;
  const laid = (refused: FlushAccount['refused']): Map<string, string> =>
    new Map([...refused].filter(([filePath]) => !beneathAnEntry(head, filePath)));
  const refusedBefore = laid(account.refusedBefore);
  const refusedAfter = laid(account.refusedAfter);
  const before = await treeWithFiles(run, rootDir, reading, refusedBefore);
  const worked = await treeWithWorkingFiles(run, rootDir, reading, account.written);
  if (before === null || worked === null) return null;
  const after = await treeWithFiles(run, rootDir, worked, refusedAfter);
  if (after === null) return null;
  const wrote = await diffForeignPaths(run, rootDir, before, after);
  const uncommitted = await diffForeignPaths(run, rootDir, 'HEAD', before);
  if (wrote === null || uncommitted === null) return null;
  const meant = new Set([...refusedBefore.keys(), ...refusedAfter.keys()]);
  // A lay takes a link in a document's way out of the tree: the trees differ there, and no writer named it.
  const named = new Set([...account.written, ...meant]);
  return {
    before,
    after,
    wrote: [...wrote.changed, ...wrote.removed].filter((filePath) => named.has(filePath)).sort(),
    uncommitted: new Set([...uncommitted.changed, ...uncommitted.removed]),
    meant,
  };
}

/**
 * The `paths` a commit staged from `tree` may carry. A refused document
 * the tree holds as the engine means it (`meant`) is carried as the tree
 * has it. Elsewhere, where the tree holds no file at a path, the path is
 * carried only when the folder holds none either, asked at the path's
 * own name. Left out: a file standing there that the reading could not
 * see — one git ignores; a path the folder's boundary refuses that the
 * engine did not answer for, where nothing of ours was read or written
 * and a link on the way would answer for some other folder; a name that
 * will not be looked at. Staged, the tree's absence there would be
 * recorded as a deletion of whatever the branch holds. Null when the
 * tree cannot be read.
 */
export async function recordablePaths(
  run: GitRunner,
  rootDir: string,
  tree: string,
  paths: readonly string[],
  meant: ReadonlySet<string>,
): Promise<string[] | null> {
  const held = await listTreeEntries(run, rootDir, tree);
  if (held === null) return null;
  const boundary = new TreeBoundary(rootDir);
  const recordable: string[] = [];
  for (const filePath of paths) {
    if (held.has(filePath) || meant.has(filePath)) {
      recordable.push(filePath);
      continue;
    }
    const placed = await boundary.locate(filePath);
    if (!placed.ok) continue;
    const gone = await fs.lstat(placed.place.file).then(
      () => false,
      (err: unknown) => isGone(failureCode(err)),
    );
    if (gone) recordable.push(filePath);
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

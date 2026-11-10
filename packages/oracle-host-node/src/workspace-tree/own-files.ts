/**
 * The user's own files across an integration — the half of a pull,
 * branch merge or force-push resolution the mutators never see.
 *
 * The engine converges the workspace DOCUMENTS and writes them itself;
 * a tracked file that is not a document (a README, scripts, assets,
 * `.gitignore`) has no entity behind it, so the foreign side's change
 * to it must be carried to the working tree here — the commit that
 * records the integration stages the working tree, and a file left at
 * its local bytes would be recorded as a revert of the foreign change.
 *
 * Three-way at file level, never a textual merge (no conflict markers
 * can come out of this pass):
 *
 *   foreign == base                  → the foreign side did not touch
 *                                      it; the local file stands;
 *   foreign == head                  → both sides already agree;
 *   head == base, tree clean there   → only the foreign side changed
 *                                      it: its file lands (bytes, mode,
 *                                      link), or the file is removed;
 *   otherwise                        → both sides changed it: the LOCAL
 *                                      file stands and the path is
 *                                      reported as kept.
 *
 * "Clean there" is read from the working tree, not assumed: a tracked
 * path porcelain lists, or an untracked or ignored file sitting where
 * the foreign side adds one, is local work and is kept too.
 *
 * A pass that can ask a person (Cherry-Pick, Revert) reads the kept
 * files that are text on every side as files to answer
 * (`readOwnFileConflicts`) and hands the answers back to the landing:
 * an answered file is written as answered instead of kept. A link, a
 * binary or a file over the cap is never shown — it stays kept and
 * named.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type CommitConflictFile, treeDocumentPaths } from '@openheaders/core/workspace-tree';
import {
  asFileText,
  checkoutPathsFromCommit,
  type FileText,
  type GitRunner,
  listTreeEntries,
  listWorkingChanges,
  readTreeEntryText,
} from '../git';

/** An own file joins the files to answer only while every side of it is at most this many bytes. */
export const OWN_FILE_CONFLICT_MAX_BYTES = 262_144;

export interface ForeignOwnFiles {
  /** Own files only the foreign side changed. */
  incoming: string[];
  /** Own files both sides changed — the local file stands. */
  kept: string[];
}

/**
 * Classify the own files of an integration from the three trees'
 * entries (`path → "<mode> <sha>"`; an empty `base` when the histories
 * share none). Pure: the working tree is the caller's to check.
 */
export function classifyForeignOwnFiles(
  base: ReadonlyMap<string, string>,
  head: ReadonlyMap<string, string>,
  foreign: ReadonlyMap<string, string>,
): ForeignOwnFiles {
  const documents = new Set([...treeDocumentPaths(head.keys()), ...treeDocumentPaths(foreign.keys())]);
  const incoming: string[] = [];
  const kept: string[] = [];
  for (const filePath of new Set([...head.keys(), ...foreign.keys()])) {
    if (documents.has(filePath)) continue;
    const theirs = foreign.get(filePath);
    const ours = head.get(filePath);
    const origin = base.get(filePath);
    if (theirs === ours || theirs === origin) continue;
    if (ours === origin) incoming.push(filePath);
    else kept.push(filePath);
  }
  return { incoming: incoming.sort(), kept: kept.sort() };
}

export type LandForeignOwnFilesResult = { ok: true; landed: string[]; kept: string[] } | { ok: false; detail: string };

async function existsOnDisk(rootDir: string, filePath: string): Promise<boolean> {
  try {
    await fs.lstat(path.join(rootDir, ...filePath.split('/')));
    return true;
  } catch {
    return false;
  }
}

/** Remove a file the foreign side deleted, and the directories it leaves empty, up to the tree root. */
async function removeFromDisk(rootDir: string, filePath: string): Promise<void> {
  const root = path.resolve(rootDir);
  const target = path.join(root, ...filePath.split('/'));
  await fs.rm(target, { force: true });
  for (let dir = path.dirname(target); dir !== root && dir.startsWith(root); dir = path.dirname(dir)) {
    try {
      await fs.rmdir(dir);
    } catch {
      return;
    }
  }
}

interface OwnFileRefs {
  baseRef: string | null;
  foreignRef: string;
}

/** What an integration does with the own files, read before anything is written. */
interface OwnFilesPlan {
  foreign: ReadonlyMap<string, string>;
  base: ReadonlyMap<string, string>;
  /** Only the foreign side changed these and the working tree is clean there — its file lands, or the file leaves. */
  landing: string[];
  /** Both sides changed these — the local file stands unless a person answers it. */
  kept: string[];
}

/**
 * Read the three trees and the working tree. `baseRef` is the common
 * ancestor the three-way reads against (null when there is none — every
 * foreign own file then counts as changed by the foreign side); `HEAD`
 * is the local side.
 */
async function planForeignOwnFiles(
  run: GitRunner,
  rootDir: string,
  refs: OwnFileRefs,
): Promise<({ ok: true } & OwnFilesPlan) | { ok: false; detail: string }> {
  const head = await listTreeEntries(run, rootDir, 'HEAD');
  const foreign = await listTreeEntries(run, rootDir, refs.foreignRef);
  const base = refs.baseRef === null ? new Map<string, string>() : await listTreeEntries(run, rootDir, refs.baseRef);
  if (head === null || foreign === null || base === null) {
    return { ok: false, detail: `unreadable tree for the own files of ${refs.foreignRef}` };
  }

  const { incoming, kept } = classifyForeignOwnFiles(base, head, foreign);
  if (incoming.length === 0) return { ok: true, foreign, base, landing: [], kept };

  const changes = await listWorkingChanges(run, rootDir);
  if (changes === null) return { ok: false, detail: 'status failed while carrying the own files' };
  const dirty = new Set(
    changes.flatMap((change) => (change.renamedFrom !== undefined ? [change.path, change.renamedFrom] : [change.path])),
  );

  const landing: string[] = [];
  for (const filePath of incoming) {
    const local = head.has(filePath) ? dirty.has(filePath) : await existsOnDisk(rootDir, filePath);
    if (local) kept.push(filePath);
    else landing.push(filePath);
  }
  return { ok: true, foreign, base, landing, kept: kept.sort() };
}

/** The file in the working tree, as a person would open it. */
async function readWorkingFileText(rootDir: string, filePath: string): Promise<FileText> {
  const target = path.join(rootDir, ...filePath.split('/'));
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.size > OWN_FILE_CONFLICT_MAX_BYTES) return { kind: 'opaque' };
    return asFileText(await fs.readFile(target, 'utf-8'));
  } catch {
    return { kind: 'absent' };
  }
}

const textOf = (side: FileText): string | undefined => (side.kind === 'text' ? side.text : undefined);

export type OwnFileConflictsResult = { ok: true; files: CommitConflictFile[] } | { ok: false; detail: string };

/**
 * The own files both sides changed that a person can answer: text on
 * every side that has the file, with the foreign side's text apart from
 * both the base's and the local file's. The local side is the working
 * tree, uncommitted work included. Writes nothing.
 */
export async function readOwnFileConflicts(
  run: GitRunner,
  rootDir: string,
  refs: OwnFileRefs,
): Promise<OwnFileConflictsResult> {
  const plan = await planForeignOwnFiles(run, rootDir, refs);
  if (!plan.ok) return plan;

  const files: CommitConflictFile[] = [];
  for (const filePath of plan.kept) {
    const base = await readTreeEntryText(run, rootDir, plan.base.get(filePath), OWN_FILE_CONFLICT_MAX_BYTES);
    const theirs = await readTreeEntryText(run, rootDir, plan.foreign.get(filePath), OWN_FILE_CONFLICT_MAX_BYTES);
    const mine = await readWorkingFileText(rootDir, filePath);
    if (base.kind === 'opaque' || theirs.kind === 'opaque' || mine.kind === 'opaque') continue;
    const baseText = textOf(base);
    const theirsText = textOf(theirs);
    const mineText = textOf(mine);
    if (theirsText === baseText || theirsText === mineText) continue;
    files.push({
      path: filePath,
      ...(baseText !== undefined ? { base: baseText } : {}),
      ...(theirsText !== undefined ? { theirs: theirsText } : {}),
      ...(mineText !== undefined ? { mine: mineText } : {}),
    });
  }
  return { ok: true, files };
}

/** Write an answered file. A link standing at the path is replaced, never written through. */
async function writeAnswer(rootDir: string, filePath: string, content: string): Promise<void> {
  const target = path.join(rootDir, ...filePath.split('/'));
  const stat = await fs.lstat(target).catch(() => null);
  if (stat !== null && !stat.isFile()) await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

/**
 * Carry the foreign side's own-file changes into the working tree,
 * before the pass records its commit or moves the branch. `answers`
 * are the files a person resolved (path → content, from
 * `readOwnFileConflicts`): each is written as answered — empty or
 * whitespace alone means the file is gone — and is not reported as
 * kept.
 */
export async function landForeignOwnFiles(
  run: GitRunner,
  rootDir: string,
  refs: OwnFileRefs,
  answers: ReadonlyMap<string, string> = new Map(),
): Promise<LandForeignOwnFilesResult> {
  const plan = await planForeignOwnFiles(run, rootDir, refs);
  if (!plan.ok) return plan;

  const landed = plan.landing.filter((filePath) => !answers.has(filePath));
  const kept = plan.kept.filter((filePath) => !answers.has(filePath));
  // A file answered where the local side has none takes the foreign file first — its mode comes with it.
  const created: string[] = [];
  for (const [filePath, content] of answers) {
    const gone = content.trim().length === 0;
    if (!gone && plan.foreign.has(filePath) && !(await existsOnDisk(rootDir, filePath))) created.push(filePath);
  }

  const checkedOut = await checkoutPathsFromCommit(run, rootDir, refs.foreignRef, [
    ...landed.filter((filePath) => plan.foreign.has(filePath)),
    ...created,
  ]);
  if (!checkedOut.ok) return { ok: false, detail: checkedOut.detail };
  for (const filePath of landed) {
    if (!plan.foreign.has(filePath)) await removeFromDisk(rootDir, filePath);
  }
  for (const [filePath, content] of answers) {
    if (content.trim().length === 0) await removeFromDisk(rootDir, filePath);
    else await writeAnswer(rootDir, filePath, content);
  }

  return { ok: true, landed: [...landed, ...answers.keys()].sort(), kept };
}

/**
 * The user's own files across an integration — the half of a pull, a
 * branch merge, a pick, a revert or a force-push resolution the mutators
 * never see.
 *
 * The engine converges the workspace DOCUMENTS and writes them itself;
 * a tracked file that is not a document (a README, scripts, assets,
 * `.gitignore`, a note kept in an entity's directory that no document
 * reads) has no entity behind it, so the foreign side's change
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
 * One file never lands, whoever changed it: a link at the name of a
 * hygiene file (`hygiene.ts`). Such a file is a regular file or nothing —
 * git reads no ignore file through a link, so the link would take every
 * ignore line of the user's own with it. The local file stands and the
 * path is reported as kept; the commit that follows records it as it
 * stands.
 *
 * A pass that can ask a person (Cherry-Pick, Revert) reads the kept
 * files that are text on every side as files to answer
 * (`readOwnFileConflicts`) and hands the answers back to the landing:
 * an answered file is written as answered instead of kept. A link, a
 * binary or a file over the cap is never shown — it stays kept and
 * named.
 *
 * What lands by git's checkout is git's to write. What this pass writes
 * and removes itself — an answered file, a file the foreign side
 * deleted — goes through the folder's boundary (`git/tree-boundary.ts`),
 * asked before anything is written: a path it refuses fails the landing
 * with nothing done.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type CommitConflictFile, isDocumentByName, treeDocumentPaths } from '@openheaders/core/workspace-tree';
import {
  asFileText,
  checkoutPathsFromCommit,
  type FileText,
  type GitRunner,
  isRegularFileEntry,
  listTreeEntries,
  listWorkingChanges,
  readTreeEntryText,
  TreeBoundary,
  type TreePlace,
  type TreeRefusal,
  treeRefusalReason,
} from '../git';
import { TREE_HYGIENE_FILES } from './hygiene';

/** An own file joins the files to answer only while every side of it is at most this many bytes. */
export const OWN_FILE_CONFLICT_MAX_BYTES = 262_144;

export interface ForeignOwnFiles {
  /** Own files only the foreign side changed. */
  incoming: string[];
  /** Own files both sides changed — the local file stands. */
  kept: string[];
}

/** Whether a commit's entry at `filePath` is a link at a hygiene file's name — the one own file that never lands. */
function isHygieneLink(filePath: string, entry: string | undefined): boolean {
  return TREE_HYGIENE_FILES.has(filePath) && entry !== undefined && !isRegularFileEntry(entry);
}

/**
 * The document paths the readings of an integration's two sides answer
 * for (`answered-by.ts`). Asked once, and only where a file beside a
 * manifest differs between the sides: a pass that holds no reading of
 * the branch's side reads it at that ask, and at no other.
 */
export type AnsweredPaths = () => Promise<ReadonlySet<string>>;

/**
 * Classify the own files of an integration from the three trees'
 * entries (`path → "<mode> <sha>"`; an empty `base` when the histories
 * share none). The working tree is the caller's to check.
 *
 * A file beside an entity's manifest is a document's where a reading of
 * either side answers for it (`answered`), and the user's own where
 * neither does — a note kept in a rule's directory is carried like a
 * README.
 */
export async function classifyForeignOwnFiles(
  base: ReadonlyMap<string, string>,
  head: ReadonlyMap<string, string>,
  foreign: ReadonlyMap<string, string>,
  answered: AnsweredPaths,
): Promise<ForeignOwnFiles> {
  const named = new Set([...treeDocumentPaths(head.keys()), ...treeDocumentPaths(foreign.keys())]);
  let read: ReadonlySet<string> | undefined;
  const incoming: string[] = [];
  const kept: string[] = [];
  for (const filePath of new Set([...head.keys(), ...foreign.keys()])) {
    const theirs = foreign.get(filePath);
    const ours = head.get(filePath);
    const origin = base.get(filePath);
    if (theirs === ours || theirs === origin) continue;
    if (named.has(filePath)) {
      if (isDocumentByName(filePath)) continue;
      read ??= await answered();
      if (read.has(filePath)) continue;
    }
    if (ours === origin && !isHygieneLink(filePath, theirs)) incoming.push(filePath);
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

/** The two commits an integration's own files are read between; `baseRef` null when the histories share none. */
export interface OwnFileRefs {
  baseRef: string | null;
  foreignRef: string;
  /** What the readings of HEAD and of `foreignRef` answer for. */
  answered: AnsweredPaths;
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

  const { incoming, kept } = await classifyForeignOwnFiles(base, head, foreign, refs.answered);
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

/**
 * Write an answered file at its place. A file that stands there keeps
 * its mode; a link standing there is replaced, never written through.
 * Answers the refusal where a directory on the way turns out not to be
 * one.
 */
async function writeAnswer(boundary: TreeBoundary, place: TreePlace, content: string): Promise<TreeRefusal | null> {
  const refusal = await boundary.makeWay(place);
  if (refusal !== null) return refusal;
  const stat = await fs.lstat(place.file).catch(() => null);
  if (stat !== null && !stat.isFile()) await fs.rm(place.file, { recursive: true, force: true });
  await fs.writeFile(place.file, content, 'utf-8');
  return null;
}

const isGoneAnswer = (content: string): boolean => content.trim().length === 0;

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
    if (!isGoneAnswer(content) && plan.foreign.has(filePath) && !(await existsOnDisk(rootDir, filePath))) {
      created.push(filePath);
    }
  }

  // What the pass removes and writes itself, asked of the boundary while nothing is written.
  const removed = [
    ...landed.filter((filePath) => !plan.foreign.has(filePath)),
    ...[...answers].flatMap(([filePath, content]) => (isGoneAnswer(content) ? [filePath] : [])),
  ];
  const written = [...answers].filter(([, content]) => !isGoneAnswer(content));
  const asked = new TreeBoundary(rootDir);
  for (const filePath of [...removed, ...written.map(([filePath]) => filePath)]) {
    const placed = await asked.locate(filePath);
    if (!placed.ok) return { ok: false, detail: treeRefusalReason(filePath, placed.refusal) };
  }

  const checkedOut = await checkoutPathsFromCommit(run, rootDir, refs.foreignRef, [
    ...landed.filter((filePath) => plan.foreign.has(filePath)),
    ...created,
  ]);
  if (!checkedOut.ok) return { ok: false, detail: checkedOut.detail };

  // Git has written since: the folder is looked at anew.
  const boundary = new TreeBoundary(rootDir);
  for (const filePath of removed) {
    const placed = await boundary.locate(filePath);
    if (!placed.ok) return { ok: false, detail: treeRefusalReason(filePath, placed.refusal) };
    await boundary.remove(placed.place);
  }
  for (const [filePath, content] of written) {
    const placed = await boundary.locate(filePath);
    const refusal = placed.ok ? await writeAnswer(boundary, placed.place, content) : placed.refusal;
    if (refusal !== null) return { ok: false, detail: treeRefusalReason(filePath, refusal) };
  }

  return { ok: true, landed: [...landed, ...answers.keys()].sort(), kept };
}

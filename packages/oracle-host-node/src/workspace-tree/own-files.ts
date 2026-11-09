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
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { treeDocumentPaths } from '@openheaders/core/workspace-tree';
import { checkoutPathsFromCommit, type GitRunner, listTreeEntries, listWorkingChanges } from '../git';

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

/**
 * Carry the foreign side's own-file changes into the working tree,
 * before the pass records its commit or moves the branch. `baseRef` is
 * the common ancestor the three-way reads against (null when there is
 * none — every foreign own file then counts as changed by the foreign
 * side); `HEAD` is the local side.
 */
export async function landForeignOwnFiles(
  run: GitRunner,
  rootDir: string,
  refs: { baseRef: string | null; foreignRef: string },
): Promise<LandForeignOwnFilesResult> {
  const head = await listTreeEntries(run, rootDir, 'HEAD');
  const foreign = await listTreeEntries(run, rootDir, refs.foreignRef);
  const base = refs.baseRef === null ? new Map<string, string>() : await listTreeEntries(run, rootDir, refs.baseRef);
  if (head === null || foreign === null || base === null) {
    return { ok: false, detail: `unreadable tree for the own files of ${refs.foreignRef}` };
  }

  const { incoming, kept } = classifyForeignOwnFiles(base, head, foreign);
  if (incoming.length === 0) return { ok: true, landed: [], kept };

  const changes = await listWorkingChanges(run, rootDir);
  if (changes === null) return { ok: false, detail: 'status failed while carrying the own files' };
  const dirty = new Set(
    changes.flatMap((change) => (change.renamedFrom !== undefined ? [change.path, change.renamedFrom] : [change.path])),
  );

  const landed: string[] = [];
  const toCheckout: string[] = [];
  const toRemove: string[] = [];
  for (const filePath of incoming) {
    const local = head.has(filePath) ? dirty.has(filePath) : await existsOnDisk(rootDir, filePath);
    if (local) {
      kept.push(filePath);
      continue;
    }
    landed.push(filePath);
    if (foreign.has(filePath)) toCheckout.push(filePath);
    else toRemove.push(filePath);
  }

  const checkedOut = await checkoutPathsFromCommit(run, rootDir, refs.foreignRef, toCheckout);
  if (!checkedOut.ok) return { ok: false, detail: checkedOut.detail };
  for (const filePath of toRemove) await removeFromDisk(rootDir, filePath);

  return { ok: true, landed, kept: kept.sort() };
}

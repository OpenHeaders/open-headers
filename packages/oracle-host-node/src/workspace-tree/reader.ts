/**
 * Filesystem tree reader — a bound workspace folder as the listing
 * core's `readWorkspaceTree` consumes (the git-sync plan §3.1 rung 2:
 * on any external change the tree is truth; this is the read half the
 * cold-boot sweep and the watcher slice both ride).
 *
 * Names first: the folder is listed without a read (`tree-listing.ts`),
 * core says which of the names are the tree's documents
 * (`treeDocumentPaths` — the question a commit's listing is asked), and
 * only those are read, each through the one guarded read
 * (`tree-file.ts`). A file of the user's own is never opened.
 *
 * A listing answers three things: the documents' files read; the paths
 * that stand and were not read, for the reading to give a row each; and
 * whether a file may stand at a path — by its NAME, read or not, so a
 * file the predicate passes over, one that would not read, and all that
 * lies beneath a directory that would not list are none of them gone.
 */

import * as path from 'node:path';
import {
  readWorkspaceTree,
  type TreeFile,
  type TreeReadResult,
  type TreeUnread,
  treeDocumentPaths,
  treePathIsUnder,
} from '@openheaders/core/workspace-tree';
import { readTreeFile } from './tree-file';
import { listTreeNames } from './tree-listing';

export interface TreeListing {
  /** The files of the tree's documents, read — sorted by path. */
  files: TreeFile[];
  /** The paths that stand and were not read — sorted by path. */
  unread: TreeUnread[];
  /** Whether a file may stand at `path`. */
  stands(path: string): boolean;
}

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export async function listWorkspaceTree(rootDir: string): Promise<TreeListing> {
  const names = await listTreeNames(rootDir);
  const standing = new Set(names.files);
  const files: TreeFile[] = [];
  const unread: TreeUnread[] = [...names.unlisted];
  for (const relative of treeDocumentPaths(names.files)) {
    const file = await readTreeFile(path.join(rootDir, ...relative.split('/')));
    if (file.kind === 'text') {
      files.push({ path: relative, content: file.content });
    } else if (file.kind === 'absent') {
      // It went between the listing and the read: it is not of the tree.
      standing.delete(relative);
    } else {
      unread.push({ path: relative, cause: file.cause, ...(file.code !== undefined ? { code: file.code } : {}) });
    }
  }
  return {
    files: files.sort(byPath),
    unread: unread.sort(byPath),
    stands: (filePath) => standing.has(filePath) || names.unlisted.some((dir) => treePathIsUnder(dir.path, filePath)),
  };
}

/** Read a bound workspace tree from disk into a snapshot + unknowns + issues. */
export async function readWorkspaceTreeFromDisk(rootDir: string): Promise<TreeReadResult> {
  const listing = await listWorkspaceTree(rootDir);
  return readWorkspaceTree(listing.files, listing.unread);
}

/**
 * A commit's tree as a reading takes it — the commit's twin of the
 * bound folder's listing (`workspace-tree/reader.ts`), the foreign
 * checkout snapshot of the §11.4 pull path.
 *
 * Names first here too: the commit's listing says every file and its
 * size without a blob read, core says which of the names are the tree's
 * documents (`treeDocumentPaths`), and only those are read. Every
 * DOCUMENT file is: the manifests and the files beside them (a request's
 * body and scripts live in siblings — a read without them would answer
 * an entity that lost both). The user's own files never need parsing
 * and are left out.
 *
 * A document file over `TREE_FILE_MAX_BYTES` is not read, as on disk:
 * it stands in the commit with its bytes not known, and is handed back
 * for the reading to give a row. One such file does not close the
 * commit to every pass.
 */

import {
  TREE_FILE_MAX_BYTES,
  type TreeFile,
  type TreeUnread,
  treeDocumentPaths,
} from '@openheaders/core/workspace-tree';
import type { GitRunner } from './git-exec';
import { repoArgs } from './repo-args';

export interface CommitTree {
  /** The files of the tree's documents, read — in the listing's order. */
  files: TreeFile[];
  /** The document files that stand in the commit and were not read. */
  unread: TreeUnread[];
}

/** Every document path the commit holds a file at, read or not. */
export function commitTreePaths(tree: CommitTree): Set<string> {
  return new Set([...tree.files, ...tree.unread].map((file) => file.path));
}

/** Null when the ref is unknown or a blob of it does not come. */
export async function readCommitTree(run: GitRunner, rootDir: string, ref: string): Promise<CommitTree | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '-l', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const sizes = new Map<string, number>();
  for (const record of listing.stdout.split('\0')) {
    const tab = record.indexOf('\t');
    if (tab === -1) continue;
    // `<mode> <type> <object> <size>`: the size is the last word.
    const columns = record.slice(0, tab);
    sizes.set(record.slice(tab + 1), Number(columns.slice(columns.lastIndexOf(' ') + 1)));
  }
  const tree: CommitTree = { files: [], unread: [] };
  for (const entry of treeDocumentPaths(sizes.keys())) {
    if ((sizes.get(entry) ?? 0) > TREE_FILE_MAX_BYTES) {
      tree.unread.push({ path: entry, cause: 'too-large' });
      continue;
    }
    const blob = await run([...repoArgs(rootDir), 'show', `${ref}:${entry}`], { cwd: rootDir });
    if (blob.code !== 0) return null;
    tree.files.push({ path: entry, content: blob.stdout });
  }
  return tree;
}

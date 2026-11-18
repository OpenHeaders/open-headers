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
 *
 * The files come through one git kept open for the pass
 * (`object-batch.ts`), each asked for by the hash its listing gives — a
 * git a file costs more than every read of a tree together. A path is
 * never what git is asked: a commit names its paths as it likes. A
 * submodule's entry is no file of the tree and is not listed.
 */

import {
  TREE_FILE_MAX_BYTES,
  type TreeFile,
  type TreeUnread,
  treeDocumentPaths,
} from '@openheaders/core/workspace-tree';
import type { GitRunner } from './git-exec';
import type { GitObjectBatch } from './object-batch';
import { repoArgs } from './repo-args';

/**
 * The bytes one ask of the batch brings at most, by the listing's sizes.
 * An ask has the batch's deadline, so a tree of any size is read in asks
 * that each fit it; one file is never over the tree's own limit.
 */
const ASK_MAX_BYTES = 4 * TREE_FILE_MAX_BYTES;

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

interface ListedBlob {
  path: string;
  hash: string;
  bytes: number;
}

/** `listed` in asks of at most `ASK_MAX_BYTES`, in order. */
function asksOf(listed: readonly ListedBlob[]): ListedBlob[][] {
  const asks: ListedBlob[][] = [];
  let ask: ListedBlob[] = [];
  let bytes = 0;
  for (const blob of listed) {
    if (ask.length > 0 && bytes + blob.bytes > ASK_MAX_BYTES) {
      asks.push(ask);
      ask = [];
      bytes = 0;
    }
    ask.push(blob);
    bytes += blob.bytes;
  }
  if (ask.length > 0) asks.push(ask);
  return asks;
}

/** Null when the ref is unknown or a blob of it does not come. */
export async function readCommitTree(
  run: GitRunner,
  objects: GitObjectBatch,
  rootDir: string,
  ref: string,
): Promise<CommitTree | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '-l', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const blobs = new Map<string, ListedBlob>();
  for (const record of listing.stdout.split('\0')) {
    const tab = record.indexOf('\t');
    if (tab === -1) continue;
    // `<mode> <type> <object> <size>`: the size is the last word, after its column's padding.
    const columns = record.slice(0, tab);
    const [, type, hash] = columns.split(' ');
    if (type !== 'blob') continue;
    const path = record.slice(tab + 1);
    blobs.set(path, { path, hash, bytes: Number(columns.slice(columns.lastIndexOf(' ') + 1)) });
  }

  const tree: CommitTree = { files: [], unread: [] };
  const read: ListedBlob[] = [];
  for (const entry of treeDocumentPaths(blobs.keys())) {
    const blob = blobs.get(entry);
    if (blob === undefined) continue;
    if (blob.bytes > TREE_FILE_MAX_BYTES) tree.unread.push({ path: entry, cause: 'too-large' });
    else read.push(blob);
  }
  for (const ask of asksOf(read)) {
    const contents = await objects.readBlobs(ask.map((blob) => blob.hash));
    if (contents === null) return null;
    for (const [index, blob] of ask.entries()) {
      const content = contents[index];
      if (content === null) return null;
      tree.files.push({ path: blob.path, content: content.toString('utf8') });
    }
  }
  return tree;
}

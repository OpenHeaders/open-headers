/**
 * unread — what a reading says of the paths a host listed and did not
 * read (`TreeUnread`), and what they hold back.
 *
 * Each has a row at its own path: the file is what the user mends. A
 * document that reads a file beside it — a request its body, a
 * collection its scripts, an environment its secret file — is not read
 * without it: a document read short of a file reads as one that lost
 * it. Such a document is skipped with a row at its manifest that names
 * the file. The root directory is no entity's own, so a root file holds
 * back nothing but itself.
 *
 * A manifest that was not read is still a manifest that stands: the
 * directory it sits in is a container's for what is inside it.
 *
 * A document's file at a path no tree can hold (`tree-path.ts`) is not
 * read either, whatever the host read of it: it stands the same, with a
 * row that names what of its path cannot be. A file of the user's own
 * at such a path is the user's, and has none.
 */

import { treeDocumentPaths } from './document-paths';
import { ENTITY_MANIFEST_FILES, TREE_FILE_MAX_BYTES } from './layout';
import { treePathRefusal } from './tree-path';
import type { TreeFile, TreeIssue, TreeUnread } from './types';

const LIMIT_MB = TREE_FILE_MAX_BYTES / (1024 * 1024);

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Whether `path` lies beneath the directory `dir` — everything does beneath the root, `''`. */
export function treePathIsUnder(dir: string, path: string): boolean {
  return dir === '' || path.startsWith(`${dir}/`);
}

function issueOf(entry: TreeUnread): TreeIssue {
  const code = entry.code === undefined ? '' : ` (${entry.code})`;
  switch (entry.cause) {
    case 'too-large':
      return { path: entry.path, message: `larger than ${LIMIT_MB} MB — skipped` };
    case 'unreadable':
      return { path: entry.path, message: `cannot be read${code} — skipped` };
    case 'unlisted':
      return { path: entry.path === '' ? './' : `${entry.path}/`, message: `cannot be listed${code} — skipped` };
  }
}

/** The issue of a document skipped for a file beside it that was not read, at its manifest. */
export function heldBackIssue(path: string, fileName: string): TreeIssue {
  return { path, message: `"${fileName}" was not read — skipped` };
}

/** A listing's files, parted by whether a tree can hold each one's path. */
export interface HeldTreeFiles {
  /** The files at a path of a tree, in the listing's order. */
  readonly held: TreeFile[];
  /** A row for each document file at a path no tree can hold, at that path. */
  readonly unheld: TreeIssue[];
}

/** Part `files` — one complete listing of a tree — by their paths. */
export function holdTreeFiles(files: readonly TreeFile[]): HeldTreeFiles {
  const held: TreeFile[] = [];
  const refused = new Map<string, string>();
  for (const file of files) {
    const part = treePathRefusal(file.path);
    if (part === null) held.push(file);
    else refused.set(file.path, part);
  }
  if (refused.size === 0) return { held, unheld: [] };
  const documents = treeDocumentPaths(files.map((file) => file.path));
  const unheld: TreeIssue[] = [];
  for (const [path, part] of refused) {
    if (documents.has(path)) unheld.push({ path, message: `${part} cannot be part of a path — skipped` });
  }
  return { held, unheld };
}

export interface UnreadPaths {
  /** A row for each path, at the path — the host's in its order, then the listing's own. */
  readonly issues: TreeIssue[];
  /** Whether a file stands at `path`, not read. */
  stands(path: string): boolean;
  /** The name of a file in `dir` that was not read and is no manifest — what an entity of that directory would read beside its own. */
  beside(dir: string): string | undefined;
  /** Whether `path` lies beneath a directory that would not list. */
  unlisted(path: string): boolean;
}

/**
 * What stands and was not read: the paths a host listed and did not
 * read, and the files of the listing no tree can hold, by their rows
 * (`holdTreeFiles`).
 */
export function unreadPaths(unread: readonly TreeUnread[], unheld: readonly TreeIssue[] = []): UnreadPaths {
  const files = new Set<string>();
  const besideByDir = new Map<string, string>();
  const unlistedDirs: string[] = [];
  const stand = (path: string): void => {
    files.add(path);
    const dir = dirOf(path);
    const base = baseOf(path);
    if (dir !== '' && !ENTITY_MANIFEST_FILES.has(base) && !besideByDir.has(dir)) besideByDir.set(dir, base);
  };
  for (const entry of unread) {
    if (entry.cause === 'unlisted') unlistedDirs.push(entry.path);
    else stand(entry.path);
  }
  for (const issue of unheld) stand(issue.path);
  return {
    issues: [...unread.map(issueOf), ...unheld],
    stands: (path) => files.has(path),
    beside: (dir) => besideByDir.get(dir),
    unlisted: (path) => unlistedDirs.some((dir) => treePathIsUnder(dir, path)),
  };
}

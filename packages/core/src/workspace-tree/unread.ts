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
 */

import { ENTITY_MANIFEST_FILES, TREE_FILE_MAX_BYTES } from './layout';
import type { TreeIssue, TreeUnread } from './types';

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

export interface UnreadPaths {
  /** A row for each path, at the path, in the host's order. */
  readonly issues: TreeIssue[];
  /** Whether a file stands at `path`, not read. */
  stands(path: string): boolean;
  /** The name of a file in `dir` that was not read and is no manifest — what an entity of that directory would read beside its own. */
  beside(dir: string): string | undefined;
  /** Whether `path` lies beneath a directory that would not list. */
  unlisted(path: string): boolean;
}

export function unreadPaths(unread: readonly TreeUnread[]): UnreadPaths {
  const files = new Set<string>();
  const besideByDir = new Map<string, string>();
  const unlistedDirs: string[] = [];
  for (const entry of unread) {
    if (entry.cause === 'unlisted') {
      unlistedDirs.push(entry.path);
      continue;
    }
    files.add(entry.path);
    const dir = dirOf(entry.path);
    const base = baseOf(entry.path);
    if (dir !== '' && !ENTITY_MANIFEST_FILES.has(base) && !besideByDir.has(dir)) besideByDir.set(dir, base);
  }
  return {
    issues: unread.map(issueOf),
    stands: (path) => files.has(path),
    beside: (dir) => besideByDir.get(dir),
    unlisted: (path) => unlistedDirs.some((dir) => treePathIsUnder(dir, path)),
  };
}

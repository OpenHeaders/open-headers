/**
 * The fold of a reading's issues — one row a cause.
 *
 * An issue is a file; what the user mends is a cause. A document skipped
 * for its place (`uncontainedIn`) is answered for by that directory: by
 * the row of the directory's own manifest where it has one — a
 * collection or a folder that did not read, or was itself skipped — and
 * by the directory where it has none. Folded top-down, a collection
 * that does not read is one row however much it holds. A document
 * skipped for what it says keeps its own row.
 */

import { COLLECTION_MANIFEST_FILE, FOLDER_MANIFEST_FILE } from './layout';
import type { TreeIssue } from './types';

export type FoldedTreeIssue =
  | {
      kind: 'file';
      path: string;
      message: string;
      /** The files skipped beneath it for their place, at any depth. */
      inside: number;
    }
  | {
      /** A directory that holds no container and has no manifest's row to answer for it. */
      kind: 'directory';
      dir: string;
      /** The files skipped in it, and beneath those. */
      files: number;
    };

const CONTAINER_MANIFESTS: ReadonlySet<string> = new Set([COLLECTION_MANIFEST_FILE, FOLDER_MANIFEST_FILE]);

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** The directory an issue names — one its file does sit beneath, so a fold only ever goes up. */
function uncontainedDirOf(issue: TreeIssue): string | null {
  const dir = issue.uncontainedIn;
  if (dir === undefined) return null;
  const own = dirOf(issue.path);
  return own !== dir && own.startsWith(dir === '' ? '' : `${dir}/`) ? dir : null;
}

function append<K>(buckets: Map<K, TreeIssue[]>, key: K, issue: TreeIssue): void {
  const bucket = buckets.get(key);
  if (bucket) bucket.push(issue);
  else buckets.set(key, [issue]);
}

/** The issues as rows, in their order: each cause once, with the count of what it holds back. */
export function foldTreeIssues(issues: readonly TreeIssue[]): FoldedTreeIssue[] {
  const manifestAt = new Map<string, TreeIssue>();
  for (const issue of issues) {
    const dir = dirOf(issue.path);
    if (CONTAINER_MANIFESTS.has(baseOf(issue.path)) && !manifestAt.has(dir)) manifestAt.set(dir, issue);
  }

  const beneath = new Map<TreeIssue, TreeIssue[]>();
  const unanswered = new Map<string, TreeIssue[]>();
  const rows: Array<{ issue: TreeIssue } | { dir: string }> = [];
  for (const issue of issues) {
    const dir = uncontainedDirOf(issue);
    if (dir === null) {
      rows.push({ issue });
      continue;
    }
    const manifest = manifestAt.get(dir);
    if (manifest !== undefined) {
      append(beneath, manifest, issue);
      continue;
    }
    if (!unanswered.has(dir)) rows.push({ dir });
    append(unanswered, dir, issue);
  }

  const inside = (issue: TreeIssue): number =>
    (beneath.get(issue) ?? []).reduce((count, child) => count + 1 + inside(child), 0);
  const fileRow = (issue: TreeIssue): FoldedTreeIssue => ({
    kind: 'file',
    path: issue.path,
    message: issue.message,
    inside: inside(issue),
  });

  return rows.map((row) => {
    if ('issue' in row) return fileRow(row.issue);
    const skipped = unanswered.get(row.dir) ?? [];
    if (skipped.length === 1) return fileRow(skipped[0]);
    return { kind: 'directory', dir: row.dir, files: skipped.reduce((count, issue) => count + 1 + inside(issue), 0) };
  });
}

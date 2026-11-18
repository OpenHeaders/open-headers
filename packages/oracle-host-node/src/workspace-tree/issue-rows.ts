/**
 * The rows of a tree reading — the files the Git card lists as not
 * taken in.
 *
 * A row is about a file of the user's, and two things decide one: the
 * read contained against the engine's snapshot (`containTreeRead`), and
 * the baseline. A file whose bytes are the baseline's is the engine's
 * own write, which no reading takes in, so an issue at it tells of
 * nothing skipped — a leaf the engine holds where the reader reads
 * none: an old client's slot-less leaf at a tree's root, there until
 * the engine re-homes it; a leaf whose container's manifest left, there
 * until the flush writes that manifest again. The same holds a
 * document skipped for a file beside it that was not read: its row
 * shows once its manifest holds a hand edit, which is what is skipped.
 * A file that was not read has no bytes to compare, and its row always
 * shows.
 *
 * Every reading of the disk that feeds the card derives its rows here.
 */

import {
  containTreeRead,
  readWorkspaceTree,
  type TreeIssue,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import { listWorkspaceTree } from './reader';
import { hashTreeContent, type MaterializedIndex, readMaterializedIndex } from './sidecar';

/** The issues of a contained read, less those at a file whose bytes on disk are the baseline's. */
export function treeIssueRows(
  issues: readonly TreeIssue[],
  diskHashes: ReadonlyMap<string, string>,
  baseline: MaterializedIndex,
): TreeIssue[] {
  return issues.filter((issue) => {
    const hash = diskHashes.get(issue.path);
    return hash === undefined || baseline[issue.path] !== hash;
  });
}

/** The rows of the tree on disk as it stands, read against the engine's snapshot. */
export async function readTreeIssueRows(rootDir: string, snapshot: WorkspaceTreeState): Promise<TreeIssue[]> {
  const { files, unread } = await listWorkspaceTree(rootDir);
  const { issues } = containTreeRead(readWorkspaceTree(files, unread), snapshot);
  if (issues.length === 0) return issues;
  const refused = new Set(issues.map((issue) => issue.path));
  const diskHashes = new Map<string, string>();
  for (const file of files) {
    if (refused.has(file.path)) diskHashes.set(file.path, hashTreeContent(file.content));
  }
  return treeIssueRows(issues, diskHashes, await readMaterializedIndex(rootDir));
}

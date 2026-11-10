/**
 * What a pick or a revert is about to write, read before it writes —
 * so the pass can ask about uncommitted work in those files while
 * nothing has happened yet.
 *
 * This reading decides a QUESTION and nothing else. What the pass
 * records is decided afterwards, from the working tree as it stood
 * before and after the pass (`pick.ts`), so a file this reading misses
 * is still recorded right.
 */

import { planWorkspaceTree, type TreeReadResult, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { type GitRunner, listWorkingChanges } from '../git';

/**
 * The document files the tree would hold differently once `next`
 * stands where `current` does: written, added or removed. Both sides
 * are planned the same way, so a file neither side changes never reads
 * as a difference.
 */
export function plannedDocumentWrites(current: WorkspaceTreeState, next: TreeReadResult['state']): string[] {
  if (next.workspace === null) return [];
  const before = new Map(planWorkspaceTree(current).map((file) => [file.path, file.content]));
  const after = new Map(
    planWorkspaceTree({ ...next, workspace: next.workspace }).map((file) => [file.path, file.content]),
  );
  const paths = new Set<string>();
  for (const [filePath, content] of after) {
    if (before.get(filePath) !== content) paths.add(filePath);
  }
  for (const filePath of before.keys()) {
    if (!after.has(filePath)) paths.add(filePath);
  }
  return [...paths].sort();
}

/** The `paths` that hold uncommitted work — modified, deleted or unversioned. Null when the tree cannot be read. */
export async function uncommittedAmong(
  run: GitRunner,
  rootDir: string,
  paths: readonly string[],
): Promise<string[] | null> {
  if (paths.length === 0) return [];
  const changes = await listWorkingChanges(run, rootDir);
  if (changes === null) return null;
  const dirty = new Set(
    changes.flatMap((change) => (change.renamedFrom !== undefined ? [change.path, change.renamedFrom] : [change.path])),
  );
  return [...new Set(paths)].filter((filePath) => dirty.has(filePath)).sort();
}

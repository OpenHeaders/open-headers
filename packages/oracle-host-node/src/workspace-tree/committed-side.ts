/**
 * The commit's side of a document that holds uncommitted work.
 *
 * An integration lays the foreign history's change over the engine's
 * snapshot — the branch's commits AND whatever is not committed yet —
 * and the working tree takes the result. What the integration's commit
 * records for such a document has to leave the uncommitted part out, so
 * the same change is laid a second time, over HEAD's own tree: that
 * reading, planned, is the document as the commit holds it, and the
 * work stays uncommitted in the working tree across the pass.
 *
 * A document carries its uncommitted work this way only where HEAD and
 * the foreign side did not change one value. Where they did, the commit
 * has to record the person's own answer to it, and the work is committed
 * first instead (asked). A file no document stands behind is never
 * carried: free text has no values to tell the committed part from the
 * rest. And when HEAD's own tree does not read whole, nothing is
 * carried — the pass falls back to committing that work first.
 */

import {
  applyCommitChange,
  type CommitChangeDocument,
  commitDocumentFiles,
  planWorkspaceTree,
  readWorkspaceTree,
  type TreeReadResult,
  type WorkspaceTreeState,
  withCommitSecretRows,
} from '@openheaders/core/workspace-tree';
import { type GitRunner, readCommitTreeFiles } from '../git';

export interface CommittedSide {
  /** Whether uncommitted work in this file stays uncommitted across the pass. */
  carries: (filePath: string) => boolean;
  /** The file as the pass's commit records it — null where the commit holds none. */
  contentOf: (filePath: string) => string | null;
}

/** Every file with uncommitted work the pass writes is committed first. */
export const NOTHING_CARRIED: CommittedSide = { carries: () => false, contentOf: () => null };

export interface ReadCommittedSideArgs {
  /** The foreign history's change: its merge base and its head, as the working side reads them. */
  from: TreeReadResult['state'];
  to: TreeReadResult['state'];
  /** The files the change removed (`applyCommitChange`). */
  removedPaths: ReadonlySet<string>;
  /** The engine's snapshot — the branch with its uncommitted work. */
  snapshot: WorkspaceTreeState;
  /** A conflict the pass rules for the change without asking (`change-answers.ts`). */
  unasked: (conflict: CommitChangeDocument) => boolean;
}

export async function readCommittedSide(
  run: GitRunner,
  rootDir: string,
  args: ReadCommittedSideArgs,
): Promise<CommittedSide> {
  const headFiles = await readCommitTreeFiles(run, rootDir, 'HEAD');
  if (headFiles === null) return NOTHING_CARRIED;
  const headTree = readWorkspaceTree(headFiles);
  const workspace = headTree.state.workspace;
  if (workspace === null || headTree.issues.length > 0) return NOTHING_CARRIED;

  const head: WorkspaceTreeState = withCommitSecretRows({
    state: { ...headTree.state, workspace },
    files: headFiles,
    local: args.snapshot.environments,
  });
  const laid = applyCommitChange({ current: head, from: args.from, to: args.to, removedPaths: args.removedPaths });
  // Where HEAD and the foreign side changed one value the commit needs the person's answer, not this reading.
  const answered = commitDocumentFiles(
    head,
    laid.conflicts.filter((conflict) => !args.unasked(conflict)).map((conflict) => conflict.uid),
  );

  // Planned with the fields HEAD's own files carry beyond the schema, so the commit keeps them.
  const recorded = new Map(
    planWorkspaceTree({ ...laid.next, workspace: laid.next.workspace ?? workspace }, headTree.unknowns).map((file) => [
      file.path,
      file.content,
    ]),
  );
  const documents = new Set([
    ...recorded.keys(),
    ...planWorkspaceTree(head).map((file) => file.path),
    ...planWorkspaceTree(args.snapshot).map((file) => file.path),
  ]);
  return {
    carries: (filePath) => documents.has(filePath) && !answered.has(filePath),
    contentOf: (filePath) => recorded.get(filePath) ?? null,
  };
}

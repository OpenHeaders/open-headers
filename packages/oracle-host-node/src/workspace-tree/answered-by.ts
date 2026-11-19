/**
 * What the readings of an integration's two sides answer for — the
 * branch's HEAD and the foreign commit: the pull's and the merge's
 * foreign head, the commit a pick lays, the parent a revert goes back
 * to, the rewritten head of a resolution. A file beside a manifest that
 * neither reading holds is the user's own, and the own-files landing
 * carries it (`own-files.ts`).
 *
 * Planned once, and only when the landing asks. A pull holds HEAD's
 * reading for its own account (`committed-side.ts`). A pick, a revert
 * and a resolution hold none: HEAD's tree is read at that ask, through
 * a git opened for that reading alone. One reading of a tree costs what
 * each of the pass's own does, and a file beside a manifest that no
 * document reads is rare — a pass that meets none reads nothing more.
 */

import { readDocumentPaths, type TreeReadResult } from '@openheaders/core/workspace-tree';
import { type CommitTree, commitTreePaths, type GitObjectBatchOpener, type GitRunner, withObjectBatch } from '../git';
import { readHead } from './committed-side';
import type { AnsweredPaths } from './own-files';

/** A commit's tree, read: the files of its documents and what they read as. */
export interface CommitReading {
  commit: CommitTree;
  tree: TreeReadResult;
}

/** `head` answers null where HEAD's tree cannot be read — the landing refuses there by itself. */
export function answeredBy(head: () => Promise<CommitReading | null>, foreign: CommitReading): AnsweredPaths {
  let answered: Promise<ReadonlySet<string>> | undefined;
  return () => {
    answered ??= head().then(
      (read) =>
        new Set([
          ...(read === null ? [] : readDocumentPaths(commitTreePaths(read.commit), read.tree)),
          ...readDocumentPaths(commitTreePaths(foreign.commit), foreign.tree),
        ]),
    );
    return answered;
  };
}

/** HEAD's reading for a pass that holds none: read when asked. */
export function headWhenAsked(pass: {
  run: GitRunner;
  objects: GitObjectBatchOpener;
  rootDir: string;
}): () => Promise<CommitReading | null> {
  return () => withObjectBatch(pass.objects, pass.rootDir, (objects) => readHead(pass.run, objects, pass.rootDir));
}

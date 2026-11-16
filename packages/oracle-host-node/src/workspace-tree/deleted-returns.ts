/**
 * A deleted entity back in the tree — its file returned under the uid
 * the engine deleted: a rollback or a revert of the deletion, a checkout
 * of a branch that still holds it, a stash popped, a foreign commit that
 * restores it.
 *
 * The engine's delete is permanent (the sync design §7.2): a create at
 * that uid is answered `tombstoned` and brings nothing back. Minted
 * anyway, the pass would count the file as taken in, the baseline would
 * list it, and the flush after would remove it as an entity the plan no
 * longer holds — the file gone from the disk, and from the next commit.
 *
 * So the create is set aside before it is applied: nothing is minted,
 * the file is held off the baseline — the materializer neither rewrites
 * nor removes it — and an issue row names it at its manifest.
 */

import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Environment } from '@openheaders/core/types';
import {
  classifyTreePath,
  entityRefOfManifest,
  environmentSecretFilePath,
  environmentSecretTemplateFilePath,
  type TreeFile,
  type TreeIssue,
} from '@openheaders/core/workspace-tree';

/** Whether the engine holds `(type, id)` deleted. */
export type DeletedEntityReader = (type: string, id: string) => boolean;

export const DELETED_RETURN_MESSAGE = 'deleted in this workspace earlier — the file is kept as it is and not loaded';

export interface DeletedReturns {
  /** The batches to apply: every one but a deleted entity's create. */
  batches: EmissionBatch[];
  /** One row for each entity set aside, at its manifest. */
  issues: TreeIssue[];
  /** Whether `path` is a file of an entity set aside — it never enters the baseline. */
  holds(path: string): boolean;
}

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

export function setAsideDeletedReturns(args: {
  batches: readonly EmissionBatch[];
  /** The tree the batches were synthesized from, with its texts. */
  files: readonly TreeFile[];
  changedPaths: ReadonlySet<string>;
  /** That tree's environments — their files are named, not held in a directory of their own. */
  environments: readonly Environment[];
  /** Absent, the engine holds nothing deleted. */
  isDeleted: DeletedEntityReader | undefined;
}): DeletedReturns {
  const { isDeleted } = args;
  const returned = new Set<string>();
  const batches = args.batches.filter((entry) => {
    let kept = true;
    for (const { body } of entry.batch.mutations) {
      if (body.kind === 'create' && isDeleted?.(body.type, body.id) === true) {
        returned.add(body.id);
        kept = false;
      }
    }
    return kept;
  });
  if (returned.size === 0) return { batches, issues: [], holds: () => false };

  const textOf = new Map(args.files.map((file) => [file.path, file.content] as const));
  const issues: TreeIssue[] = [];
  const dirs = new Set<string>();
  const paths = new Set<string>();
  for (const path of args.changedPaths) {
    const text = textOf.get(path);
    const classed = classifyTreePath(path);
    if (text === undefined || classed.kind !== 'manifest') continue;
    const entity = entityRefOfManifest(classed.candidate, text);
    if (entity === null || !returned.has(entity.uid)) continue;
    issues.push({ path, message: DELETED_RETURN_MESSAGE });
    if (entity.kind !== 'environment') {
      dirs.add(dirOf(path));
      continue;
    }
    paths.add(path);
    const environment = args.environments.find((candidate) => candidate.uid === entity.uid);
    if (environment !== undefined) {
      paths.add(environmentSecretFilePath(environment));
      paths.add(environmentSecretTemplateFilePath(environment));
    }
  }
  return { batches, issues, holds: (path) => paths.has(path) || dirs.has(dirOf(path)) };
}

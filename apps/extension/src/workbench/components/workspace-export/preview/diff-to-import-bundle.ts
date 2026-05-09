/**
 * Project a `DiffResult` from the workspace-export preview pipeline into
 * the generic `ImportBundle` + `ImportWorkspaceSnapshot` shape consumed
 * by `buildImportMergeSession`.
 *
 * Phase 7.3 scaffolding — used by the new merge-editor-driven import
 * surface that is replacing the legacy `<ImportPreviewModal>` body.
 *
 * Singletons (`workspaceVars`, `vault`) are intentionally omitted in
 * this slice. The diff carries their `state` + `target` but the
 * merge-editor needs both sides serialized, and the incoming side
 * lives on the parent `WorkspaceExport` envelope, not on the diff.
 * Singleton wiring lands in a follow-up slice when the new modal
 * threads the envelope alongside the diff.
 */

import type { DiffEntry, DiffResult } from '@openheaders/core/workspace-export';
import type { ImportBundle, ImportBundleEntity, ImportWorkspaceSnapshot } from '@/shared/conflicts';

/** Mirrors `SerializableEntityKind` from `@openheaders/core/workspace-export`
 *  for the bucket types this projection covers. Singletons (`workspaceVars`,
 *  `vault`) are handled out-of-band per the file header. */
export type ImportEntityType =
  | 'collection'
  | 'folder'
  | 'rule'
  | 'request'
  | 'template'
  | 'environment'
  | 'liveWorkflow'
  | 'liveVariable';

export interface DiffToImportBundleResult {
  bundle: ImportBundle;
  workspace: ImportWorkspaceSnapshot;
}

interface BucketEntity {
  uid: string;
  path?: string;
  name?: string;
}

function addBucket<E extends BucketEntity>(
  entityType: ImportEntityType,
  bucket: readonly DiffEntry<E>[],
  entries: ImportBundleEntity[],
  targets: Map<string, unknown>,
): void {
  for (const e of bucket) {
    const label = e.entity.path ?? e.entity.name ?? e.entity.uid;
    entries.push({
      uid: e.entity.uid,
      entityType,
      path: label,
      entity: e.entity,
    });
    if (e.matchedTarget) targets.set(e.entity.uid, e.matchedTarget);
  }
}

export function diffResultToImportBundle(diff: DiffResult): DiffToImportBundleResult {
  const entries: ImportBundleEntity[] = [];
  const targets = new Map<string, unknown>();

  addBucket('collection', diff.collections, entries, targets);
  addBucket('folder', diff.folders, entries, targets);
  addBucket('rule', diff.rules, entries, targets);
  addBucket('request', diff.requests, entries, targets);
  addBucket('template', diff.templates, entries, targets);
  addBucket('environment', diff.environments, entries, targets);
  addBucket('liveWorkflow', diff.liveWorkflows, entries, targets);
  addBucket('liveVariable', diff.liveVariables, entries, targets);

  return {
    bundle: { entities: entries },
    workspace: {
      findByPathOrUid(incoming) {
        return targets.get(incoming.uid);
      },
    },
  };
}

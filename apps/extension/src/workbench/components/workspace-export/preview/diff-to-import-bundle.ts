/**
 * Project a `DiffResult` from the workspace-export preview pipeline into
 * the generic `ImportBundle` + `ImportWorkspaceSnapshot` shape consumed
 * by `buildImportMergeSession`.
 *
 * Phase 7.3 scaffolding — used by the new merge-editor-driven import
 * surface that is replacing the legacy `<ImportPreviewModal>` body.
 *
 * Singletons (`workspaceVars`, `vault`) are projected when the parent
 * envelope is supplied. Synthetic uids `'__singleton.workspaceVars__'`
 * and `'__singleton.vault__'` keep them addressable through the same
 * `findByPathOrUid` lookup the bucket entities use. Singletons with
 * neither incoming nor target content are skipped (no diff to surface).
 */

import type { DiffEntry, DiffResult, DiffSingleton, WorkspaceExport } from '@openheaders/core/workspace-export';
import type { ImportBundle, ImportBundleEntity, ImportWorkspaceSnapshot } from '@/shared/conflicts';

/** Mirrors `SerializableEntityKind` from `@openheaders/core/workspace-export`.
 *  Both bucket entities and singletons share the union — the merge
 *  editor groups files by this string in its sidebar. */
export type ImportEntityType =
  | 'collection'
  | 'folder'
  | 'rule'
  | 'request'
  | 'template'
  | 'environment'
  | 'liveWorkflow'
  | 'liveVariable'
  | 'workspaceVars'
  | 'vault';

/** Synthetic uids for the singleton rows. Stable so the merge editor's
 *  per-file result-text cache survives layout changes / file switching. */
export const WORKSPACE_VARS_SINGLETON_UID = '__singleton.workspaceVars__';
export const VAULT_SINGLETON_UID = '__singleton.vault__';

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

function addSingleton(
  entityType: ImportEntityType,
  uid: string,
  incoming: unknown | undefined,
  singleton: DiffSingleton<unknown>,
  entries: ImportBundleEntity[],
  targets: Map<string, unknown>,
): void {
  const hasIncoming = incoming !== undefined && incoming !== null;
  const hasTarget = singleton.target !== undefined && singleton.target !== null;
  // Skip when neither side has content — there's nothing to diff.
  if (!hasIncoming && !hasTarget) return;
  // Singleton-removed-by-import is rare and not represented yet; skip
  // until a use case forces a separate `kind: 'remove'` projection.
  if (!hasIncoming) return;
  entries.push({ uid, entityType, path: entityType, entity: incoming });
  if (hasTarget) targets.set(uid, singleton.target);
}

export function diffResultToImportBundle(
  diff: DiffResult,
  envelope?: WorkspaceExport,
): DiffToImportBundleResult {
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

  if (envelope) {
    addSingleton(
      'workspaceVars',
      WORKSPACE_VARS_SINGLETON_UID,
      envelope.entities.workspaceVars,
      diff.workspaceVars,
      entries,
      targets,
    );
    addSingleton('vault', VAULT_SINGLETON_UID, envelope.entities.vault, diff.vault, entries, targets);
  }

  return {
    bundle: { entities: entries },
    workspace: {
      findByPathOrUid(incoming) {
        return targets.get(incoming.uid);
      },
    },
  };
}

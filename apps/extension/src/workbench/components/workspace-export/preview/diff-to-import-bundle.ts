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

import type {
  CollisionState,
  DiffEntry,
  DiffResult,
  DiffSingleton,
  PlanSingletonAction,
  StrategyMap,
  WorkspaceExport,
} from '@openheaders/core/workspace-export';
import type { MergeFile } from '@openheaders/ui/shared/merge-editor';
import type { ImportBundle, ImportBundleEntity, ImportWorkspaceSnapshot } from '@openheaders/ui/shared/conflicts';

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

// ── Apply path: merge-editor results → envelope + StrategyMap ──────

/** Singular `entityType` strings emitted by `diffResultToImportBundle`,
 *  paired with the plural bucket name on the export envelope. */
const BUCKET_BY_TYPE: Record<
  Exclude<ImportEntityType, 'workspaceVars' | 'vault'>,
  keyof Omit<DiffResult, 'workspaceVars' | 'vault'>
> = {
  collection: 'collections',
  folder: 'folders',
  rule: 'rules',
  request: 'requests',
  template: 'templates',
  environment: 'environments',
  liveWorkflow: 'liveWorkflows',
  liveVariable: 'liveVariables',
};

function collisionStateOf(diff: DiffResult, entityType: ImportEntityType, uid: string): CollisionState | undefined {
  if (entityType === 'workspaceVars' || entityType === 'vault') return undefined;
  const bucket = BUCKET_BY_TYPE[entityType];
  const list = diff[bucket] as readonly DiffEntry<{ uid: string }>[];
  return list.find((e) => e.entity.uid === uid)?.state;
}

export interface ApplyMergeResultsArgs {
  /** Original envelope produced by `parseWorkspaceExport` (or its
   *  decrypted counterpart). The function returns a fresh envelope
   *  with the user's resolved entities spliced in — the input is
   *  not mutated. */
  envelope: WorkspaceExport;
  files: readonly MergeFile[];
  results: ReadonlyMap<string, string>;
  diff: DiffResult;
  /** Caller-owned text → entity codec. Receives the merge file so the
   *  caller can dispatch by `file.group` (entity type) and look up the
   *  original entity's `path` from the envelope when the per-codec
   *  context requires it. Throw on parse failure;
   *  `applyMergeResultsToEnvelope` propagates so the caller can surface
   *  the row that broke. */
  deserialize: (text: string, file: MergeFile) => unknown;
}

export interface ApplyMergeResultsOutput {
  envelope: WorkspaceExport;
  strategies: StrategyMap;
}

/** Project the merge-editor's result-text map onto a fresh envelope +
 *  `StrategyMap` ready for `importWorkspace`. Decisions per file:
 *    - empty result → strategy `'skip'`, envelope unchanged.
 *    - collision + non-empty → splice resolved entity into envelope,
 *      strategy `'update'`.
 *    - non-collision + non-empty → splice + strategy `'new-uid'`.
 *    - singletons: `'replace'` on non-empty, `'skip'` on empty.
 *  Files absent from `results` (untouched) leave the envelope alone
 *  and fall through to the diff's default strategy. */
export function applyMergeResultsToEnvelope(args: ApplyMergeResultsArgs): ApplyMergeResultsOutput {
  const { envelope, files, results, diff, deserialize } = args;
  // Shallow-clone the envelope tree so mutations don't escape.
  const next: WorkspaceExport = {
    ...envelope,
    entities: { ...envelope.entities },
  };
  const strategies: StrategyMap = {};

  for (const file of files) {
    const text = results.get(file.id);
    if (text === undefined) continue;
    const entityType = (file.group ?? '') as ImportEntityType;
    const isEmpty = text.trim() === '';

    if (entityType === 'workspaceVars') {
      if (isEmpty) {
        strategies.workspaceVars = 'skip';
      } else {
        const parsed = deserialize(text, file);
        next.entities = { ...next.entities, workspaceVars: parsed as WorkspaceExport['entities']['workspaceVars'] };
        strategies.workspaceVars = 'replace' satisfies PlanSingletonAction;
      }
      continue;
    }
    if (entityType === 'vault') {
      if (isEmpty) {
        strategies.vault = 'skip';
      } else {
        const parsed = deserialize(text, file);
        next.entities = { ...next.entities, vault: parsed as WorkspaceExport['entities']['vault'] };
        strategies.vault = 'replace' satisfies PlanSingletonAction;
      }
      continue;
    }

    const bucket = BUCKET_BY_TYPE[entityType];
    if (!bucket) continue;
    const state = collisionStateOf(diff, entityType, file.id);
    const bucketKey = bucket as keyof StrategyMap;

    if (isEmpty) {
      const map = (strategies[bucketKey] as Record<string, string> | undefined) ?? {};
      map[file.id] = 'skip';
      (strategies as Record<string, unknown>)[bucketKey] = map;
      continue;
    }

    const parsed = deserialize(text, file);
    // Replace in the envelope's bucket array (immutable splice).
    const list = (next.entities[bucket] as readonly { uid: string }[] | undefined) ?? [];
    const idx = list.findIndex((e) => e.uid === file.id);
    const nextList =
      idx >= 0
        ? [...list.slice(0, idx), parsed as { uid: string }, ...list.slice(idx + 1)]
        : [...list, parsed as { uid: string }];
    (next.entities as Record<string, unknown>)[bucket] = nextList;

    const strategy = state && state !== 'no-collision' ? 'update' : 'new-uid';
    const map = (strategies[bucketKey] as Record<string, string> | undefined) ?? {};
    map[file.id] = strategy;
    (strategies as Record<string, unknown>)[bucketKey] = map;
  }

  return { envelope: next, strategies };
}

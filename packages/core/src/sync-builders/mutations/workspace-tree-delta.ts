/**
 * Working-tree → engine delta emission (GIT_PLAN.md §3.1 rung 2).
 *
 * Given the engine's snapshot (`prev`), a tree read (`next`), and the
 * per-file change classification against the last-materialized baseline
 * (the hashed `.oh/materialized-index.json`), synthesize the ordinary
 * local `MutationBatch`es that converge the engine to the tree's state
 * — external edits are the newest fact and enter through the same
 * mutators as keystrokes (plan law #1; no store is ever poked directly).
 *
 * The baseline is what makes this a three-way diff. A file whose bytes
 * differ from the engine's canonical plan is NOT automatically a user
 * edit — it may be a stale materialization the engine has since moved
 * past (a batch applied, the debounced write still pending). Only files
 * that differ from what the materializer LAST WROTE are external:
 *
 *   - `changedPaths` — on disk, bytes differ from the baseline hash
 *     (or the file is new). Entities owning such files are
 *     tree-authored this round: the tree's value wins via fresh-HLC
 *     batches (create when the uid is unknown, diff-update otherwise).
 *   - `removedPaths` — in the baseline, absent from disk. An entity
 *     whose manifest vanished this way was externally deleted and
 *     tombstones; an entity the materializer never wrote is NOT
 *     deletable from the tree side (S3 deletion-authority decision).
 *   - everything else — the engine's value stands; no batch.
 *
 * Family coverage rides `synthesizeImportEmission` (the import path's
 * proven create/update synthesis) for every family it owns; gRPC and
 * WebSocket requests (not part of the export envelope) and entity
 * `path` moves get their own passes here, and deletions are appended
 * per family, leaves before containers.
 *
 * Deliberately out of scope (engine placement wins, the next
 * materialize restores the tree): re-parenting a folder across
 * containers by moving its directory (the parent's ordered child slot
 * cannot be derived from paths alone), and `workspace.yaml` scalar
 * edits (workspace metadata lives on the host workspace store, not the
 * per-workspace entity plane).
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  GRPC_REQUEST_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  type MutationBody,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  SPEC_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Collection, Environment, Folder, GrpcRequest, WebSocketRequest } from '@openheaders/core/types';
import type { LocalFolder, PlanEntry } from '@openheaders/core/workspace-export';
import {
  environmentFilePath,
  environmentSecretFilePath,
  type TreeReadResult,
  type WorkspaceTreeState,
} from '@openheaders/core/workspace-tree';
import { buildDeleteCollectionBatch } from './collection-mutations';
import { buildDeleteEnvironmentBatch } from './env-mutations';
import { buildDeleteFolderBatch, buildDeleteFolderEntityBatch } from './folder-mutations';
import { buildGrpcAddBatch, buildGrpcDeleteBatch, buildGrpcUpdateBatch } from './grpc-request-mutations';
import { buildDeleteLiveVariableBatch } from './live-variable-mutations';
import { buildDeleteLiveWorkflowBatch } from './live-workflow-mutations';
import { buildDeleteRequestCollectionBatch } from './request-collection-mutations';
import { buildDeleteRequestFolderBatch, buildDeleteRequestFolderEntityBatch } from './request-folder-mutations';
import { buildDeleteBatch as buildDeleteRequestBatch } from './request-mutations';
import { buildDeleteBatch as buildDeleteRuleBatch } from './rule-mutations';
import { buildDeleteSpecBatch } from './spec-mutations';
import { buildDeleteTemplateCollectionBatch } from './template-collection-mutations';
import { buildDeleteTemplateFolderBatch, buildDeleteTemplateFolderEntityBatch } from './template-folder-mutations';
import { buildDeleteBatch as buildDeleteTemplateBatch } from './template-mutations';
import {
  buildWebSocketAddBatch,
  buildWebSocketDeleteBatch,
  buildWebSocketUpdateBatch,
} from './websocket-request-mutations';
import {
  bodiesBatch,
  diffKeys,
  type EmissionBatch,
  type ImportEmissionDeps,
  synthesizeImportEmission,
} from './workspace-import-emission';

export interface WorkspaceTreeDeltaArgs {
  /** The engine's current snapshot for the bound workspace. */
  prev: WorkspaceTreeState;
  /** The tree as read from disk (`readWorkspaceTree` state). */
  next: TreeReadResult['state'];
  /** Paths whose on-disk bytes differ from the last-materialized baseline (including files the baseline lacks). */
  changedPaths: ReadonlySet<string>;
  /** Baseline paths absent from disk — externally deleted files. */
  removedPaths: ReadonlySet<string>;
  deps: ImportEmissionDeps;
}

const MANIFEST_OF: ReadonlyMap<string, string> = new Map([
  [RULE_ENTITY_TYPE, 'rule.yaml'],
  [REQUEST_ENTITY_TYPE, 'request.yaml'],
  [GRPC_REQUEST_ENTITY_TYPE, 'grpc.yaml'],
  [WEBSOCKET_REQUEST_ENTITY_TYPE, 'websocket.yaml'],
  [TEMPLATE_ENTITY_TYPE, 'template.yaml'],
  [SPEC_ENTITY_TYPE, 'spec.yaml'],
  [LIVE_WORKFLOW_ENTITY_TYPE, 'workflow.yaml'],
  [LIVE_VARIABLE_ENTITY_TYPE, 'variable.yaml'],
]);

const dirOf = (path: string): string => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

const parentPathOf = (path: string): string | null => {
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : null;
};

function byUid<T extends { uid: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.uid, item] as const));
}

export function synthesizeWorkspaceTreeDelta(args: WorkspaceTreeDeltaArgs): EmissionBatch[] {
  const { prev, next, changedPaths, removedPaths, deps } = args;
  const out: EmissionBatch[] = [];

  // Directory attribution: an entity owns exactly the files directly in
  // its own directory (manifest + siblings), so "some file in my dir
  // changed" ⇔ "I am tree-authored this round". Nested entity dirs are
  // separate directories and never alias.
  const changedDirs = new Set<string>();
  for (const path of changedPaths) changedDirs.add(dirOf(path));
  const touched = (entityPath: string): boolean => changedDirs.has(entityPath);

  const nextUids = new Set<string>();
  const collect = (items: readonly { uid: string }[]): void => {
    for (const item of items) nextUids.add(item.uid);
  };
  collect(next.rules);
  collect(next.requests);
  collect(next.grpcRequests);
  collect(next.websocketRequests);
  collect(next.templates);
  collect(next.specs);
  collect(next.liveWorkflows);
  collect(next.liveVariables);
  collect(next.environments);
  collect(next.collections);
  collect(next.requestCollections);
  collect(next.templateCollections);
  collect(next.folders);
  collect(next.requestFolders);
  collect(next.templateFolders);

  const planEntries = <T extends { uid: string; path: string }>(
    nextItems: readonly T[],
    prevItems: readonly T[],
  ): PlanEntry<T>[] => {
    const prevByUid = byUid(prevItems);
    return nextItems
      .filter((entity) => touched(entity.path))
      .map((entity) =>
        prevByUid.has(entity.uid)
          ? { action: 'update' as const, targetUid: entity.uid, entity }
          : { action: 'create' as const, entity },
      );
  };

  const envTouched = (env: Environment): boolean =>
    changedPaths.has(environmentFilePath(env)) || changedPaths.has(environmentSecretFilePath(env));
  const envEntries: PlanEntry<Environment>[] = (() => {
    const prevByUid = byUid(prev.environments);
    return next.environments
      .filter(envTouched)
      .map((entity) =>
        prevByUid.has(entity.uid)
          ? { action: 'update' as const, targetUid: entity.uid, entity }
          : { action: 'create' as const, entity },
      );
  })();

  // Singletons: replace ONLY when the file itself changed AND parsed
  // (a parse failure surfaces as a read issue — the quarantine seam —
  // and must never wipe the engine's value), or when the materializer's
  // own file was externally deleted (diff-to-empty).
  const wsVarsFileChanged = changedPaths.has('workspace-vars.yaml');
  const wsVarsFileRemoved = removedPaths.has('workspace-vars.yaml');
  const wsVars =
    wsVarsFileChanged && next.workspaceVariables !== null
      ? { action: 'replace' as const, variables: next.workspaceVariables.variables }
      : wsVarsFileRemoved && prev.workspaceVariables !== null
        ? { action: 'replace' as const, variables: [] }
        : { action: 'skip' as const, variables: [] };
  const vaultFileChanged = changedPaths.has('workspace-vars.secret.yaml');
  const vaultFileRemoved = removedPaths.has('workspace-vars.secret.yaml');
  const vault =
    vaultFileChanged && next.vault !== null
      ? { action: 'replace' as const, secrets: next.vault.secrets }
      : vaultFileRemoved && prev.vault !== null
        ? { action: 'replace' as const, secrets: [] }
        : { action: 'skip' as const, secrets: [] };

  const toLocalFolders = (folders: readonly Folder[]): LocalFolder[] => folders as unknown as LocalFolder[];

  out.push(
    ...synthesizeImportEmission(
      {
        plan: {
          collections: [],
          folders: [],
          rules: planEntries(next.rules, prev.rules),
          requests: planEntries(next.requests, prev.requests),
          templates: planEntries(next.templates, prev.templates),
          environments: envEntries,
          liveWorkflows: planEntries(next.liveWorkflows, prev.liveWorkflows),
          liveVariables: planEntries(next.liveVariables, prev.liveVariables),
          specs: planEntries(next.specs, prev.specs),
          workspaceVars: wsVars,
          vault,
          uidRemap: {},
        },
        ruleCollections: planEntries(next.collections, prev.collections),
        requestCollections: planEntries(next.requestCollections, prev.requestCollections),
        templateCollections: planEntries(next.templateCollections, prev.templateCollections),
        ruleFolders: planEntries(toLocalFolders(next.folders), toLocalFolders(prev.folders)),
        requestFolders: planEntries(toLocalFolders(next.requestFolders), toLocalFolders(prev.requestFolders)),
        templateFolders: planEntries(toLocalFolders(next.templateFolders), toLocalFolders(prev.templateFolders)),
      },
      {
        rules: prev.rules,
        requests: prev.requests,
        templates: prev.templates,
        environments: prev.environments,
        liveWorkflows: prev.liveWorkflows,
        liveVariables: prev.liveVariables,
        specs: prev.specs,
        ruleCollections: prev.collections,
        requestCollections: prev.requestCollections,
        templateCollections: prev.templateCollections,
        ruleFolders: toLocalFolders(prev.folders),
        requestFolders: toLocalFolders(prev.requestFolders),
        templateFolders: toLocalFolders(prev.templateFolders),
        ...(prev.workspaceVariables !== null ? { workspaceVars: prev.workspaceVariables } : {}),
        ...(prev.vault !== null ? { vault: prev.vault } : {}),
      },
      deps,
    ),
  );

  emitGrpcRequests(
    out,
    next.grpcRequests.filter((entity) => touched(entity.path)),
    prev.grpcRequests,
    deps,
  );
  emitWebSocketRequests(
    out,
    next.websocketRequests.filter((entity) => touched(entity.path)),
    prev.websocketRequests,
    deps,
  );

  emitPathMoves(out, prev, next, touched, deps);
  emitDeletions(out, prev, nextUids, removedPaths, deps);

  return out.filter((entry) => entry.batch.mutations.length > 0);
}

// ── gRPC / WebSocket requests (no export-envelope membership) ────────

const LEAF_SKIP = new Set(['uid', 'path']);

function emitGrpcRequests(
  out: EmissionBatch[],
  entries: readonly GrpcRequest[],
  prevItems: readonly GrpcRequest[],
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entity of entries) {
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity) {
      const payload = buildGrpcAddBatch(entity, deps.nextCtx());
      out.push({
        label: `grpc-request:${entity.uid} (create)`,
        batch: payload.batch,
        sideEffects: payload.sideEffects,
      });
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as unknown as Record<string, unknown>,
      entity as unknown as Record<string, unknown>,
      LEAF_SKIP,
    );
    if (Object.keys(updates).length > 0) {
      const payload = buildGrpcUpdateBatch(
        entity.uid,
        updates as Partial<Omit<GrpcRequest, 'uid' | 'path'>>,
        deps.nextCtx(),
        (id, setPath) => deps.liveSetEntries(GRPC_REQUEST_ENTITY_TYPE, id, setPath),
        (_id, path) => (prevEntity as unknown as Record<string, unknown>)[path],
      );
      out.push({
        label: `grpc-request:${entity.uid} (update)`,
        batch: payload.batch,
        sideEffects: payload.sideEffects,
      });
    }
    if (removedKeys.length > 0) {
      const bodies: MutationBody[] = removedKeys.map((key) => ({
        kind: 'unsetField',
        type: GRPC_REQUEST_ENTITY_TYPE,
        id: entity.uid,
        path: key,
      }));
      out.push(bodiesBatch(`grpc-request:${entity.uid} (unset)`, bodies, deps.nextCtx()));
    }
  }
}

function emitWebSocketRequests(
  out: EmissionBatch[],
  entries: readonly WebSocketRequest[],
  prevItems: readonly WebSocketRequest[],
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entity of entries) {
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity) {
      const payload = buildWebSocketAddBatch(entity, deps.nextCtx());
      out.push({
        label: `websocket-request:${entity.uid} (create)`,
        batch: payload.batch,
        sideEffects: payload.sideEffects,
      });
      continue;
    }
    const { updates, removedKeys } = diffKeys(
      prevEntity as unknown as Record<string, unknown>,
      entity as unknown as Record<string, unknown>,
      LEAF_SKIP,
    );
    if (Object.keys(updates).length > 0) {
      const payload = buildWebSocketUpdateBatch(
        entity.uid,
        updates as Partial<Omit<WebSocketRequest, 'uid' | 'path'>>,
        deps.nextCtx(),
        (id, setPath) => deps.liveSetEntries(WEBSOCKET_REQUEST_ENTITY_TYPE, id, setPath),
        (_id, path) => (prevEntity as unknown as Record<string, unknown>)[path],
      );
      out.push({
        label: `websocket-request:${entity.uid} (update)`,
        batch: payload.batch,
        sideEffects: payload.sideEffects,
      });
    }
    if (removedKeys.length > 0) {
      const bodies: MutationBody[] = removedKeys.map((key) => ({
        kind: 'unsetField',
        type: WEBSOCKET_REQUEST_ENTITY_TYPE,
        id: entity.uid,
        path: key,
      }));
      out.push(bodiesBatch(`websocket-request:${entity.uid} (unset)`, bodies, deps.nextCtx()));
    }
  }
}

// ── Path moves (directory renames) ──────────────────────────────────

interface MoveFamily {
  entityType: string;
  nextItems: readonly { uid: string; path: string }[];
  prevItems: readonly { uid: string; path: string }[];
}

/**
 * A directory rename changes every resident entity's `path` while the
 * uids inside the manifests stay put. Placement is the entity's own
 * mutator-maintained `path` (S3 decision), so a single `setField`
 * converges it — the next materialize then writes the canonical file
 * at the new location and the hashed index retires the old one.
 *
 * Folders are the one guarded family: their path may only follow the
 * tree when the PARENT container is unchanged (a rename in place, or a
 * renamed ancestor cascading down). A cross-parent move would also
 * need the parents' ordered child slots rewritten, which paths alone
 * cannot express — the engine's placement stands and the next
 * materialize restores the directory.
 */
function emitPathMoves(
  out: EmissionBatch[],
  prev: WorkspaceTreeState,
  next: TreeReadResult['state'],
  touched: (entityPath: string) => boolean,
  deps: ImportEmissionDeps,
): void {
  const leafFamilies: MoveFamily[] = [
    { entityType: RULE_ENTITY_TYPE, nextItems: next.rules, prevItems: prev.rules },
    { entityType: REQUEST_ENTITY_TYPE, nextItems: next.requests, prevItems: prev.requests },
    { entityType: GRPC_REQUEST_ENTITY_TYPE, nextItems: next.grpcRequests, prevItems: prev.grpcRequests },
    { entityType: WEBSOCKET_REQUEST_ENTITY_TYPE, nextItems: next.websocketRequests, prevItems: prev.websocketRequests },
    { entityType: TEMPLATE_ENTITY_TYPE, nextItems: next.templates, prevItems: prev.templates },
    { entityType: SPEC_ENTITY_TYPE, nextItems: next.specs, prevItems: prev.specs },
    { entityType: LIVE_WORKFLOW_ENTITY_TYPE, nextItems: next.liveWorkflows, prevItems: prev.liveWorkflows },
    { entityType: LIVE_VARIABLE_ENTITY_TYPE, nextItems: next.liveVariables, prevItems: prev.liveVariables },
    { entityType: COLLECTION_ENTITY_TYPE, nextItems: next.collections, prevItems: prev.collections },
    {
      entityType: REQUEST_COLLECTION_ENTITY_TYPE,
      nextItems: next.requestCollections,
      prevItems: prev.requestCollections,
    },
    {
      entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
      nextItems: next.templateCollections,
      prevItems: prev.templateCollections,
    },
  ];
  for (const family of leafFamilies) {
    const prevByUid = byUid(family.prevItems);
    for (const entity of family.nextItems) {
      if (!touched(entity.path)) continue;
      const prevEntity = prevByUid.get(entity.uid);
      if (!prevEntity || prevEntity.path === entity.path) continue;
      out.push(
        bodiesBatch(
          `${family.entityType}:${entity.uid} (move)`,
          [{ kind: 'setField', type: family.entityType, id: entity.uid, path: 'path', value: entity.path }],
          deps.nextCtx(),
        ),
      );
    }
  }

  const folderFamilies: Array<{
    entityType: string;
    nextFolders: readonly Folder[];
    prevFolders: readonly Folder[];
    nextContainers: readonly Collection[];
    prevContainers: readonly Collection[];
  }> = [
    {
      entityType: FOLDER_ENTITY_TYPE,
      nextFolders: next.folders,
      prevFolders: prev.folders,
      nextContainers: next.collections,
      prevContainers: prev.collections,
    },
    {
      entityType: REQUEST_FOLDER_ENTITY_TYPE,
      nextFolders: next.requestFolders,
      prevFolders: prev.requestFolders,
      nextContainers: next.requestCollections,
      prevContainers: prev.requestCollections,
    },
    {
      entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
      nextFolders: next.templateFolders,
      prevFolders: prev.templateFolders,
      nextContainers: next.templateCollections,
      prevContainers: prev.templateCollections,
    },
  ];
  for (const family of folderFamilies) {
    const prevByUid = byUid(family.prevFolders);
    const prevParentUid = parentUidResolver(family.prevContainers, family.prevFolders);
    const nextParentUid = parentUidResolver(family.nextContainers, family.nextFolders);
    for (const folder of family.nextFolders) {
      if (!touched(folder.path)) continue;
      const prevFolder = prevByUid.get(folder.uid);
      if (!prevFolder || prevFolder.path === folder.path) continue;
      if (prevParentUid(prevFolder.path) !== nextParentUid(folder.path)) continue;
      out.push(
        bodiesBatch(
          `${family.entityType}:${folder.uid} (move)`,
          [{ kind: 'setField', type: family.entityType, id: folder.uid, path: 'path', value: folder.path }],
          deps.nextCtx(),
        ),
      );
    }
  }
}

/** Resolve a folder path's parent container/folder uid by path prefix; null when unresolvable. */
function parentUidResolver(
  containers: readonly Collection[],
  folders: readonly Folder[],
): (folderPath: string) => string | null {
  const uidByPath = new Map<string, string>();
  for (const container of containers) uidByPath.set(container.path, container.uid);
  for (const folder of folders) uidByPath.set(folder.path, folder.uid);
  return (folderPath) => {
    const parentPath = parentPathOf(folderPath);
    return parentPath !== null ? (uidByPath.get(parentPath) ?? null) : null;
  };
}

// ── Deletions (gated on the materialized baseline) ──────────────────

function emitDeletions(
  out: EmissionBatch[],
  prev: WorkspaceTreeState,
  nextUids: ReadonlySet<string>,
  removedPaths: ReadonlySet<string>,
  deps: ImportEmissionDeps,
): void {
  const vanished = <T extends { uid: string; path: string }>(items: readonly T[], entityType: string): T[] =>
    items.filter((entity) => {
      if (nextUids.has(entity.uid)) return false;
      const manifest = MANIFEST_OF.get(entityType);
      return manifest !== undefined && removedPaths.has(`${entity.path}/${manifest}`);
    });

  const push = (label: string, payload: { batch: EmissionBatch['batch']; sideEffects: EmissionBatch['sideEffects'] }) =>
    out.push({ label, batch: payload.batch, sideEffects: payload.sideEffects });

  for (const rule of vanished(prev.rules, RULE_ENTITY_TYPE)) {
    push(`rule:${rule.uid} (delete)`, buildDeleteRuleBatch(rule.uid, deps.nextCtx()));
  }
  for (const request of vanished(prev.requests, REQUEST_ENTITY_TYPE)) {
    push(`request:${request.uid} (delete)`, buildDeleteRequestBatch(request.uid, deps.nextCtx()));
  }
  for (const grpcRequest of vanished(prev.grpcRequests, GRPC_REQUEST_ENTITY_TYPE)) {
    push(`grpc-request:${grpcRequest.uid} (delete)`, buildGrpcDeleteBatch(grpcRequest.uid, deps.nextCtx()));
  }
  for (const websocketRequest of vanished(prev.websocketRequests, WEBSOCKET_REQUEST_ENTITY_TYPE)) {
    push(
      `websocket-request:${websocketRequest.uid} (delete)`,
      buildWebSocketDeleteBatch(websocketRequest.uid, deps.nextCtx()),
    );
  }
  for (const template of vanished(prev.templates, TEMPLATE_ENTITY_TYPE)) {
    push(`template:${template.uid} (delete)`, buildDeleteTemplateBatch(template.uid, deps.nextCtx()));
  }
  for (const spec of vanished(prev.specs, SPEC_ENTITY_TYPE)) {
    push(`spec:${spec.uid} (delete)`, buildDeleteSpecBatch(spec.uid, deps.nextCtx()));
  }
  for (const liveWorkflow of vanished(prev.liveWorkflows, LIVE_WORKFLOW_ENTITY_TYPE)) {
    push(`live-workflow:${liveWorkflow.uid} (delete)`, buildDeleteLiveWorkflowBatch(liveWorkflow.uid, deps.nextCtx()));
  }
  for (const liveVariable of vanished(prev.liveVariables, LIVE_VARIABLE_ENTITY_TYPE)) {
    push(`live-variable:${liveVariable.uid} (delete)`, buildDeleteLiveVariableBatch(liveVariable.uid, deps.nextCtx()));
  }

  for (const environment of prev.environments) {
    if (nextUids.has(environment.uid)) continue;
    if (!removedPaths.has(environmentFilePath(environment))) continue;
    push(
      `environment:${environment.uid} (delete)`,
      buildDeleteEnvironmentBatch({ envId: environment.uid }, deps.nextCtx()),
    );
  }

  // Folders deepest-first so a child's parented delete never targets an
  // already-tombstoned parent slot; when the whole subtree vanished the
  // bare entity tombstone suffices (the parent tombstones too).
  emitFolderDeletions(out, {
    entityType: 'folder',
    prevFolders: prev.folders,
    prevContainers: prev.collections,
    containerType: COLLECTION_ENTITY_TYPE,
    folderType: FOLDER_ENTITY_TYPE,
    nextUids,
    removedPaths,
    deps,
    parented: (folderUid, parent, ctx) =>
      buildDeleteFolderBatch(
        { folderUid, parent: parent as Parameters<typeof buildDeleteFolderBatch>[0]['parent'] },
        ctx,
      ),
    bare: (folderUid, ctx) => ({ batch: buildDeleteFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
  });
  emitFolderDeletions(out, {
    entityType: 'request-folder',
    prevFolders: prev.requestFolders,
    prevContainers: prev.requestCollections,
    containerType: REQUEST_COLLECTION_ENTITY_TYPE,
    folderType: REQUEST_FOLDER_ENTITY_TYPE,
    nextUids,
    removedPaths,
    deps,
    parented: (folderUid, parent, ctx) =>
      buildDeleteRequestFolderBatch(
        { folderUid, parent: parent as Parameters<typeof buildDeleteRequestFolderBatch>[0]['parent'] },
        ctx,
      ),
    bare: (folderUid, ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
  });
  emitFolderDeletions(out, {
    entityType: 'template-folder',
    prevFolders: prev.templateFolders,
    prevContainers: prev.templateCollections,
    containerType: TEMPLATE_COLLECTION_ENTITY_TYPE,
    folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
    nextUids,
    removedPaths,
    deps,
    parented: (folderUid, parent, ctx) =>
      buildDeleteTemplateFolderBatch(
        { folderUid, parent: parent as Parameters<typeof buildDeleteTemplateFolderBatch>[0]['parent'] },
        ctx,
      ),
    bare: (folderUid, ctx) => ({ batch: buildDeleteTemplateFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
  });

  const collectionVanished = (collections: readonly Collection[]): Collection[] =>
    collections.filter(
      (collection) => !nextUids.has(collection.uid) && removedPaths.has(`${collection.path}/_collection.yaml`),
    );
  for (const collection of collectionVanished(prev.collections)) {
    push(`collection:${collection.uid} (delete)`, buildDeleteCollectionBatch(collection.uid, deps.nextCtx()));
  }
  for (const collection of collectionVanished(prev.requestCollections)) {
    push(
      `request-collection:${collection.uid} (delete)`,
      buildDeleteRequestCollectionBatch(collection.uid, deps.nextCtx()),
    );
  }
  for (const collection of collectionVanished(prev.templateCollections)) {
    push(
      `template-collection:${collection.uid} (delete)`,
      buildDeleteTemplateCollectionBatch(collection.uid, deps.nextCtx()),
    );
  }
}

interface FolderDeletionArgs {
  entityType: string;
  prevFolders: readonly Folder[];
  prevContainers: readonly Collection[];
  containerType: string;
  folderType: string;
  nextUids: ReadonlySet<string>;
  removedPaths: ReadonlySet<string>;
  deps: ImportEmissionDeps;
  parented: (
    folderUid: string,
    parent: { type: string; uid: string },
    ctx: ReturnType<ImportEmissionDeps['nextCtx']>,
  ) => { batch: EmissionBatch['batch']; sideEffects: EmissionBatch['sideEffects'] };
  bare: (
    folderUid: string,
    ctx: ReturnType<ImportEmissionDeps['nextCtx']>,
  ) => { batch: EmissionBatch['batch']; sideEffects: EmissionBatch['sideEffects'] };
}

function emitFolderDeletions(out: EmissionBatch[], args: FolderDeletionArgs): void {
  const vanishedFolders = args.prevFolders.filter(
    (folder) => !args.nextUids.has(folder.uid) && args.removedPaths.has(`${folder.path}/_folder.yaml`),
  );
  const vanishedUids = new Set(vanishedFolders.map((folder) => folder.uid));
  const parentByPath = new Map<string, { type: string; uid: string }>();
  for (const container of args.prevContainers) {
    parentByPath.set(container.path, { type: args.containerType, uid: container.uid });
  }
  for (const folder of args.prevFolders) {
    parentByPath.set(folder.path, { type: args.folderType, uid: folder.uid });
  }

  const deepestFirst = [...vanishedFolders].sort((a, b) => b.path.split('/').length - a.path.split('/').length);
  for (const folder of deepestFirst) {
    const parentPath = parentPathOf(folder.path);
    const parent = parentPath !== null ? parentByPath.get(parentPath) : undefined;
    const parentAlsoVanishing = parent !== undefined && vanishedUids.has(parent.uid);
    const payload =
      parent !== undefined && !parentAlsoVanishing
        ? args.parented(folder.uid, parent, args.deps.nextCtx())
        : args.bare(folder.uid, args.deps.nextCtx());
    out.push({
      label: `${args.entityType}:${folder.uid} (delete)`,
      batch: payload.batch,
      sideEffects: payload.sideEffects,
    });
  }
}

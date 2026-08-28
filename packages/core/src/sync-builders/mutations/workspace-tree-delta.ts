/**
 * Working-tree → engine delta emission (the git-sync plan §3.1 rung 2).
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
 * Containment is the parent's ordered set, so the tree speaks to it in
 * two ways (the tree containment plan, Disk): a tree-authored
 * manifest's `order:` becomes a slot-order plan (`tree-slot-order.ts`)
 * that keys every child created or moved into that container this
 * round and re-keys the live members whose relative order changed; and
 * a directory moved across parents — leaf or folder — is one slot
 * transfer, the new parent read off the destination path through the
 * shared resolver. A manifest without `order:` keeps the engine's order.
 *
 * Deliberately out of scope: `workspace.yaml` scalar edits (workspace
 * metadata lives on the host workspace store, not the per-workspace
 * entity plane) — only its `order:` is read.
 */

import {
  type ChildMutators,
  type ChildPlacement,
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  folderChild,
  GRPC_REQUEST_ENTITY_TYPE,
  grpcRequestChild,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutationBody,
  mqttRequestChild,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  type RequestFolderParentRef,
  RULE_ENTITY_TYPE,
  requestChild,
  requestFolderChild,
  ruleChild,
  SPEC_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_FOLDER_TREE_KINDS,
  type TreeParentKinds,
  type TreeParentRef,
  templateChild,
  templateFolderChild,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  webSocketRequestChild,
} from '@openheaders/core/sync';
import type {
  Collection,
  Environment,
  Folder,
  GrpcRequest,
  MqttRequest,
  WebSocketRequest,
} from '@openheaders/core/types';
import { lastPathSegment } from '@openheaders/core/utils';
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
import {
  buildGrpcAddBatch,
  buildGrpcDeleteBatch,
  buildGrpcDeleteEntityBatch,
  buildGrpcUpdateBatch,
} from './grpc-request-mutations';
import { buildDeleteLiveVariableBatch } from './live-variable-mutations';
import { buildDeleteLiveWorkflowBatch } from './live-workflow-mutations';
import {
  buildMqttAddBatch,
  buildMqttDeleteBatch,
  buildMqttDeleteEntityBatch,
  buildMqttUpdateBatch,
} from './mqtt-request-mutations';
import { buildDeleteRequestCollectionBatch } from './request-collection-mutations';
import { buildDeleteRequestFolderBatch, buildDeleteRequestFolderEntityBatch } from './request-folder-mutations';
import {
  buildDeleteBatch as buildDeleteRequestBatch,
  buildDeleteEntityBatch as buildDeleteRequestEntityBatch,
} from './request-mutations';
import {
  buildDeleteBatch as buildDeleteRuleBatch,
  buildDeleteEntityBatch as buildDeleteRuleEntityBatch,
} from './rule-mutations';
import { buildDeleteSpecBatch } from './spec-mutations';
import { buildDeleteTemplateCollectionBatch } from './template-collection-mutations';
import { buildDeleteTemplateFolderBatch, buildDeleteTemplateFolderEntityBatch } from './template-folder-mutations';
import {
  buildDeleteBatch as buildDeleteTemplateBatch,
  buildDeleteEntityBatch as buildDeleteTemplateEntityBatch,
} from './template-mutations';
import { planSlotOrder, type SlotOrderPlan, type SlotOrderTarget } from './tree-slot-order';
import {
  buildWebSocketAddBatch,
  buildWebSocketDeleteBatch,
  buildWebSocketDeleteEntityBatch,
  buildWebSocketUpdateBatch,
} from './websocket-request-mutations';
import {
  bodiesBatch,
  createTailTracker,
  createTreePlacer,
  diffKeys,
  type EmissionBatch,
  type ImportEmissionDeps,
  LEAF_SKIP,
  synthesizeImportEmission,
  type TailTracker,
  type TreePlacer,
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
  [MQTT_REQUEST_ENTITY_TYPE, 'mqtt.yaml'],
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
  collect(next.mqttRequests);
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
  const trustedRootsFileChanged = changedPaths.has('trusted-roots.yaml');
  const trustedRootsFileRemoved = removedPaths.has('trusted-roots.yaml');
  const trustedRoots =
    trustedRootsFileChanged && next.trustedRoots !== null
      ? { action: 'replace' as const, roots: next.trustedRoots.roots }
      : trustedRootsFileRemoved && prev.trustedRoots !== null
        ? { action: 'replace' as const, roots: [] }
        : { action: 'skip' as const, roots: [] };

  const toLocalFolders = (folders: readonly Folder[]): LocalFolder[] => folders as unknown as LocalFolder[];
  const requestCollections = planEntries(next.requestCollections, prev.requestCollections);
  const requestFolders = planEntries(toLocalFolders(next.requestFolders), toLocalFolders(prev.requestFolders));

  // One slot-key minter for the whole round: the emission's creates,
  // the three request kinds below and the path moves all place through
  // it, and a tree-authored `order:` pre-assigns the keys it hands out.
  const slotOrder = planTreeOrder(next, touched, deps.liveSetEntries);
  const tail = createTailTracker(deps.liveSetEntries, slotOrder);
  const emissionDeps: ImportEmissionDeps = { ...deps, tail };

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
          trustedRoots,
          uidRemap: {},
        },
        ruleCollections: planEntries(next.collections, prev.collections),
        requestCollections,
        templateCollections: planEntries(next.templateCollections, prev.templateCollections),
        ruleFolders: planEntries(toLocalFolders(next.folders), toLocalFolders(prev.folders)),
        requestFolders,
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
        ...(prev.trustedRoots !== null ? { trustedRoots: prev.trustedRoots } : {}),
      },
      emissionDeps,
    ),
  );

  // The three request kinds the export envelope doesn't carry take
  // their parent slot the same way the emission places its leaves: the
  // request tree as the engine + this sweep know it, through the shared
  // minter.
  const requestTree = createTreePlacer(
    REQUEST_FOLDER_TREE_KINDS,
    prev.requestCollections,
    requestCollections,
    toLocalFolders(prev.requestFolders),
    requestFolders,
  );
  const placeRequest = (entity: { uid: string; path: string }): ChildPlacement<RequestFolderParentRef> | null =>
    requestTree.placeLeaf(entity, REQUEST_FOLDER_ITEMS_PATH, tail);

  emitGrpcRequests(
    out,
    next.grpcRequests.filter((entity) => touched(entity.path)),
    prev.grpcRequests,
    placeRequest,
    deps,
  );
  emitWebSocketRequests(
    out,
    next.websocketRequests.filter((entity) => touched(entity.path)),
    prev.websocketRequests,
    placeRequest,
    deps,
  );
  emitMqttRequests(
    out,
    next.mqttRequests.filter((entity) => touched(entity.path)),
    prev.mqttRequests,
    placeRequest,
    deps,
  );

  emitPathMoves(out, prev, next, touched, tail, deps);
  for (const reorder of slotOrder.reorders) {
    out.push(bodiesBatch(`${reorder.parent.type}:${reorder.parent.uid} (reorder)`, reorder.bodies, deps.nextCtx()));
  }
  emitDeletions(out, prev, nextUids, removedPaths, deps);

  return out.filter((entry) => entry.batch.mutations.length > 0);
}

// ── Tree-authored `order:` → slot-order plan ─────────────────────────

interface TreeOrderFamily<C extends string, F extends string> {
  kinds: TreeParentKinds<C, F>;
  childrenPath: string;
  itemsPath: string;
  rootsPath: string;
  collections: readonly Collection[];
  folders: readonly Folder[];
  leaves: ReadonlyArray<{ uid: string; path: string }>;
  /** The manifest's per-tree collection list, when `workspace.yaml` carries one. */
  rootOrder: readonly string[] | undefined;
}

/**
 * Every ordered set a tree-authored manifest speaks for: a touched
 * container with an `order:` (its `folders` and `items` sets, split by
 * what each named directory holds), and the roots set of each tree the
 * touched `workspace.yaml` lists. The desired sequence is the listed
 * directories in listed order, then the unlisted ones in name order;
 * names with no directory are ignored.
 */
function planTreeOrder(
  next: TreeReadResult['state'],
  touched: (entityPath: string) => boolean,
  live: ImportEmissionDeps['liveSetEntries'],
): SlotOrderPlan {
  const manifestOrder = touched('') ? next.workspace?.order : undefined;
  const families: Array<TreeOrderFamily<string, string>> = [
    {
      kinds: FOLDER_TREE_KINDS,
      childrenPath: FOLDER_CHILDREN_PATH,
      itemsPath: FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
      collections: next.collections,
      folders: next.folders,
      leaves: next.rules,
      rootOrder: manifestOrder?.rules,
    },
    {
      kinds: REQUEST_FOLDER_TREE_KINDS,
      childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
      itemsPath: REQUEST_FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
      collections: next.requestCollections,
      folders: next.requestFolders,
      leaves: [...next.requests, ...next.grpcRequests, ...next.websocketRequests, ...next.mqttRequests],
      rootOrder: manifestOrder?.requests,
    },
    {
      kinds: TEMPLATE_FOLDER_TREE_KINDS,
      childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
      collections: next.templateCollections,
      folders: next.templateFolders,
      leaves: next.templates,
      rootOrder: manifestOrder?.templates,
    },
  ];
  const targets: SlotOrderTarget[] = [];
  for (const family of families) {
    const collectionsByParent = childrenByParent(family.collections);
    const foldersByParent = childrenByParent(family.folders);
    const leavesByParent = childrenByParent(family.leaves);
    const container = (type: string, entity: Collection | Folder): void => {
      if (!touched(entity.path) || entity.order === undefined) return;
      const parent = { type, uid: entity.uid };
      targets.push(
        {
          parent,
          setPath: family.childrenPath,
          desired: inListedOrder(foldersByParent.get(entity.path), entity.order),
        },
        { parent, setPath: family.itemsPath, desired: inListedOrder(leavesByParent.get(entity.path), entity.order) },
      );
    };
    for (const collection of family.collections) container(family.kinds.collectionType, collection);
    for (const folder of family.folders) container(family.kinds.folderType, folder);
    if (family.rootOrder !== undefined) {
      targets.push({
        parent: WORKSPACE_ROOTS_REF,
        setPath: family.rootsPath,
        desired: inListedOrder(collectionsByParent.get(family.kinds.treePrefix), family.rootOrder),
      });
    }
  }
  return planSlotOrder(targets, live);
}

interface ChildDirectory {
  uid: string;
  segment: string;
}

function childrenByParent(entities: ReadonlyArray<{ uid: string; path: string }>): Map<string, ChildDirectory[]> {
  const out = new Map<string, ChildDirectory[]>();
  for (const entity of entities) {
    const parentPath = parentPathOf(entity.path);
    const segment = lastPathSegment(entity.path);
    if (parentPath === null || segment === null) continue;
    const bucket = out.get(parentPath);
    const child = { uid: entity.uid, segment };
    if (bucket) bucket.push(child);
    else out.set(parentPath, [child]);
  }
  return out;
}

/** Listed directories in listed order, then the unlisted ones by name. */
function inListedOrder(children: readonly ChildDirectory[] | undefined, order: readonly string[]): string[] {
  if (!children) return [];
  const rank = new Map<string, number>();
  order.forEach((segment, index) => {
    if (!rank.has(segment)) rank.set(segment, index);
  });
  const position = (child: ChildDirectory): number => rank.get(child.segment) ?? Number.POSITIVE_INFINITY;
  return [...children]
    .sort((a, b) => {
      const byRank = position(a) - position(b);
      if (byRank !== 0) return byRank;
      return a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0;
    })
    .map((child) => child.uid);
}

// ── gRPC / WebSocket requests (no export-envelope membership) ────────

type PlaceRequest = (entity: { uid: string; path: string }) => ChildPlacement<RequestFolderParentRef> | null;

function emitGrpcRequests(
  out: EmissionBatch[],
  entries: readonly GrpcRequest[],
  prevItems: readonly GrpcRequest[],
  place: PlaceRequest,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entity of entries) {
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity) {
      const payload = buildGrpcAddBatch(entity, deps.nextCtx(), place(entity));
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
  place: PlaceRequest,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entity of entries) {
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity) {
      const payload = buildWebSocketAddBatch(entity, deps.nextCtx(), place(entity));
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

function emitMqttRequests(
  out: EmissionBatch[],
  entries: readonly MqttRequest[],
  prevItems: readonly MqttRequest[],
  place: PlaceRequest,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(prevItems);
  for (const entity of entries) {
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity) {
      const payload = buildMqttAddBatch(entity, deps.nextCtx(), place(entity));
      out.push({
        label: `mqtt-request:${entity.uid} (create)`,
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
      const payload = buildMqttUpdateBatch(
        entity.uid,
        updates as Partial<Omit<MqttRequest, 'uid' | 'path'>>,
        deps.nextCtx(),
        (id, setPath) => deps.liveSetEntries(MQTT_REQUEST_ENTITY_TYPE, id, setPath),
        (_id, path) => (prevEntity as unknown as Record<string, unknown>)[path],
      );
      out.push({
        label: `mqtt-request:${entity.uid} (update)`,
        batch: payload.batch,
        sideEffects: payload.sideEffects,
      });
    }
    if (removedKeys.length > 0) {
      const bodies: MutationBody[] = removedKeys.map((key) => ({
        kind: 'unsetField',
        type: MQTT_REQUEST_ENTITY_TYPE,
        id: entity.uid,
        path: key,
      }));
      out.push(bodiesBatch(`mqtt-request:${entity.uid} (unset)`, bodies, deps.nextCtx()));
    }
  }
}

// ── Path moves (directory renames) ──────────────────────────────────

interface MoveFamily {
  entityType: string;
  nextItems: readonly { uid: string; path: string }[];
  prevItems: readonly { uid: string; path: string }[];
}

/** A tree leaf family whose parent slot follows a directory move. */
interface LeafMoveFamily<C extends string, F extends string> extends MoveFamily {
  child: ChildMutators<TreeParentRef<C, F>>;
  itemsPath: string;
  prevTree: TreePlacer<C, F>;
  nextTree: TreePlacer<C, F>;
}

/**
 * A directory rename changes every resident entity's `path` while the
 * uids inside the manifests stay put. Top-level families (specs,
 * workflows, variables, collections) have no parent slot: a single
 * `setField('path')` converges them. A tree LEAF is linked by its
 * parent's `items` slot and its path is a projection of that slot, so
 * a move across parents lands as one atomic slot transfer — old parent
 * tombstone + new parent slot at the position the destination's
 * `order:` assigned it, else after the live tail — with the stored path
 * written alongside as the net for slot-less readers. A move that keeps
 * the parent (a renamed ancestor cascading down) is a path write only.
 *
 * A FOLDER moved across parents is the same slot transfer on the
 * parents' `folders` sets; its path is a pure projection (nothing
 * stored), and every leaf and example beneath it re-projects from the
 * new slot — nothing else to emit. The parent comes from the
 * destination path through the shared resolver (exact container match,
 * then the path's own uid tail).
 */
function emitPathMoves(
  out: EmissionBatch[],
  prev: WorkspaceTreeState,
  next: TreeReadResult['state'],
  touched: (entityPath: string) => boolean,
  tail: TailTracker,
  deps: ImportEmissionDeps,
): void {
  const toLocalFolders = (folders: readonly Folder[]): LocalFolder[] => folders as unknown as LocalFolder[];
  const prevRuleTree = createTreePlacer(FOLDER_TREE_KINDS, prev.collections, [], toLocalFolders(prev.folders), []);
  const nextRuleTree = createTreePlacer(FOLDER_TREE_KINDS, next.collections, [], toLocalFolders(next.folders), []);
  const prevRequestTree = createTreePlacer(
    REQUEST_FOLDER_TREE_KINDS,
    prev.requestCollections,
    [],
    toLocalFolders(prev.requestFolders),
    [],
  );
  const nextRequestTree = createTreePlacer(
    REQUEST_FOLDER_TREE_KINDS,
    next.requestCollections,
    [],
    toLocalFolders(next.requestFolders),
    [],
  );
  const prevTemplateTree = createTreePlacer(
    TEMPLATE_FOLDER_TREE_KINDS,
    prev.templateCollections,
    [],
    toLocalFolders(prev.templateFolders),
    [],
  );
  const nextTemplateTree = createTreePlacer(
    TEMPLATE_FOLDER_TREE_KINDS,
    next.templateCollections,
    [],
    toLocalFolders(next.templateFolders),
    [],
  );
  const requestLeaf = <T extends { uid: string; path: string }>(
    entityType: string,
    child: ChildMutators<RequestFolderParentRef>,
    nextItems: readonly T[],
    prevItems: readonly T[],
  ): LeafMoveFamily<typeof REQUEST_COLLECTION_ENTITY_TYPE, typeof REQUEST_FOLDER_ENTITY_TYPE> => ({
    entityType,
    child,
    itemsPath: REQUEST_FOLDER_ITEMS_PATH,
    prevTree: prevRequestTree,
    nextTree: nextRequestTree,
    nextItems,
    prevItems,
  });
  emitLeafMoves(
    out,
    {
      entityType: RULE_ENTITY_TYPE,
      child: ruleChild,
      itemsPath: FOLDER_ITEMS_PATH,
      prevTree: prevRuleTree,
      nextTree: nextRuleTree,
      nextItems: next.rules,
      prevItems: prev.rules,
    },
    touched,
    tail,
    deps,
  );
  emitLeafMoves(out, requestLeaf(REQUEST_ENTITY_TYPE, requestChild, next.requests, prev.requests), touched, tail, deps);
  emitLeafMoves(
    out,
    requestLeaf(GRPC_REQUEST_ENTITY_TYPE, grpcRequestChild, next.grpcRequests, prev.grpcRequests),
    touched,
    tail,
    deps,
  );
  emitLeafMoves(
    out,
    requestLeaf(WEBSOCKET_REQUEST_ENTITY_TYPE, webSocketRequestChild, next.websocketRequests, prev.websocketRequests),
    touched,
    tail,
    deps,
  );
  emitLeafMoves(
    out,
    requestLeaf(MQTT_REQUEST_ENTITY_TYPE, mqttRequestChild, next.mqttRequests, prev.mqttRequests),
    touched,
    tail,
    deps,
  );
  emitLeafMoves(
    out,
    {
      entityType: TEMPLATE_ENTITY_TYPE,
      child: templateChild,
      itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
      prevTree: prevTemplateTree,
      nextTree: nextTemplateTree,
      nextItems: next.templates,
      prevItems: prev.templates,
    },
    touched,
    tail,
    deps,
  );

  const topLevelFamilies: MoveFamily[] = [
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
  for (const family of topLevelFamilies) {
    const prevByUid = byUid(family.prevItems);
    for (const entity of family.nextItems) {
      if (!touched(entity.path)) continue;
      const prevEntity = prevByUid.get(entity.uid);
      if (!prevEntity || prevEntity.path === entity.path) continue;
      out.push(
        bodiesBatch(
          `${family.entityType}:${entity.uid} (move)`,
          [pathWrite(family.entityType, entity)],
          deps.nextCtx(),
        ),
      );
    }
  }

  emitFolderMoves(
    out,
    {
      entityType: FOLDER_ENTITY_TYPE,
      child: folderChild,
      childrenPath: FOLDER_CHILDREN_PATH,
      prevTree: prevRuleTree,
      nextTree: nextRuleTree,
      nextItems: next.folders,
      prevItems: prev.folders,
    },
    touched,
    tail,
    deps,
  );
  emitFolderMoves(
    out,
    {
      entityType: REQUEST_FOLDER_ENTITY_TYPE,
      child: requestFolderChild,
      childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
      prevTree: prevRequestTree,
      nextTree: nextRequestTree,
      nextItems: next.requestFolders,
      prevItems: prev.requestFolders,
    },
    touched,
    tail,
    deps,
  );
  emitFolderMoves(
    out,
    {
      entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
      child: templateFolderChild,
      childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
      prevTree: prevTemplateTree,
      nextTree: nextTemplateTree,
      nextItems: next.templateFolders,
      prevItems: prev.templateFolders,
    },
    touched,
    tail,
    deps,
  );
}

function pathWrite(entityType: string, entity: { uid: string; path: string }): MutationBody {
  return { kind: 'setField', type: entityType, id: entity.uid, path: 'path', value: entity.path };
}

function emitLeafMoves<C extends string, F extends string>(
  out: EmissionBatch[],
  family: LeafMoveFamily<C, F>,
  touched: (entityPath: string) => boolean,
  tail: TailTracker,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(family.prevItems);
  for (const entity of family.nextItems) {
    if (!touched(entity.path)) continue;
    const prevEntity = prevByUid.get(entity.uid);
    if (!prevEntity || prevEntity.path === entity.path) continue;
    const oldParent = family.prevTree.parentOf(prevEntity.path);
    const newParent = family.nextTree.parentOf(entity.path);
    const bodies: MutationBody[] = [];
    if (oldParent && newParent && (oldParent.type !== newParent.type || oldParent.uid !== newParent.uid)) {
      bodies.push(
        family.child.slotRemove(entity.uid, oldParent),
        family.child.slotAdd(entity.uid, newParent, tail(newParent, family.itemsPath, entity.uid)),
      );
    }
    bodies.push(pathWrite(family.entityType, entity));
    out.push(bodiesBatch(`${family.entityType}:${entity.uid} (move)`, bodies, deps.nextCtx()));
  }
}

/** A folder family whose parent slot follows a directory move. */
interface FolderMoveFamily<C extends string, F extends string> extends MoveFamily {
  child: ChildMutators<TreeParentRef<C, F>>;
  childrenPath: string;
  prevTree: TreePlacer<C, F>;
  nextTree: TreePlacer<C, F>;
}

function emitFolderMoves<C extends string, F extends string>(
  out: EmissionBatch[],
  family: FolderMoveFamily<C, F>,
  touched: (entityPath: string) => boolean,
  tail: TailTracker,
  deps: ImportEmissionDeps,
): void {
  const prevByUid = byUid(family.prevItems);
  for (const folder of family.nextItems) {
    if (!touched(folder.path)) continue;
    const prevFolder = prevByUid.get(folder.uid);
    if (!prevFolder || prevFolder.path === folder.path) continue;
    const oldParent = family.prevTree.parentOf(prevFolder.path);
    const newParent = family.nextTree.parentOf(folder.path);
    const crossed = oldParent && newParent && (oldParent.type !== newParent.type || oldParent.uid !== newParent.uid);
    const bodies: MutationBody[] = crossed
      ? [
          family.child.slotRemove(folder.uid, oldParent),
          family.child.slotAdd(folder.uid, newParent, tail(newParent, family.childrenPath, folder.uid)),
        ]
      : [pathWrite(family.entityType, folder)];
    out.push(bodiesBatch(`${family.entityType}:${folder.uid} (move)`, bodies, deps.nextCtx()));
  }
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

  // A vanished leaf tombstones its parent slot too, unless the parent
  // container vanished with it — then the parent's own tombstone covers
  // the slot and the bare entity tombstone suffices (the same rule the
  // folder deletions below apply).
  const containerVanished = (containers: readonly Collection[], folders: readonly Folder[]): ReadonlySet<string> => {
    const gone = new Set<string>();
    for (const collection of containers) {
      if (!nextUids.has(collection.uid) && removedPaths.has(`${collection.path}/_collection.yaml`))
        gone.add(collection.uid);
    }
    for (const folder of folders) {
      if (!nextUids.has(folder.uid) && removedPaths.has(`${folder.path}/_folder.yaml`)) gone.add(folder.uid);
    }
    return gone;
  };
  const ruleLeafParent = leafParentResolver(
    createTreePlacer(FOLDER_TREE_KINDS, prev.collections, [], prev.folders as unknown as LocalFolder[], []),
    containerVanished(prev.collections, prev.folders),
  );
  const requestLeafParent = leafParentResolver(
    createTreePlacer(
      REQUEST_FOLDER_TREE_KINDS,
      prev.requestCollections,
      [],
      prev.requestFolders as unknown as LocalFolder[],
      [],
    ),
    containerVanished(prev.requestCollections, prev.requestFolders),
  );
  const templateLeafParent = leafParentResolver(
    createTreePlacer(
      TEMPLATE_FOLDER_TREE_KINDS,
      prev.templateCollections,
      [],
      prev.templateFolders as unknown as LocalFolder[],
      [],
    ),
    containerVanished(prev.templateCollections, prev.templateFolders),
  );

  for (const rule of vanished(prev.rules, RULE_ENTITY_TYPE)) {
    const parent = ruleLeafParent(rule.path);
    push(
      `rule:${rule.uid} (delete)`,
      parent
        ? buildDeleteRuleBatch(rule.uid, parent, deps.nextCtx())
        : buildDeleteRuleEntityBatch(rule.uid, deps.nextCtx()),
    );
  }
  for (const request of vanished(prev.requests, REQUEST_ENTITY_TYPE)) {
    const parent = requestLeafParent(request.path);
    push(
      `request:${request.uid} (delete)`,
      parent
        ? buildDeleteRequestBatch(request.uid, parent, deps.nextCtx())
        : buildDeleteRequestEntityBatch(request.uid, deps.nextCtx()),
    );
  }
  for (const grpcRequest of vanished(prev.grpcRequests, GRPC_REQUEST_ENTITY_TYPE)) {
    const parent = requestLeafParent(grpcRequest.path);
    push(
      `grpc-request:${grpcRequest.uid} (delete)`,
      parent
        ? buildGrpcDeleteBatch(grpcRequest.uid, parent, deps.nextCtx())
        : buildGrpcDeleteEntityBatch(grpcRequest.uid, deps.nextCtx()),
    );
  }
  for (const websocketRequest of vanished(prev.websocketRequests, WEBSOCKET_REQUEST_ENTITY_TYPE)) {
    const parent = requestLeafParent(websocketRequest.path);
    push(
      `websocket-request:${websocketRequest.uid} (delete)`,
      parent
        ? buildWebSocketDeleteBatch(websocketRequest.uid, parent, deps.nextCtx())
        : buildWebSocketDeleteEntityBatch(websocketRequest.uid, deps.nextCtx()),
    );
  }
  for (const mqttRequest of vanished(prev.mqttRequests, MQTT_REQUEST_ENTITY_TYPE)) {
    const parent = requestLeafParent(mqttRequest.path);
    push(
      `mqtt-request:${mqttRequest.uid} (delete)`,
      parent
        ? buildMqttDeleteBatch(mqttRequest.uid, parent, deps.nextCtx())
        : buildMqttDeleteEntityBatch(mqttRequest.uid, deps.nextCtx()),
    );
  }
  for (const template of vanished(prev.templates, TEMPLATE_ENTITY_TYPE)) {
    const parent = templateLeafParent(template.path);
    push(
      `template:${template.uid} (delete)`,
      parent
        ? buildDeleteTemplateBatch(template.uid, parent, deps.nextCtx())
        : buildDeleteTemplateEntityBatch(template.uid, deps.nextCtx()),
    );
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

/** The live parent of a vanished leaf, or `null` when the parent vanished with it. */
function leafParentResolver<C extends string, F extends string>(
  tree: TreePlacer<C, F>,
  vanishedContainers: ReadonlySet<string>,
): (entityPath: string) => TreeParentRef<C, F> | null {
  return (entityPath) => {
    const parent = tree.parentOf(entityPath);
    return parent && !vanishedContainers.has(parent.uid) ? parent : null;
  };
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

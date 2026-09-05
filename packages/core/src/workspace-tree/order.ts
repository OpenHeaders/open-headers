/**
 * `order:` stamping — the engine's live containment sets projected onto
 * a tree snapshot as directory-name lists (the tree containment plan,
 * Disk; the sync-engine design §23.5).
 *
 * The parent's ordered sets are the one containment authority; the
 * persisted entity arrays never carry `order`, and array position is
 * not a valid source (the four request kinds persist as four arrays,
 * so cross-kind order lives only in the set). The binding host reads
 * the sets off its oracle and stamps every container before planning:
 * the `folders` and `items` sets MERGED by key — folders and leaves
 * interleaved as they render — on `_collection.yaml` / `_folder.yaml`,
 * and the roots' collection segments per tree on `workspace.yaml`. A container with no children carries no key. The
 * key is emitted whenever there are children — an omitted key reads as
 * "keep the engine's order" on the other side, so omitting it when the
 * order happens to be alphabetical would never converge a peer that
 * dragged back to alphabetical.
 *
 * Pure: the snapshot in, a snapshot with `order` stamped out. Nothing
 * here is persisted — the stamp lives only on the plan input.
 */

import {
  FOLDER_CHILDREN_PATH,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  mergeOrderedEntries,
  type ParentRefShape,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_FOLDER_TREE_KINDS,
  type TreeParentKinds,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
} from '../sync';
import type { Collection, Folder } from '../types/collection';
import { type TreeOrderRecord, treeContainerKey, treeOrderChildren } from '../types/tree-order';
import type { WorkspaceManifest, WorkspaceOrder } from '../types/workspace';
import { lastPathSegment } from '../utils/workspace';
import type { WorkspaceTreeState } from './types';

/** One live slot: the child uid and its fractional key. */
export interface TreeSlotEntry {
  uid: string;
  orderKey: string;
}

/** Live slots at a parent's ordered set, in slot order. */
export type TreeSlotReader = (parent: ParentRefShape, setPath: string) => ReadonlyArray<TreeSlotEntry>;

interface TreeOrderSpec {
  kinds: TreeParentKinds<string, string>;
  childrenPath: string;
  itemsPath: string;
  rootsPath: string;
}

const RULE_TREE: TreeOrderSpec = {
  kinds: FOLDER_TREE_KINDS,
  childrenPath: FOLDER_CHILDREN_PATH,
  itemsPath: FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
};

const REQUEST_TREE: TreeOrderSpec = {
  kinds: REQUEST_FOLDER_TREE_KINDS,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  itemsPath: REQUEST_FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
};

const TEMPLATE_TREE: TreeOrderSpec = {
  kinds: TEMPLATE_FOLDER_TREE_KINDS,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
};

/** Stamp `order` on every container and the manifest from the live sets. */
export function applyTreeOrder(state: WorkspaceTreeState, slots: TreeSlotReader): WorkspaceTreeState {
  const segmentOf = indexSegments(
    state.collections,
    state.folders,
    state.rules,
    state.requestCollections,
    state.requestFolders,
    state.requests,
    state.grpcRequests,
    state.websocketRequests,
    state.mqttRequests,
    state.graphqlRequests,
    state.templateCollections,
    state.templateFolders,
    state.templates,
  );

  // A slot whose child is not in the snapshot (a dead slot the
  // reconciler has not healed yet) names no directory and is skipped.
  const names = (entries: ReadonlyArray<TreeSlotEntry>): string[] =>
    segmentsOf(
      entries.map((entry) => entry.uid),
      segmentOf,
    );

  const containers = <T extends Collection | Folder>(entities: T[], type: string, spec: TreeOrderSpec): T[] =>
    entities.map((entity) => {
      const parent = { type, uid: entity.uid };
      const merged = mergeOrderedEntries(
        slots(parent, spec.childrenPath),
        slots(parent, spec.itemsPath),
        (entry) => entry.orderKey,
        (entry) => entry.uid,
      );
      return withOrder(entity, names(merged));
    });

  return {
    ...state,
    workspace: withWorkspaceOrder(state.workspace, {
      rules: names(slots(WORKSPACE_ROOTS_REF, RULE_TREE.rootsPath)),
      requests: names(slots(WORKSPACE_ROOTS_REF, REQUEST_TREE.rootsPath)),
      templates: names(slots(WORKSPACE_ROOTS_REF, TEMPLATE_TREE.rootsPath)),
    }),
    collections: containers(state.collections, RULE_TREE.kinds.collectionType, RULE_TREE),
    folders: containers(state.folders, RULE_TREE.kinds.folderType, RULE_TREE),
    requestCollections: containers(state.requestCollections, REQUEST_TREE.kinds.collectionType, REQUEST_TREE),
    requestFolders: containers(state.requestFolders, REQUEST_TREE.kinds.folderType, REQUEST_TREE),
    templateCollections: containers(state.templateCollections, TEMPLATE_TREE.kinds.collectionType, TEMPLATE_TREE),
    templateFolders: containers(state.templateFolders, TEMPLATE_TREE.kinds.folderType, TEMPLATE_TREE),
  };
}

/** Child uid → directory segment over every entity of the snapshot; an entity without a path tail is absent. */
export function indexSegments(
  ...lists: ReadonlyArray<ReadonlyArray<{ uid: string; path: string }>>
): Map<string, string> {
  const segmentOf = new Map<string, string>();
  for (const entities of lists) {
    for (const entity of entities) {
      const segment = lastPathSegment(entity.path);
      if (segment !== null) segmentOf.set(entity.uid, segment);
    }
  }
  return segmentOf;
}

/** The directory segments of `uids` in order; a uid the index does not know names no directory and is skipped. */
export function segmentsOf(uids: ReadonlyArray<string>, segmentOf: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  for (const uid of uids) {
    const segment = segmentOf.get(uid);
    if (segment !== undefined) out.push(segment);
  }
  return out;
}

/**
 * A container's `order` from the persisted tree-order record instead of
 * the live sets — for a host that reads storage, not an oracle (the
 * export gatherer). The record's children that the index knows, in
 * record order; a container the record does not list gets no key.
 */
export function recordChildOrder(
  record: TreeOrderRecord,
  parent: ParentRefShape,
  segmentOf: ReadonlyMap<string, string>,
): string[] {
  const entry = record.containers[treeContainerKey(parent.type, parent.uid)];
  return entry ? segmentsOf(treeOrderChildren(entry), segmentOf) : [];
}

/** The entity with `order` stamped when there is one, and without the key when there is none. */
export function withOrder<T extends { order?: string[] }>(entity: T, order: string[]): T {
  const out = { ...entity };
  if (order.length > 0) out.order = order;
  else delete out.order;
  return out;
}

function withWorkspaceOrder<T extends WorkspaceManifest>(workspace: T, order: Required<WorkspaceOrder>): T {
  const out = { ...workspace };
  const stamped: WorkspaceOrder = {
    ...(order.rules.length > 0 ? { rules: order.rules } : {}),
    ...(order.requests.length > 0 ? { requests: order.requests } : {}),
    ...(order.templates.length > 0 ? { templates: order.templates } : {}),
  };
  if (Object.keys(stamped).length > 0) out.order = stamped;
  else delete out.order;
  return out;
}

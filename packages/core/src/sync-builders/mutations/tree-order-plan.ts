/**
 * Every order a tree-authored source speaks for, as slot-order targets:
 * a touched container with an `order:` (one merged sequence over its
 * `folders` and `items` sets — each named directory tagged with the set
 * it holds a slot in), and the roots set of each tree a workspace-level
 * order lists. The desired sequence is the listed directories in listed
 * order, then the unlisted ones in name order; names with no directory
 * are ignored. Shared by the git delta (a touched manifest) and the
 * workspace import (an exported collection or folder carrying the
 * sender's order) — one planner, so a container converges the same way
 * whichever way its order arrived.
 */

import {
  FOLDER_CHILDREN_PATH,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
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
} from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { lastPathSegment, parentPathOf } from '@openheaders/core/utils';
import { planSlotOrder, type SlotOrderMember, type SlotOrderPlan, type SlotOrderTarget } from './tree-slot-order';
import type { LiveSetEntriesReader } from './workspace-import-emission';

/** One tree's containers and leaves as they will stand, plus the workspace-level collection order when one was authored. */
export interface TreeOrderFamilyInput {
  collections: readonly Collection[];
  folders: readonly Folder[];
  leaves: ReadonlyArray<{ uid: string; path: string }>;
  rootOrder?: readonly string[];
}

export interface TreeOrderInput {
  rules: TreeOrderFamilyInput;
  requests: TreeOrderFamilyInput;
  templates: TreeOrderFamilyInput;
}

interface TreeOrderFamily extends TreeOrderFamilyInput {
  kinds: TreeParentKinds<string, string>;
  childrenPath: string;
  itemsPath: string;
  rootsPath: string;
}

export function planTreeOrder(
  input: TreeOrderInput,
  touched: (entityPath: string) => boolean,
  live: LiveSetEntriesReader,
): SlotOrderPlan {
  const families: TreeOrderFamily[] = [
    {
      ...input.rules,
      kinds: FOLDER_TREE_KINDS,
      childrenPath: FOLDER_CHILDREN_PATH,
      itemsPath: FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
    },
    {
      ...input.requests,
      kinds: REQUEST_FOLDER_TREE_KINDS,
      childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
      itemsPath: REQUEST_FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
    },
    {
      ...input.templates,
      kinds: TEMPLATE_FOLDER_TREE_KINDS,
      childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
      rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
    },
  ];
  const targets: SlotOrderTarget[] = [];
  for (const family of families) {
    const collectionsByParent = childrenByParent(family.collections);
    const foldersByParent = childrenByParent(family.folders);
    const leavesByParent = childrenByParent(family.leaves);
    const container = (type: string, entity: Collection | Folder): void => {
      if (!touched(entity.path) || entity.order === undefined) return;
      const children: ChildDirectory[] = [
        ...(foldersByParent.get(entity.path) ?? []).map((child) => ({ ...child, setPath: family.childrenPath })),
        ...(leavesByParent.get(entity.path) ?? []).map((child) => ({ ...child, setPath: family.itemsPath })),
      ];
      targets.push({ parent: { type, uid: entity.uid }, members: inListedOrder(children, entity.order) });
    };
    for (const collection of family.collections) container(family.kinds.collectionType, collection);
    for (const folder of family.folders) container(family.kinds.folderType, folder);
    if (family.rootOrder !== undefined) {
      const roots = (collectionsByParent.get(family.kinds.treePrefix) ?? []).map((child) => ({
        ...child,
        setPath: family.rootsPath,
      }));
      targets.push({ parent: WORKSPACE_ROOTS_REF, members: inListedOrder(roots, family.rootOrder) });
    }
  }
  return planSlotOrder(targets, live);
}

interface ChildDirectory {
  uid: string;
  segment: string;
  /** The parent set this directory's slot lives in. */
  setPath: string;
}

type ChildEntry = Omit<ChildDirectory, 'setPath'>;

function childrenByParent(entities: ReadonlyArray<{ uid: string; path: string }>): Map<string, ChildEntry[]> {
  const out = new Map<string, ChildEntry[]>();
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

/** Listed directories in listed order, then the unlisted ones by name — folders and leaves in one sequence. */
function inListedOrder(children: readonly ChildDirectory[], order: readonly string[]): SlotOrderMember[] {
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
    .map((child) => ({ uid: child.uid, setPath: child.setPath }));
}

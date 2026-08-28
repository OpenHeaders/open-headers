import type * as v from 'valibot';
import type {
  LegacyTreeContainerOrderSchema,
  TreeContainerChildrenSchema,
  TreeContainerOrderSchema,
  TreeOrderRecordSchema,
} from '../schemas/tree-order';

export type TreeContainerChildren = v.InferOutput<typeof TreeContainerChildrenSchema>;
export type LegacyTreeContainerOrder = v.InferOutput<typeof LegacyTreeContainerOrderSchema>;
export type TreeContainerOrder = v.InferOutput<typeof TreeContainerOrderSchema>;
export type TreeOrderRecord = v.InferOutput<typeof TreeOrderRecordSchema>;

export const EMPTY_TREE_ORDER: TreeOrderRecord = { schemaVersion: 5, containers: {} };

/** The record key of a container: its entity type and uid. */
export function treeContainerKey(type: string, uid: string): string {
  return `${type}:${uid}`;
}

/** Whether a container's entry is the merged shape; the legacy pair of runs reads `false`. */
export function isMergedTreeOrder(entry: TreeContainerOrder): entry is TreeContainerChildren {
  return 'children' in entry;
}

/**
 * The child uids an entry lists, in order: the merged list as stored,
 * or — for a legacy entry — its folders then its items, which is
 * exactly the order those containers rendered in.
 */
export function treeOrderChildren(entry: TreeContainerOrder): readonly string[] {
  return isMergedTreeOrder(entry) ? entry.children : [...entry.folders, ...entry.items];
}

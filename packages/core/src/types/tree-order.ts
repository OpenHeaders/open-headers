import type * as v from 'valibot';
import type { TreeContainerOrderSchema, TreeOrderRecordSchema } from '../schemas/tree-order';

export type TreeContainerOrder = v.InferOutput<typeof TreeContainerOrderSchema>;
export type TreeOrderRecord = v.InferOutput<typeof TreeOrderRecordSchema>;

export const EMPTY_TREE_ORDER: TreeOrderRecord = { schemaVersion: 5, containers: {} };

/** The record key of a container: its entity type and uid. */
export function treeContainerKey(type: string, uid: string): string {
  return `${type}:${uid}`;
}

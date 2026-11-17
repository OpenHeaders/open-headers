/**
 * The order a tree states — what a container's manifest says of the
 * order of what it holds, read with the tree it stands in.
 *
 * A manifest carries `order:` only where there is something to order
 * (`withOrder`), so a missing key says one of two things and the tree
 * tells them apart: a container that holds no child there states the
 * empty order; one that holds children and lists none states no order
 * at all — no opinion, the engine's stands (`tree-order-plan.ts`).
 *
 * One change laid over the branch's order follows from that
 * (`patchStatedOrder`): entry by entry wherever the places state a
 * list, and a place that states none has nothing to set against the
 * other two.
 */

import { parentPathOf } from '../utils/workspace';
import { type PatchKeep, type PatchTally, patchRecord } from './three-way-patch';
import type { TreeReadResult } from './types';

/** A container's order as its manifest states it; `null` where it holds children and lists none. */
export type StatedOrder = readonly string[] | null;

interface OrderedContainer {
  path: string;
  order?: string[];
}

export type StatedOrderReader = (container: OrderedContainer) => StatedOrder;

/** What `tree` states of the order of each container it holds. */
export function readStatedOrder(tree: TreeReadResult['state']): StatedOrderReader {
  const occupied = new Set<string>();
  const residents: ReadonlyArray<ReadonlyArray<{ path: string }>> = [
    tree.folders,
    tree.requestFolders,
    tree.templateFolders,
    tree.rules,
    tree.requests,
    tree.grpcRequests,
    tree.websocketRequests,
    tree.mqttRequests,
    tree.graphqlRequests,
    tree.templates,
  ];
  for (const family of residents) {
    for (const entity of family) {
      const parent = parentPathOf(entity.path);
      if (parent !== null) occupied.add(parent);
    }
  }
  return (container) => container.order ?? (occupied.has(container.path) ? null : []);
}

const NO_SKIP: ReadonlySet<string> = new Set();

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((name, index) => name === b[index]);

/**
 * The branch's order with one change (`from` → `to`) laid over it, as
 * a manifest carries it — empty where it carries none.
 *
 * The start is the list its manifest carries, empty where it carries
 * none. A change that ends stating none, or the order it started from,
 * says nothing of the order: the branch's stands. A branch that states
 * none has no order of its own to keep: the change's stands. Otherwise
 * the two are lists and the change is laid entry by entry
 * (`three-way-patch.ts`).
 */
export function patchStatedOrder(
  current: StatedOrder,
  from: readonly string[] | undefined,
  to: StatedOrder,
  tally: PatchTally,
  keep: PatchKeep,
): string[] {
  const start = from ?? [];
  if (to === null || sameOrder(start, to)) return [...(current ?? [])];
  if (current === null) return [...to];
  return patchRecord({ order: [...current] }, { order: [...start] }, { order: [...to] }, NO_SKIP, tally, keep).order;
}

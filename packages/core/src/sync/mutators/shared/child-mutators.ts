/**
 * Shared child-mutator factory — the one containment verb set.
 *
 * Every tree child (collection under the workspace roots, folder under
 * a collection or folder, leaf under a collection or folder) is linked
 * and ordered by ONE authority: the parent's ordered set of slot
 * markers at a fixed path. A child's `path` is a projection of that
 * linkage, never written by a move.
 *
 *   - `create`  = entity create + `addToSet` slot on the parent
 *   - `delete`  = `removeFromSet` slot tombstone + entity tombstone
 *   - `move`    = same-parent `moveBefore` | atomic remove + add reparent
 *
 * The slot shape is the binding's business: folders and collections
 * mark `{ uid }`, leaves mark `{ uid, type }` because one `items` set
 * holds several leaf kinds (a request parent carries the four request
 * kinds). Per-batch all-or-nothing at the local oracle (§11.2) keeps
 * observers from seeing the half-and-half intermediate state on
 * lifecycle and reparent batches.
 *
 * Seed builders that mint a create with per-row `addToSet` members
 * reach for `slotAdd` / `slotRemove` directly so the slot rides the
 * same batch as the entity create — the law is "one batch, entity +
 * slot", not "one factory".
 */

import type { AddToSetMutation, MutationBatch, MutationBody, RemoveFromSetMutation } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';

export interface ParentRefShape {
  type: string;
  uid: string;
}

/** Every slot marker records at least the child's uid. */
export interface ChildSlotShape {
  uid: string;
}

/**
 * Where a created child lands: its parent and, optionally, a
 * pre-computed fractional-indexing key (callers derive it from the
 * parent's live tail via `keyBetween(tail, null)`; absent = seed key).
 */
export interface ChildPlacement<P extends ParentRefShape> {
  parent: P;
  orderKey?: string;
}

export interface ChildMutatorBindings<S extends ChildSlotShape> {
  entityType: string;
  /** Set path on the parent holding this child kind's slots. */
  childrenPath: string;
  /** Slot marker minted for a child uid. */
  slot: (childUid: string) => S;
  mintBatch: (ctx: MutatorContext, bodies: MutationBody[]) => MutationBatch;
}

export interface CreateChildInput<P extends ParentRefShape> {
  childUid: string;
  parent: P;
  payload: unknown;
  orderKey?: string;
}

export interface DeleteChildInput<P extends ParentRefShape> {
  childUid: string;
  parent: P;
}

export interface MoveChildInput<P extends ParentRefShape> {
  childUid: string;
  newParent: P;
  /** Fractional-indexing key for the new slot position. Required —
   *  callers derive it from their live mirror via `keyBetween(prev, next)`. */
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: P;
}

export interface ChildMutators<P extends ParentRefShape> {
  slotAdd(childUid: string, parent: P, orderKey?: string): AddToSetMutation;
  slotRemove(childUid: string, parent: P): RemoveFromSetMutation;
  create(ctx: MutatorContext, input: CreateChildInput<P>): MutatorIntent;
  delete(ctx: MutatorContext, input: DeleteChildInput<P>): MutatorIntent;
  /** Sibling reorder + reparent. LWW per (setPath, itemId) for same-parent;
   *  per-batch all-or-nothing for cross-parent. */
  move(ctx: MutatorContext, input: MoveChildInput<P>): MutatorIntent;
}

export function makeChildMutators<P extends ParentRefShape, S extends ChildSlotShape>(
  bindings: ChildMutatorBindings<S>,
): ChildMutators<P> {
  const { entityType, childrenPath, slot, mintBatch } = bindings;

  const slotAdd = (childUid: string, parent: P, orderKey?: string): AddToSetMutation => ({
    kind: 'addToSet',
    type: parent.type,
    id: parent.uid,
    path: childrenPath,
    itemId: childUid,
    item: slot(childUid),
    orderKey,
  });

  const slotRemove = (childUid: string, parent: P): RemoveFromSetMutation => ({
    kind: 'removeFromSet',
    type: parent.type,
    id: parent.uid,
    path: childrenPath,
    itemId: childUid,
  });

  return {
    slotAdd,
    slotRemove,
    create(ctx, input) {
      const bodies: MutationBody[] = [
        { kind: 'create', type: entityType, id: input.childUid, payload: input.payload },
        slotAdd(input.childUid, input.parent, input.orderKey),
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
    delete(ctx, input) {
      const bodies: MutationBody[] = [
        slotRemove(input.childUid, input.parent),
        { kind: 'delete', type: entityType, id: input.childUid },
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
    move(ctx, input) {
      const sameParent =
        !input.oldParent ||
        (input.oldParent.type === input.newParent.type && input.oldParent.uid === input.newParent.uid);

      if (sameParent) {
        return {
          batch: mintBatch(ctx, [
            {
              kind: 'moveBefore',
              type: input.newParent.type,
              id: input.newParent.uid,
              path: childrenPath,
              itemId: input.childUid,
              orderKey: input.orderKey,
            },
          ]),
          sideEffects: [],
        };
      }

      const oldParent = input.oldParent as P;
      const bodies: MutationBody[] = [
        slotRemove(input.childUid, oldParent),
        slotAdd(input.childUid, input.newParent, input.orderKey),
      ];
      return { batch: mintBatch(ctx, bodies), sideEffects: [] };
    },
  };
}

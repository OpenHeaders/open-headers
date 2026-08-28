/**
 * `createRule` + `deleteRule` + `moveRule` — rule entity lifecycle as
 * a tree child. Thin adapters over the shared child-mutator factory
 * bound to the rules tree: the parent (collection or folder) owns the
 * rule's slot in its `items` set; the rule's `path` is a projection of
 * that slot.
 *
 * Set-modeled paths (`conditions`, `action.requestHeaders`,
 * `action.responseHeaders`) are NOT pre-seeded by `createRule` — the
 * seed builder (`sync-builders/projections/rule-projection.ts`) splits
 * them into per-row `addToSet` envelopes and appends the parent slot
 * via {@link ruleChild.slotAdd} in the same batch. The catalog's
 * `create` is the whole-payload primitive for callers that already
 * hold the scalar shell.
 */

import { FOLDER_ITEMS_PATH, type FolderItemSlot, type FolderParentRef } from '../folder/types';
import { makeChildMutators } from '../shared/child-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { RULE_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the rules tree — seed builders
 *  and cascades reach for `slotAdd` / `slotRemove` here. */
export const ruleChild = makeChildMutators<FolderParentRef, FolderItemSlot>({
  entityType: RULE_ENTITY_TYPE,
  childrenPath: FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: RULE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateRuleArgs {
  ruleUid: string;
  parent: FolderParentRef;
  /** Scalar shell as `Rule` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createRule(ctx: MutatorContext, args: CreateRuleArgs): MutatorIntent {
  return ruleChild.create(ctx, {
    childUid: args.ruleUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteRuleArgs {
  ruleUid: string;
  parent: FolderParentRef;
}

export function deleteRule(ctx: MutatorContext, args: DeleteRuleArgs): MutatorIntent {
  return ruleChild.delete(ctx, { childUid: args.ruleUid, parent: args.parent });
}

export interface MoveRuleArgs {
  ruleUid: string;
  newParent: FolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: FolderParentRef;
}

export function moveRule(ctx: MutatorContext, args: MoveRuleArgs): MutatorIntent {
  return ruleChild.move(ctx, {
    childUid: args.ruleUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}

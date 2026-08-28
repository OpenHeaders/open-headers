/**
 * `createTemplate` + `deleteTemplate` + `moveTemplate` — template
 * entity lifecycle as a tree child. Thin adapters over the shared
 * child-mutator factory bound to the templates tree: the parent
 * (template collection or template folder) owns the template's slot in
 * its `items` set; the template's `path` is a projection of that slot.
 *
 * The set-modeled path (`conditions`) is NOT pre-seeded by
 * `createTemplate`. The seed builder (`template-projection.ts`)
 * flattens the create payload into per-leaf scalars + per-row
 * `addToSet` envelopes and appends the parent slot via
 * {@link templateChild.slotAdd} in the same batch.
 */

import { makeChildMutators } from '../shared/child-mutators';
import {
  TEMPLATE_FOLDER_ITEMS_PATH,
  type TemplateFolderItemSlot,
  type TemplateFolderParentRef,
} from '../template-folder/types';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { TEMPLATE_ENTITY_TYPE } from './types';

/** The generic child verbs bound to the templates tree. */
export const templateChild = makeChildMutators<TemplateFolderParentRef, TemplateFolderItemSlot>({
  entityType: TEMPLATE_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_ITEMS_PATH,
  slot: (uid) => ({ uid, type: TEMPLATE_ENTITY_TYPE }),
  mintBatch,
});

export interface CreateTemplateArgs {
  templateUid: string;
  parent: TemplateFolderParentRef;
  /**
   * Scalar shell as `Template` minus `uid` (carried on the envelope as
   * `id`). Validated at the oracle boundary by the template schema.
   */
  payload: unknown;
  orderKey?: string;
}

export function createTemplate(ctx: MutatorContext, args: CreateTemplateArgs): MutatorIntent {
  return templateChild.create(ctx, {
    childUid: args.templateUid,
    parent: args.parent,
    payload: args.payload,
    orderKey: args.orderKey,
  });
}

export interface DeleteTemplateArgs {
  templateUid: string;
  parent: TemplateFolderParentRef;
}

export function deleteTemplate(ctx: MutatorContext, args: DeleteTemplateArgs): MutatorIntent {
  return templateChild.delete(ctx, { childUid: args.templateUid, parent: args.parent });
}

export interface MoveTemplateArgs {
  templateUid: string;
  newParent: TemplateFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: TemplateFolderParentRef;
}

export function moveTemplate(ctx: MutatorContext, args: MoveTemplateArgs): MutatorIntent {
  return templateChild.move(ctx, {
    childUid: args.templateUid,
    newParent: args.newParent,
    orderKey: args.orderKey,
    oldParent: args.oldParent,
  });
}

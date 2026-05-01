/**
 * `moveTemplateFolder` — thin adapter over the shared folder-mutator
 * factory. See `shared/folder-mutators.ts` for the same-parent /
 * reparent invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from './types';

const factories = makeFolderMutators<TemplateFolderParentRef>({
  entityType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface MoveTemplateFolderArgs {
  folderUid: string;
  newParent: TemplateFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: TemplateFolderParentRef;
}

export function moveTemplateFolder(
  ctx: MutatorContext,
  args: MoveTemplateFolderArgs,
): MutatorIntent {
  return factories.moveFolder(ctx, args);
}

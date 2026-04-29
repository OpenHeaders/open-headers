/**
 * `createTemplateFolder` + `deleteTemplateFolder` — template-folder entity lifecycle.
 *
 * Mirrors the rule-side and request-side folder lifecycles: each is a
 * cross-entity batch touching the folder entity itself plus the
 * parent's child slot. The `pathSegment` is frozen at create time so a
 * rename never moves the filesystem-style slug; downstream templates
 * embed this segment in their `path` and would orphan if it shifted.
 *
 * Cascading template deletes when a folder is removed are NOT modelled
 * here — the SW-side `template-store` cascade emits per-template
 * `delete(template, ...)` envelopes minted by the template catalog.
 * Cross-entity orchestration stays outside the folder catalog.
 */

import { toFolderName } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
  type TemplateFolderSlot,
} from './types';

export interface CreateTemplateFolderArgs {
  folderUid: string;
  parent: TemplateFolderParentRef;
  name: string;
  /**
   * Stable last path segment for the folder's filesystem-style path.
   * Frozen at create time; defaults to `toFolderName(name, folderUid)`
   * when the caller omits it.
   */
  pathSegment?: string;
  /** Pre-computed fractional-indexing key for the new slot's position. */
  orderKey?: string;
}

export function createTemplateFolder(
  ctx: MutatorContext,
  args: CreateTemplateFolderArgs,
): MutatorIntent {
  const slot: TemplateFolderSlot = { uid: args.folderUid };
  const pathSegment = args.pathSegment ?? toFolderName(args.name, args.folderUid);
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: args.folderUid,
      payload: { schemaVersion: 5, name: args.name, pathSegment },
    },
    {
      kind: 'addToSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
      item: slot,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteTemplateFolderArgs {
  folderUid: string;
  parent: TemplateFolderParentRef;
}

export function deleteTemplateFolder(
  ctx: MutatorContext,
  args: DeleteTemplateFolderArgs,
): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: args.parent.type,
      id: args.parent.uid,
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
    },
    { kind: 'delete', type: TEMPLATE_FOLDER_ENTITY_TYPE, id: args.folderUid },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

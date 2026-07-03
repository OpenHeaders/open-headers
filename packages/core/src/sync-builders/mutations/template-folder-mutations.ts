/**
 * Template-folder write-site → oracle helpers.
 *
 * Mirrors `request-folder-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the template-folder cache + cascade deletes)
 * and the renderer (`useTemplateFolderMutator` write client).
 */

import {
  createTemplateFolder,
  deleteTemplateFolder,
  moveTemplateFolder,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  PRE_BOOTSTRAP_ORG_ID,
  newMutationId,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_MUTATOR_VERSION,
  type TemplateFolderParentRef,
  renameTemplateFolder,
} from '@openheaders/core/sync';

export type TemplateFolderMutationPayload = MutatorIntent;

/**
 * Build a bare template-folder-entity `delete` envelope. Used by
 * cross-entity cascades (template-collection / parent template-folder
 * delete cascades into descendant template-folders) where the parent
 * slot is already covered by the parent's tombstone — emitting a
 * `removeFromSet` against a tombstoned parent is wasted wire churn.
 */
export function buildDeleteTemplateFolderEntityBatch(
  folderUid: string,
  ctx: MutatorContext,
): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
        mutatorVersion: TEMPLATE_FOLDER_MUTATOR_VERSION,
        body: { kind: 'delete', type: TEMPLATE_FOLDER_ENTITY_TYPE, id: folderUid },
      },
    ],
  };
}

export interface RenameTemplateFolderInput {
  folderUid: string;
  name: string;
}

export function buildRenameTemplateFolderBatch(
  input: RenameTemplateFolderInput,
  ctx: MutatorContext,
): TemplateFolderMutationPayload {
  return renameTemplateFolder(ctx, input);
}

export interface CreateTemplateFolderInput {
  folderUid: string;
  parent: TemplateFolderParentRef;
  name: string;
  /** Optional override for the persisted last-segment slug. */
  pathSegment?: string;
  orderKey?: string;
}

export function buildCreateTemplateFolderBatch(
  input: CreateTemplateFolderInput,
  ctx: MutatorContext,
): TemplateFolderMutationPayload {
  return createTemplateFolder(ctx, input);
}

export interface DeleteTemplateFolderInput {
  folderUid: string;
  parent: TemplateFolderParentRef;
}

export function buildDeleteTemplateFolderBatch(
  input: DeleteTemplateFolderInput,
  ctx: MutatorContext,
): TemplateFolderMutationPayload {
  return deleteTemplateFolder(ctx, input);
}

export interface MoveTemplateFolderInput {
  folderUid: string;
  newParent: TemplateFolderParentRef;
  orderKey: string;
  oldParent?: TemplateFolderParentRef;
}

export function buildMoveTemplateFolderBatch(
  input: MoveTemplateFolderInput,
  ctx: MutatorContext,
): TemplateFolderMutationPayload {
  return moveTemplateFolder(ctx, input);
}

/**
 * Folder write-site → oracle helpers.
 *
 * Mirrors `collection-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the folder cache) and the renderer
 * (`useFolderMutator` write client).
 */

import {
  createFolder,
  deleteFolder,
  FOLDER_ENTITY_TYPE,
  FOLDER_MUTATOR_VERSION,
  type FolderParentRef,
  moveFolder,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  PRE_BOOTSTRAP_ORG_ID,
  newMutationId,
  renameFolder,
} from '@openheaders/core/sync';

export type FolderMutationPayload = MutatorIntent;

/**
 * Build a bare folder-entity `delete` envelope. Used by cross-entity
 * cascades (collection delete cascades into its descendant folders)
 * where the parent slot is already covered by the parent's tombstone
 * — emitting a `removeFromSet` against a tombstoned parent is wasted
 * wire churn. The catalog's full `deleteFolder` factory is the right
 * call when the parent is still live.
 */
export function buildDeleteFolderEntityBatch(folderUid: string, ctx: MutatorContext): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
        mutatorVersion: FOLDER_MUTATOR_VERSION,
        body: { kind: 'delete', type: FOLDER_ENTITY_TYPE, id: folderUid },
      },
    ],
  };
}

export interface RenameFolderInput {
  folderUid: string;
  name: string;
}

export function buildRenameFolderBatch(
  input: RenameFolderInput,
  ctx: MutatorContext,
): FolderMutationPayload {
  return renameFolder(ctx, input);
}

export interface CreateFolderInput {
  folderUid: string;
  parent: FolderParentRef;
  name: string;
  /** Optional override for the persisted last-segment slug. */
  pathSegment?: string;
  orderKey?: string;
}

export function buildCreateFolderBatch(
  input: CreateFolderInput,
  ctx: MutatorContext,
): FolderMutationPayload {
  return createFolder(ctx, input);
}

export interface DeleteFolderInput {
  folderUid: string;
  parent: FolderParentRef;
}

export function buildDeleteFolderBatch(
  input: DeleteFolderInput,
  ctx: MutatorContext,
): FolderMutationPayload {
  return deleteFolder(ctx, input);
}

export interface MoveFolderInput {
  folderUid: string;
  newParent: FolderParentRef;
  orderKey: string;
  oldParent?: FolderParentRef;
}

export function buildMoveFolderBatch(
  input: MoveFolderInput,
  ctx: MutatorContext,
): FolderMutationPayload {
  return moveFolder(ctx, input);
}

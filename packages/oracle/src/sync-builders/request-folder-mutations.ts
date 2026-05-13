/**
 * Request-folder write-site → oracle helpers.
 *
 * Mirrors `folder-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the request-folder cache + cascade deletes)
 * and the renderer (`useRequestFolderMutator` write client).
 */

import {
  createRequestFolder,
  deleteRequestFolder,
  moveRequestFolder,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_MUTATOR_VERSION,
  type RequestFolderParentRef,
  renameRequestFolder,
} from '@openheaders/core/sync';

export type RequestFolderMutationPayload = MutatorIntent;

/**
 * Build a bare request-folder-entity `delete` envelope. Used by
 * cross-entity cascades (request-collection / parent request-folder
 * delete cascades into descendant request-folders) where the parent
 * slot is already covered by the parent's tombstone — emitting a
 * `removeFromSet` against a tombstoned parent is wasted wire churn.
 */
export function buildDeleteRequestFolderEntityBatch(
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
        mutatorVersion: REQUEST_FOLDER_MUTATOR_VERSION,
        body: { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: folderUid },
      },
    ],
  };
}

export interface RenameRequestFolderInput {
  folderUid: string;
  name: string;
}

export function buildRenameRequestFolderBatch(
  input: RenameRequestFolderInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  return renameRequestFolder(ctx, input);
}

export interface CreateRequestFolderInput {
  folderUid: string;
  parent: RequestFolderParentRef;
  name: string;
  /** Optional override for the persisted last-segment slug. */
  pathSegment?: string;
  orderKey?: string;
}

export function buildCreateRequestFolderBatch(
  input: CreateRequestFolderInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  return createRequestFolder(ctx, input);
}

export interface DeleteRequestFolderInput {
  folderUid: string;
  parent: RequestFolderParentRef;
}

export function buildDeleteRequestFolderBatch(
  input: DeleteRequestFolderInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  return deleteRequestFolder(ctx, input);
}

export interface MoveRequestFolderInput {
  folderUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  oldParent?: RequestFolderParentRef;
}

export function buildMoveRequestFolderBatch(
  input: MoveRequestFolderInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  return moveRequestFolder(ctx, input);
}

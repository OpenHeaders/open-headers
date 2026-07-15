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
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  mintBatch,
  moveRequestFolder,
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_MUTATOR_VERSION,
  type RequestFolderParentRef,
  renameRequestFolder,
  setRequestFolderScripts,
} from '@openheaders/core/sync';
import { synthesizeFieldDiff } from '@openheaders/core/sync-builders';
import type { AuthConfig } from '@openheaders/core/types';

export type RequestFolderMutationPayload = MutatorIntent;

/**
 * Build a bare request-folder-entity `delete` envelope. Used by
 * cross-entity cascades (request-collection / parent request-folder
 * delete cascades into descendant request-folders) where the parent
 * slot is already covered by the parent's tombstone — emitting a
 * `removeFromSet` against a tombstoned parent is wasted wire churn.
 */
export function buildDeleteRequestFolderEntityBatch(folderUid: string, ctx: MutatorContext): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
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

export interface SetRequestFolderScriptsInput {
  folderUid: string;
  /** Slot updates; `value: undefined` removes the slot. */
  updates: ReadonlyArray<{ path: 'preRequestScript' | 'postResponseScript'; value: string | undefined }>;
}

export function buildSetRequestFolderScriptsBatch(
  input: SetRequestFolderScriptsInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  return setRequestFolderScripts(ctx, input);
}

export interface SetRequestFolderAuthInput {
  folderUid: string;
  /** New ancestor default auth; `undefined` clears the field (the
   *  level goes transparent — the inherit walk passes through it). */
  auth: AuthConfig | undefined;
  /** Current materialized auth — the per-leaf diff baseline. */
  currentAuth: AuthConfig | undefined;
}

/** See `buildSetRequestCollectionAuthBatch` — same per-leaf contract
 *  through {@link synthesizeFieldDiff}, request-folder entity type. */
export function buildSetRequestFolderAuthBatch(
  input: SetRequestFolderAuthInput,
  ctx: MutatorContext,
): RequestFolderMutationPayload {
  const bodies = synthesizeFieldDiff({
    type: REQUEST_FOLDER_ENTITY_TYPE,
    id: input.folderUid,
    basePath: 'auth',
    oldValue: input.currentAuth,
    newValue: input.auth,
  });
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
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

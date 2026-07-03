/**
 * Files write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (legacy store routing through the oracle after a BlobStore write)
 * and the renderer (`useFilesMutator` write client). Mirrors
 * `pause-markers-mutations.ts`.
 */

import {
  addFileRef,
  type FileRefSlot,
  type MutatorContext,
  type MutatorIntent,
  removeFileRef,
  renameFileRef,
} from '@openheaders/core/sync';

export type FilesMutationPayload = MutatorIntent;

export interface AddFileRefInput {
  ref: FileRefSlot;
}

export function buildAddFileRefBatch(input: AddFileRefInput, ctx: MutatorContext): FilesMutationPayload {
  return addFileRef(ctx, input);
}

export interface RenameFileRefInput {
  ref: FileRefSlot;
}

export function buildRenameFileRefBatch(input: RenameFileRefInput, ctx: MutatorContext): FilesMutationPayload {
  return renameFileRef(ctx, input);
}

export interface RemoveFileRefInput {
  fileId: string;
}

export function buildRemoveFileRefBatch(input: RemoveFileRefInput, ctx: MutatorContext): FilesMutationPayload {
  return removeFileRef(ctx, input);
}

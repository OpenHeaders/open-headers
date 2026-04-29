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
  type FolderParentRef,
  moveFolder,
  type MutatorContext,
  type MutatorIntent,
  renameFolder,
} from '@openheaders/core/sync';

export type FolderMutationPayload = MutatorIntent;

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

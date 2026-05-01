/**
 * Template-collection write-site → oracle helpers.
 *
 * Mirrors `request-collection-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration) and the renderer (variable write client).
 */

import {
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  removeTemplateCollectionVar,
  renameTemplateCollection,
  renameTemplateCollectionVar,
  setTemplateCollectionVar,
  setTemplateCollectionVarType,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_MUTATOR_VERSION,
  type VariableType,
} from '@openheaders/core/sync';

export type TemplateCollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a template collection. Generic primitive
 * — no dedicated catalog factory, identical shape across entities.
 */
export function buildDeleteTemplateCollectionBatch(
  collectionUid: string,
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
        mutatorVersion: TEMPLATE_COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: TEMPLATE_COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
}

export interface RenameTemplateCollectionInput {
  collectionUid: string;
  name: string;
}

export function buildRenameTemplateCollectionBatch(
  input: RenameTemplateCollectionInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return renameTemplateCollection(ctx, input);
}

export interface SetTemplateCollectionVarInput {
  templateCollectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildSetTemplateCollectionVarBatch(
  input: SetTemplateCollectionVarInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return setTemplateCollectionVar(ctx, input);
}

export interface RemoveTemplateCollectionVarInput {
  templateCollectionUid: string;
  name: string;
}

export function buildRemoveTemplateCollectionVarBatch(
  input: RemoveTemplateCollectionVarInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return removeTemplateCollectionVar(ctx, input);
}

export interface RenameTemplateCollectionVarInput {
  templateCollectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildRenameTemplateCollectionVarBatch(
  input: RenameTemplateCollectionVarInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return renameTemplateCollectionVar(ctx, input);
}

export interface SetTemplateCollectionVarTypeInput {
  templateCollectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export function buildSetTemplateCollectionVarTypeBatch(
  input: SetTemplateCollectionVarTypeInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return setTemplateCollectionVarType(ctx, input);
}

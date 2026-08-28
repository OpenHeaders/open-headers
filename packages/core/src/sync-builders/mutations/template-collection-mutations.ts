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
  deleteTemplateCollection,
  deriveSideEffectsForEnvelope,
  type MutatorContext,
  type MutatorIntent,
  removeTemplateCollectionVar,
  renameTemplateCollection,
  setTemplateCollectionPinnedAndDefault,
  setTemplateCollectionVar,
} from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';

export type TemplateCollectionMutationPayload = MutatorIntent;

/**
 * Delete a template collection: the workspace roots' slot tombstone +
 * the entity tombstone in one batch (the catalog's
 * `deleteTemplateCollection`).
 *
 * Deleting a template collection drops its variables from resolver
 * scope, so the payload carries the `INVALIDATE_RESOLVER` side effect —
 * single-sourced through {@link deriveSideEffectsForEnvelope} so the
 * deleting host's own resolver cache flushes, as a peer's does on
 * receive.
 */
export function buildDeleteTemplateCollectionBatch(
  collectionUid: string,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  const { batch } = deleteTemplateCollection(ctx, { collectionUid });
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
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

export interface SetTemplateCollectionPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function buildSetTemplateCollectionPinnedAndDefaultBatch(
  input: SetTemplateCollectionPinnedAndDefaultInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return setTemplateCollectionPinnedAndDefault(ctx, input);
}

export interface SetTemplateCollectionVarInput {
  templateCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
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
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveTemplateCollectionVarBatch(
  input: RemoveTemplateCollectionVarInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return removeTemplateCollectionVar(ctx, input);
}

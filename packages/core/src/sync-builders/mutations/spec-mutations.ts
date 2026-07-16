/**
 * Spec write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by the renderer
 * write client (and any future SW write site) to produce
 * `(batch, sideEffects)` pairs from the catalog factories. Scalar
 * metadata flows through per-key `setField` envelopes; the source-file
 * set flows through the upsert/remove pair. Side effects are always
 * empty — specs are design-time documents, not compiled into DNR or
 * the variable resolver.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type MutatorIntent,
  mintBatch,
  removeSpecFile,
  type SideEffectIntent,
  SPEC_ENTITY_TYPE,
  setSpecFile,
} from '@openheaders/core/sync';
import type { Spec, SpecFile } from '@openheaders/core/types';
import { seedSpec } from '../projections/spec-projection';

export interface SpecMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * New spec → seed batch (`create` for the scalar shell + one
 * `addToSet` per file, keyed by `file.uid`). Mirrors
 * `buildAddEnvironmentBatch`.
 */
export function buildAddSpecBatch(spec: Spec, ctx: MutatorContext): SpecMutationPayload {
  return { batch: seedSpec(spec, ctx), sideEffects: [] };
}

export function buildDeleteSpecBatch(specUid: string, ctx: MutatorContext): SpecMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: SPEC_ENTITY_TYPE, id: specUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Translate a `Partial<Omit<Spec, 'uid' | 'path' | 'files'>>` patch
 * into a single batch of per-leaf `setField` envelopes. Undefined
 * values skip. The file set never rides this path — use
 * `buildSetSpecFileBatch` / `buildRemoveSpecFileBatch`.
 */
export function buildUpdateSpecBatch(
  specUid: string,
  updates: Partial<Omit<Spec, 'uid' | 'path' | 'files'>>,
  ctx: MutatorContext,
): SpecMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: SPEC_ENTITY_TYPE,
      id: specUid,
      path: key,
      value,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface SetSpecFileInput {
  specUid: string;
  /** Whole file record. `file.uid` is the set-member itemId. */
  file: SpecFile;
  orderKey?: string;
}

export function buildSetSpecFileBatch(input: SetSpecFileInput, ctx: MutatorContext): MutatorIntent {
  return setSpecFile(ctx, input);
}

export interface RemoveSpecFileInput {
  specUid: string;
  /** The row's persisted uid — NOT its fileName. */
  uid: string;
}

export function buildRemoveSpecFileBatch(input: RemoveSpecFileInput, ctx: MutatorContext): MutatorIntent {
  return removeSpecFile(ctx, input);
}

/**
 * Environment write-site → oracle helpers.
 *
 * Mirrors `rule-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the env cache) and the renderer
 * (`useEnvironmentMutator` write client).
 *
 * Variable rows carry a stable `uid` that doubles as the sync engine's
 * itemId. `buildSetEnvVarBatch` upserts the whole record (covers add,
 * edit, rename, type-toggle uniformly); `buildRemoveEnvVarBatch` keys
 * by uid. Per-(setPath, uid) LWW handles convergence.
 */

import {
  deriveSideEffectsForEnvelope,
  ENVIRONMENT_ENTITY_TYPE,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type MutatorIntent,
  mintBatch,
  removeEnvVar,
  renameEnvironment,
  type SideEffectIntent,
  setEnvVar,
} from '@openheaders/core/sync';
import type { Environment, Variable } from '@openheaders/core/types';
import { seedEnvironment } from '../projections/env-projection';

export type EnvMutationPayload = MutatorIntent;

export interface SetEnvVarInput {
  envId: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  orderKey?: string;
}

export function buildSetEnvVarBatch(input: SetEnvVarInput, ctx: MutatorContext): EnvMutationPayload {
  return setEnvVar(ctx, input);
}

export interface RemoveEnvVarInput {
  envId: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveEnvVarBatch(input: RemoveEnvVarInput, ctx: MutatorContext): EnvMutationPayload {
  return removeEnvVar(ctx, input);
}

export interface RenameEnvironmentInput {
  envId: string;
  name: string;
}

export function buildRenameEnvironmentBatch(input: RenameEnvironmentInput, ctx: MutatorContext): EnvMutationPayload {
  return renameEnvironment(ctx, input);
}

/**
 * New environment → seed batch (`create` for the scalar shell + one
 * `addToSet` per variable, keyed by `variable.uid`) plus a single
 * `INVALIDATE_RESOLVER` side-effect so the runtime resolver picks up
 * the env on the SW side. Mirrors `buildAddBatch` in `rule-mutations.ts`.
 */
export interface AddEnvironmentInput {
  environment: Environment;
}

export interface EnvMutationBatchPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddEnvironmentBatch(input: AddEnvironmentInput, ctx: MutatorContext): EnvMutationBatchPayload {
  const batch = seedEnvironment(input.environment, ctx);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

export interface DeleteEnvironmentInput {
  envId: string;
}

/**
 * Delete an environment. Tombstone is permanent under §7.2 delete-wins.
 */
export function buildDeleteEnvironmentBatch(
  input: DeleteEnvironmentInput,
  ctx: MutatorContext,
): EnvMutationBatchPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: ENVIRONMENT_ENTITY_TYPE, id: input.envId }];
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

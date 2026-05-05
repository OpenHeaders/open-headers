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

import type { V5 } from '@openheaders/core/types';
type Variable = V5.Variable;
import {
  ENVIRONMENT_ENTITY_TYPE,
  mintBatch,
  type MutationBody,
  type MutatorContext,
  type MutatorIntent,
  removeEnvVar,
  renameEnvironment,
  setEnvVar,
} from '@openheaders/core/sync';
import { seedEnvironment } from './env-projection';

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

export function buildRenameEnvironmentBatch(
  input: RenameEnvironmentInput,
  ctx: MutatorContext,
): EnvMutationPayload {
  return renameEnvironment(ctx, input);
}

/**
 * Seed a brand-new environment entity. Wraps `seedEnvironment` from the
 * projection module — emits a `create` body for the scalar shell plus
 * one `addToSet` per variable. All-or-nothing under the oracle's
 * per-entity lock. Mirrors `buildAddBatch` in `rule-mutations.ts`.
 */
export function buildSeedEnvironmentBatch(env: V5.Environment, ctx: MutatorContext): EnvMutationPayload {
  return { batch: seedEnvironment(env, ctx), sideEffects: [] };
}

/**
 * Tombstone an environment. Mirrors `buildDeleteBatch` in
 * `rule-mutations.ts`. Tombstones are permanent under §7.2 delete-wins;
 * variable-set members ride along under the entity-id deletion.
 */
export function buildDeleteEnvironmentBatch(envId: string, ctx: MutatorContext): EnvMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: ENVIRONMENT_ENTITY_TYPE, id: envId }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

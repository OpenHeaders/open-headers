/**
 * Environment write-site → oracle helpers.
 *
 * Mirrors `rule-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the env cache) and the renderer
 * (`useEnvironmentMutator` write client).
 */

import {
  type MutatorContext,
  type MutatorIntent,
  removeEnvVar,
  renameEnvironment,
  renameEnvVar,
  setEnvVar,
  setEnvVarType,
  type VariableType,
} from '@openheaders/core/sync';

export type EnvMutationPayload = MutatorIntent;

export interface SetEnvVarInput {
  envId: string;
  name: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildSetEnvVarBatch(input: SetEnvVarInput, ctx: MutatorContext): EnvMutationPayload {
  return setEnvVar(ctx, input);
}

export interface RemoveEnvVarInput {
  envId: string;
  name: string;
}

export function buildRemoveEnvVarBatch(input: RemoveEnvVarInput, ctx: MutatorContext): EnvMutationPayload {
  return removeEnvVar(ctx, input);
}

export interface RenameEnvVarInput {
  envId: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildRenameEnvVarBatch(input: RenameEnvVarInput, ctx: MutatorContext): EnvMutationPayload {
  return renameEnvVar(ctx, input);
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

export interface SetEnvVarTypeInput {
  envId: string;
  name: string;
  value: string;
  type: VariableType;
}

export function buildSetEnvVarTypeBatch(input: SetEnvVarTypeInput, ctx: MutatorContext): EnvMutationPayload {
  return setEnvVarType(ctx, input);
}

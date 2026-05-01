/**
 * Variable intent factories for environment-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the environment routing constants + side-effect
 * intent. Re-exports the four primitives under the historical
 * `setEnvVar` / `removeEnvVar` / `renameEnvVar` / `setEnvVarType` names
 * with `envId`-named args preserved for call-site clarity.
 *
 * Set-member identity = variable name (per `types.ts`). Per-(setPath,
 * name) LWW handles concurrent same-name edits; concurrent diverging
 * renames produce two new entries — the convergent answer for "two
 * surfaces independently renamed the same variable to different names."
 */

import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  varsPath: ENV_VARS_PATH,
  mintBatch,
  makeSideEffects: (uid, hlc) => [invalidateResolverIntent(uid, hlc)],
});

export interface SetEnvVarArgs {
  envId: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setEnvVar(ctx: MutatorContext, args: SetEnvVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.envId,
    name: args.name,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface RemoveEnvVarArgs {
  envId: string;
  name: string;
}

export function removeEnvVar(ctx: MutatorContext, args: RemoveEnvVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.envId, name: args.name });
}

export interface RenameEnvVarArgs {
  envId: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function renameEnvVar(ctx: MutatorContext, args: RenameEnvVarArgs): MutatorIntent {
  return factories.renameVariable(ctx, {
    entityUid: args.envId,
    oldName: args.oldName,
    newName: args.newName,
    value: args.value,
    type: args.type,
    orderKey: args.orderKey,
  });
}

export interface SetEnvVarTypeArgs {
  envId: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export function setEnvVarType(ctx: MutatorContext, args: SetEnvVarTypeArgs): MutatorIntent {
  return factories.setVariableType(ctx, {
    entityUid: args.envId,
    name: args.name,
    value: args.value,
    type: args.type,
  });
}

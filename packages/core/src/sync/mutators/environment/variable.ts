/**
 * Variable intent factories for environment-scoped variables.
 *
 * Thin per-catalog adapter over {@link makeVariableMutators}: binds the
 * shared factory to the environment routing constants + side-effect
 * intent. Re-exports the two primitives under the historical
 * `setEnvVar` / `removeEnvVar` names with `envId`-named args preserved.
 *
 * Set-member identity = `variable.uid` (per `types.ts`). Per-(setPath,
 * uid) LWW handles concurrent same-row edits; concurrent same-row
 * renames converge on the later-HLC name. Two surfaces independently
 * adding same-named rows produce two distinct uids → two rows for
 * manual merge.
 */

import type { Variable } from '../../../types/variable';
import { makeVariableMutators, type VariableType } from '../shared/variable-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveEnvironmentSideEffects } from './side-effects';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from './types';

export type { VariableType };

const factories = makeVariableMutators({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  varsPath: ENV_VARS_PATH,
  mintBatch,
  deriveSideEffects: deriveEnvironmentSideEffects,
});

export interface SetEnvVarArgs {
  envId: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export function setEnvVar(ctx: MutatorContext, args: SetEnvVarArgs): MutatorIntent {
  return factories.setVariable(ctx, {
    entityUid: args.envId,
    variable: args.variable,
    orderKey: args.orderKey,
  });
}

export interface RemoveEnvVarArgs {
  envId: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function removeEnvVar(ctx: MutatorContext, args: RemoveEnvVarArgs): MutatorIntent {
  return factories.removeVariable(ctx, { entityUid: args.envId, uid: args.uid });
}

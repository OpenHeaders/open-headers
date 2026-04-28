/**
 * Variable intent factories — set/remove/rename/setType.
 *
 * Variables live as set members at `variables` on the environment
 * entity. Set-member identity = variable name (see `types.ts`). The
 * generic mutator's per-(setPath, itemId) LWW handles concurrent edits
 * to the same variable. Concurrent diverging renames produce two new
 * entries — that's the convergent answer for "two surfaces independently
 * renamed the same variable to different names."
 */

import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE, type EnvironmentIntent, type EnvironmentMutatorContext } from './types';

export type VariableType = 'default' | 'secret';

export interface SetEnvVarArgs {
  envId: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

/**
 * Add or update an environment variable. Idempotent on (name) — a
 * subsequent `setEnvVar` for the same name supersedes via per-itemId
 * LWW (§7.2). Whole-record replacement matches the rule header-mod
 * model.
 */
export function setEnvVar(ctx: EnvironmentMutatorContext, args: SetEnvVarArgs): EnvironmentIntent {
  const item = { name: args.name, value: args.value, type: args.type ?? 'default' };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: ENVIRONMENT_ENTITY_TYPE,
        id: args.envId,
        path: ENV_VARS_PATH,
        itemId: args.name,
        item,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [],
  };
}

export interface RemoveEnvVarArgs {
  envId: string;
  name: string;
}

/**
 * Tombstone an environment variable. The tombstone retains for the
 * configured TTL (§9.2) so reconnecting offline nodes don't resurrect
 * the entry via a stale `setEnvVar` at lower HLC.
 */
export function removeEnvVar(ctx: EnvironmentMutatorContext, args: RemoveEnvVarArgs): EnvironmentIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: ENVIRONMENT_ENTITY_TYPE,
        id: args.envId,
        path: ENV_VARS_PATH,
        itemId: args.name,
      },
    ]),
    sideEffects: [],
  };
}

export interface RenameEnvVarArgs {
  envId: string;
  oldName: string;
  newName: string;
  /**
   * Carry the value through the rename so the new entry has the same
   * value as the old. Caller reads it from its current view; the
   * factory stays pure (no oracle access).
   */
  value: string;
  type?: VariableType;
  /** Optional orderKey for the new entry. */
  orderKey?: string;
}

/**
 * Atomic rename — emitted as a single batch so the local oracle's
 * per-batch all-or-nothing (§11.2) guarantees observers never see the
 * "old removed but new not yet added" intermediate state.
 *
 * Rename to the same name is a no-op (no batch emitted). Rename onto
 * an existing name is the caller's responsibility to prevent at the UI
 * layer — semantically it would replace the target via per-itemId LWW.
 */
export function renameEnvVar(ctx: EnvironmentMutatorContext, args: RenameEnvVarArgs): EnvironmentIntent {
  if (args.oldName === args.newName) {
    return { batch: mintBatch(ctx, []), sideEffects: [] };
  }
  const item = { name: args.newName, value: args.value, type: args.type ?? 'default' };
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: args.envId,
      path: ENV_VARS_PATH,
      itemId: args.oldName,
    },
    {
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: args.envId,
      path: ENV_VARS_PATH,
      itemId: args.newName,
      item,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface SetEnvVarTypeArgs {
  envId: string;
  name: string;
  /** Carry the current value through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

/**
 * Toggle a variable's `type` (default ↔ secret). Re-emits the whole
 * record via `addToSet`; per-(setPath, itemId) LWW means the latest
 * type wins. Per-field-within-set LWW isn't a v1 generic primitive
 * (matches the rule-condition pattern in `rule/condition.ts`).
 */
export function setEnvVarType(ctx: EnvironmentMutatorContext, args: SetEnvVarTypeArgs): EnvironmentIntent {
  const item = { name: args.name, value: args.value, type: args.type };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: ENVIRONMENT_ENTITY_TYPE,
        id: args.envId,
        path: ENV_VARS_PATH,
        itemId: args.name,
        item,
      },
    ]),
    sideEffects: [],
  };
}

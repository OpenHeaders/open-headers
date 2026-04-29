/**
 * Variable intent factories for workspace-scoped variables.
 *
 * Mirrors `environment/variable.ts` and `collection/variable.ts`.
 * Workspace vars live as set members at `variables` on the singleton
 * workspace-variables entity (id = `WORKSPACE_VARIABLES_ID`). Because
 * the entity is singleton, factories take no id arg — every envelope
 * targets the fixed id internally.
 *
 * Set-member identity = variable name (per `types.ts`). Concurrent
 * same-name edits converge under per-(setPath, name) LWW; concurrent
 * diverging renames produce two new entries — the convergent answer
 * for "two surfaces independently renamed the same variable to
 * different names."
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from './types';

export type VariableType = 'default' | 'secret';

export interface SetWorkspaceVarArgs {
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

/**
 * Add or update a workspace variable. Idempotent on (name) — a
 * subsequent `setWorkspaceVar` for the same name supersedes via
 * per-itemId LWW (§7.2). Whole-record replacement matches the env-var
 * + collection-var model.
 */
export function setWorkspaceVar(ctx: MutatorContext, args: SetWorkspaceVarArgs): MutatorIntent {
  const item = { name: args.name, value: args.value, type: args.type ?? 'default' };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: WORKSPACE_VARIABLES_ENTITY_TYPE,
        id: WORKSPACE_VARIABLES_ID,
        path: WORKSPACE_VARIABLES_PATH,
        itemId: args.name,
        item,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface RemoveWorkspaceVarArgs {
  name: string;
}

/**
 * Tombstone a workspace variable. The tombstone retains for the
 * configured TTL (§9.2) so reconnecting offline nodes don't resurrect
 * the entry via a stale `setWorkspaceVar` at lower HLC.
 */
export function removeWorkspaceVar(ctx: MutatorContext, args: RemoveWorkspaceVarArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: WORKSPACE_VARIABLES_ENTITY_TYPE,
        id: WORKSPACE_VARIABLES_ID,
        path: WORKSPACE_VARIABLES_PATH,
        itemId: args.name,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface RenameWorkspaceVarArgs {
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

/**
 * Atomic rename — emitted as a single batch so the local oracle's
 * per-batch all-or-nothing (§11.2) guarantees observers never see the
 * "old removed but new not yet added" intermediate state. Rename to
 * the same name returns an empty batch (no broadcast, no recompile).
 */
export function renameWorkspaceVar(ctx: MutatorContext, args: RenameWorkspaceVarArgs): MutatorIntent {
  if (args.oldName === args.newName) {
    return { batch: mintBatch(ctx, []), sideEffects: [] };
  }
  const item = { name: args.newName, value: args.value, type: args.type ?? 'default' };
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: args.oldName,
    },
    {
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: args.newName,
      item,
      orderKey: args.orderKey,
    },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface SetWorkspaceVarTypeArgs {
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

/**
 * Toggle a variable's `type`. Re-emits the whole record via `addToSet`;
 * per-(setPath, itemId) LWW means the latest type wins.
 */
export function setWorkspaceVarType(ctx: MutatorContext, args: SetWorkspaceVarTypeArgs): MutatorIntent {
  const item = { name: args.name, value: args.value, type: args.type };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: WORKSPACE_VARIABLES_ENTITY_TYPE,
        id: WORKSPACE_VARIABLES_ID,
        path: WORKSPACE_VARIABLES_PATH,
        itemId: args.name,
        item,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

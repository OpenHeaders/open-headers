/**
 * `createScriptPackage` + `deleteScriptPackage` — package entity
 * lifecycle. Each is a single-envelope batch; packages have no parent
 * slot and no set-modeled paths, so the create payload is the flat
 * `ScriptPackage` minus `uid` (carried on the envelope as `id`).
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SCRIPT_PACKAGE_ENTITY_TYPE } from './types';

export interface CreateScriptPackageArgs {
  scriptPackageUid: string;
  /** Full `ScriptPackage` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createScriptPackage(ctx: MutatorContext, args: CreateScriptPackageArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'create',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: args.scriptPackageUid,
      payload: args.payload,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface DeleteScriptPackageArgs {
  scriptPackageUid: string;
}

export function deleteScriptPackage(ctx: MutatorContext, args: DeleteScriptPackageArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: SCRIPT_PACKAGE_ENTITY_TYPE, id: args.scriptPackageUid }]);
  return { batch, sideEffects: [] };
}

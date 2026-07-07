/**
 * Scalar `setField` / `unsetField` intent factories for script-package
 * entities. Same posture as `live-variable/scalar.ts` — one typed-path
 * generic over the scalar paths on `ScriptPackage`, schema drift caught
 * at the call site via the string-literal union.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SCRIPT_PACKAGE_ENTITY_TYPE } from './types';

/**
 * Aligned with `ScriptPackageSchema` minus `uid` (carried as envelope
 * `id`) and `schemaVersion` (immutable).
 */
export type ScriptPackageScalarPath = 'name' | 'description' | 'path' | 'source';

export interface SetScriptPackageFieldArgs {
  scriptPackageUid: string;
  path: ScriptPackageScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setScriptPackageField(ctx: MutatorContext, args: SetScriptPackageFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: args.scriptPackageUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}

/** `unsetField` flavor for optional paths (currently `description`). */
export interface UnsetScriptPackageFieldArgs {
  scriptPackageUid: string;
  path: ScriptPackageScalarPath;
}

export function unsetScriptPackageField(ctx: MutatorContext, args: UnsetScriptPackageFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'unsetField',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: args.scriptPackageUid,
      path: args.path,
    },
  ]);
  return { batch, sideEffects: [] };
}

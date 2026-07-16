/**
 * Scalar `setField` / `unsetField` intent factories for spec entities.
 * Same posture as `script-package/scalar.ts` — one typed-path generic
 * over the scalar paths on `Spec`, schema drift caught at the call
 * site via the string-literal union.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SPEC_ENTITY_TYPE } from './types';

/**
 * Aligned with `SpecSchema` minus `uid` (carried as envelope `id`),
 * `schemaVersion` (immutable), and `files` (set-modeled — see
 * `file.ts`).
 */
export type SpecScalarPath = 'name' | 'description' | 'path' | 'format' | 'rootFileUid';

export interface SetSpecFieldArgs {
  specUid: string;
  path: SpecScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setSpecField(ctx: MutatorContext, args: SetSpecFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: SPEC_ENTITY_TYPE,
      id: args.specUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}

/** `unsetField` flavor for optional paths (currently `description`). */
export interface UnsetSpecFieldArgs {
  specUid: string;
  path: SpecScalarPath;
}

export function unsetSpecField(ctx: MutatorContext, args: UnsetSpecFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'unsetField',
      type: SPEC_ENTITY_TYPE,
      id: args.specUid,
      path: args.path,
    },
  ]);
  return { batch, sideEffects: [] };
}

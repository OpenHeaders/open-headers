/**
 * Scalar `setField` intent factory for response-example entities.
 *
 * The path union is deliberately narrow: examples are frozen snapshots,
 * so only `name` (rename) and `path` (parent request rename cascades
 * the folder path) are writable. The captured `request` / `response`
 * blocks are immutable by construction — no factory can address them.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

/** Writable scalars — everything else on the entity is frozen. */
export type ResponseExampleScalarPath = 'name' | 'path';

export interface SetResponseExampleFieldArgs {
  responseExampleUid: string;
  path: ResponseExampleScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setResponseExampleField(ctx: MutatorContext, args: SetResponseExampleFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.responseExampleUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}

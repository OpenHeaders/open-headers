/**
 * `createResponseExample` + `deleteResponseExample` — example entity
 * lifecycle. Each is a single-envelope batch; the create payload is the
 * flat `ResponseExample` minus `uid` (carried on the envelope as `id`).
 * Duplicate is a fresh create with a new uid — no dedicated mutation.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

export interface CreateResponseExampleArgs {
  responseExampleUid: string;
  /** Full `ResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createResponseExample(ctx: MutatorContext, args: CreateResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'create',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.responseExampleUid,
      payload: args.payload,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface DeleteResponseExampleArgs {
  responseExampleUid: string;
}

export function deleteResponseExample(ctx: MutatorContext, args: DeleteResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: args.responseExampleUid }]);
  return { batch, sideEffects: [] };
}

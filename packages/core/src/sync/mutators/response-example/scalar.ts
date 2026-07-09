/**
 * Scalar `setField` intent factory for response-example entities.
 *
 * Writable paths: `name` (rename), `path` (parent request rename
 * cascades the folder path), and the captured `request` / `response`
 * blocks — examples start as captures but stay editable afterwards, so
 * users can turn a real exchange into an authored documentation
 * template. Each block writes as one LWW value: rows inside a capture
 * are not set-modeled, so concurrent edits resolve per block, not per
 * row.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

/** Writable paths — identity (`uid`) and `capturedAt` (a historical
 *  fact) stay frozen. */
export type ResponseExampleScalarPath = 'name' | 'path' | 'request' | 'response';

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

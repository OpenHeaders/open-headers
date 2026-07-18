/**
 * Scalar `setField` intent factory for WebSocket response-example
 * entities.
 *
 * Writable paths: `name` (rename), `path` (parent request rename
 * cascades the folder path), and the captured `request` / `response`
 * blocks — examples start as captures but stay editable afterwards.
 * Each block writes as one LWW value: rows inside a capture are not
 * set-modeled, so concurrent edits resolve per block, not per row.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

/** Writable paths — identity (`uid`) and `capturedAt` (a historical
 *  fact) stay frozen. */
export type WsResponseExampleScalarPath = 'name' | 'path' | 'request' | 'response';

export interface SetWsResponseExampleFieldArgs {
  wsResponseExampleUid: string;
  path: WsResponseExampleScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setWsResponseExampleField(ctx: MutatorContext, args: SetWsResponseExampleFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.wsResponseExampleUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}

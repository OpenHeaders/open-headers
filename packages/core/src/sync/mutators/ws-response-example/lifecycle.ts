/**
 * `createWsResponseExample` + `deleteWsResponseExample` — example
 * entity lifecycle. Each is a single-envelope batch; the create payload
 * is the flat `WsResponseExample` minus `uid` (carried on the envelope
 * as `id`). Duplicate is a fresh create with a new uid — no dedicated
 * mutation.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

export interface CreateWsResponseExampleArgs {
  wsResponseExampleUid: string;
  /** Full `WsResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createWsResponseExample(ctx: MutatorContext, args: CreateWsResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'create',
      type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.wsResponseExampleUid,
      payload: args.payload,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface DeleteWsResponseExampleArgs {
  wsResponseExampleUid: string;
}

export function deleteWsResponseExample(ctx: MutatorContext, args: DeleteWsResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    { kind: 'delete', type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE, id: args.wsResponseExampleUid },
  ]);
  return { batch, sideEffects: [] };
}

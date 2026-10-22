/**
 * Path-parameter intent factories.
 *
 * Path params live as set members at `pathParams` on the request
 * entity. Same shape contract as `param.ts` — per-itemId LWW,
 * replacement via re-add with the same itemId — minus reordering: the
 * URL orders its `/:name` segments, so no `moveBefore` factory exists
 * and `orderKey` only keeps the materialized array deterministic. Own
 * module for the same grep-friendliness reason `param.ts` has.
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE, REQUEST_PATH_PARAMS_PATH, type RequestPathParamRow } from './types';

export interface AddRequestPathParamArgs {
  requestUid: string;
  pathParam: RequestPathParamRow;
  orderKey?: string;
  /**
   * Optional explicit itemId override. Defaults to `pathParam.uid` so
   * the persisted row identity and the oracle's set-member identity
   * stay the same string (the synthesizer keys on this).
   */
  itemId?: string;
}

export function addRequestPathParam(ctx: MutatorContext, args: AddRequestPathParamArgs): MutatorIntent {
  const itemId = args.itemId ?? args.pathParam.uid ?? generateUid();
  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: args.requestUid,
      path: REQUEST_PATH_PARAMS_PATH,
      itemId,
      item: args.pathParam,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface RemoveRequestPathParamArgs {
  requestUid: string;
  itemId: string;
}

export function removeRequestPathParam(ctx: MutatorContext, args: RemoveRequestPathParamArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: REQUEST_PATH_PARAMS_PATH,
        itemId: args.itemId,
      },
    ]),
    sideEffects: [],
  };
}

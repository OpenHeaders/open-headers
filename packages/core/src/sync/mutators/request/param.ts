/**
 * Query-param intent factories.
 *
 * Params live as set members at `params` on the request entity. Same
 * shape contract as `header.ts` — per-itemId LWW, parent-owned
 * ordering, replacement via re-add with the same itemId. Kept in its
 * own module rather than collapsed into a single `addRow(setPath)`
 * generic so call sites stay grep-friendly ("who edits the param
 * grid"); the rule-mutator catalog took the same posture for
 * `header-mod.ts` vs `condition.ts` even though they share the
 * underlying primitive.
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE, REQUEST_PARAMS_PATH, type RequestParamRow } from './types';
import type { MutatorContext, MutatorIntent } from '../types';

export interface AddRequestParamArgs {
  requestUid: string;
  param: RequestParamRow;
  orderKey?: string;
  itemId?: string;
}

export function addRequestParam(ctx: MutatorContext, args: AddRequestParamArgs): MutatorIntent {
  const itemId = args.itemId ?? generateUid();
  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: args.requestUid,
      path: REQUEST_PARAMS_PATH,
      itemId,
      item: args.param,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface RemoveRequestParamArgs {
  requestUid: string;
  itemId: string;
}

export function removeRequestParam(ctx: MutatorContext, args: RemoveRequestParamArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: REQUEST_PARAMS_PATH,
        itemId: args.itemId,
      },
    ]),
    sideEffects: [],
  };
}

export interface ReorderRequestParamArgs {
  requestUid: string;
  itemId: string;
  orderKey: string;
}

export function reorderRequestParam(ctx: MutatorContext, args: ReorderRequestParamArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'moveBefore',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: REQUEST_PARAMS_PATH,
        itemId: args.itemId,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [],
  };
}

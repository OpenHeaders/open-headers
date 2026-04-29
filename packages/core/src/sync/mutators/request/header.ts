/**
 * Request-header intent factories.
 *
 * Headers live as set members at `headers` on the request entity. Each
 * row carries a generated `itemId`; ordering is parent-owned (§7.2 /
 * §23.5) and convergence holds because the writer commits to a
 * fractional-indexing key on the envelope itself (`orderKey`).
 *
 * The caller (workbench editor row drag, import pipeline) computes
 * `keyBetween(prevKey, nextKey)` from its current view. Per-field
 * within a header row is not a v1 primitive — replacing a row's
 * contents re-emits `addRequestHeader` with the same `itemId` so the
 * row is replaced under per-(setPath, itemId) LWW.
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE, REQUEST_HEADERS_PATH, type RequestHeaderRow } from './types';
import type { MutatorContext, MutatorIntent } from '../types';

export interface AddRequestHeaderArgs {
  requestUid: string;
  header: RequestHeaderRow;
  /**
   * Pre-computed fractional-indexing key for the new row's position.
   * Omit to let the seed key handle ordering — fine for the first row
   * or when the caller doesn't care.
   */
  orderKey?: string;
  /** Optional explicit itemId (replay / row-replacement). Otherwise minted. */
  itemId?: string;
}

export function addRequestHeader(ctx: MutatorContext, args: AddRequestHeaderArgs): MutatorIntent {
  const itemId = args.itemId ?? generateUid();
  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: args.requestUid,
      path: REQUEST_HEADERS_PATH,
      itemId,
      item: args.header,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface RemoveRequestHeaderArgs {
  requestUid: string;
  itemId: string;
}

export function removeRequestHeader(ctx: MutatorContext, args: RemoveRequestHeaderArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: REQUEST_HEADERS_PATH,
        itemId: args.itemId,
      },
    ]),
    sideEffects: [],
  };
}

export interface ReorderRequestHeaderArgs {
  requestUid: string;
  itemId: string;
  /**
   * Pre-computed fractional-indexing key — caller derives it from its
   * current view via `keyBetween(prevKey, nextKey)`.
   */
  orderKey: string;
}

export function reorderRequestHeader(ctx: MutatorContext, args: ReorderRequestHeaderArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'moveBefore',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: REQUEST_HEADERS_PATH,
        itemId: args.itemId,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [],
  };
}

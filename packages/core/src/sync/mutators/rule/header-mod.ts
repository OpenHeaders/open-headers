/**
 * Header-mod intent factories.
 *
 * Header mods live on the rule's HeaderAction at
 * `action.requestHeaders` / `action.responseHeaders`. Each mod is a
 * set member with a generated `itemId`; ordering is parent-owned
 * (§7.2 / §23.5) and convergence is enforced by carrying the
 * fractional-indexing key on the envelope itself.
 *
 * The caller (UI surface or import pipeline) computes the desired
 * `orderKey` from its current view via `keyBetween(predKey, anchorKey)`
 * and passes it in. That keeps factories pure — no need for them to
 * read store state — and matches the doc's "writer commits to a key
 * at emit time" contract.
 *
 * `setHeaderModField` is intentionally absent: per-field-within-set
 * LWW isn't a v1 generic primitive; the editor re-emits the whole mod
 * via `addHeaderMod` with the same itemId for replacement (LWW per
 * itemId).
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import { recompileDnrIntent } from './side-effects';
import { RULE_ENTITY_TYPE, type RuleIntent, type RuleMutatorContext } from './types';

/** Which side of the request lifecycle the mod targets. */
export type HeaderSide = 'request' | 'response';

const setPath = (side: HeaderSide): string => (side === 'request' ? 'action.requestHeaders' : 'action.responseHeaders');

export interface HeaderModification {
  operation: 'override' | 'add' | 'remove' | 'merge';
  headerName: string;
  value?: string;
  mergeSeparator?: string;
}

export interface AddHeaderModArgs {
  ruleUid: string;
  side: HeaderSide;
  mod: HeaderModification;
  /**
   * Pre-computed fractional-indexing key for the new mod's position.
   * Omit to let the seed key handle ordering — fine for first mod or
   * when the caller doesn't care.
   */
  orderKey?: string;
  /** Optional explicit itemId (replay / import). Otherwise minted. */
  itemId?: string;
}

export function addHeaderMod(ctx: RuleMutatorContext, args: AddHeaderModArgs): RuleIntent {
  const itemId = args.itemId ?? generateUid();
  const path = setPath(args.side);

  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: RULE_ENTITY_TYPE,
      id: args.ruleUid,
      path,
      itemId,
      item: args.mod,
      orderKey: args.orderKey,
    },
  ];

  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

export interface RemoveHeaderModArgs {
  ruleUid: string;
  side: HeaderSide;
  itemId: string;
}

export function removeHeaderMod(ctx: RuleMutatorContext, args: RemoveHeaderModArgs): RuleIntent {
  const path = setPath(args.side);
  return {
    batch: mintBatch(ctx, [
      { kind: 'removeFromSet', type: RULE_ENTITY_TYPE, id: args.ruleUid, path, itemId: args.itemId },
    ]),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

export interface ReorderHeaderModArgs {
  ruleUid: string;
  side: HeaderSide;
  itemId: string;
  /**
   * Pre-computed fractional-indexing key — caller derives it from its
   * current view via `keyBetween(prevKey, nextKey)`.
   */
  orderKey: string;
}

export function reorderHeaderMod(ctx: RuleMutatorContext, args: ReorderHeaderModArgs): RuleIntent {
  const path = setPath(args.side);
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'moveBefore',
        type: RULE_ENTITY_TYPE,
        id: args.ruleUid,
        path,
        itemId: args.itemId,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

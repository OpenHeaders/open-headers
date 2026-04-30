/**
 * Rule condition intent factories.
 *
 * Conditions live as set members at `conditions` on the rule. Like
 * header mods they have a generated itemId; unlike header mods they
 * are AND-evaluated and the user-visible order is informational only,
 * so we don't emit an explicit moveBefore on add (the seed key
 * suffices — per-itemId tie-break gives a deterministic but
 * unspecified order across surfaces, which is what the editor expects).
 *
 * `setConditionField` re-emits the whole condition record via
 * addToSet with the same itemId. Per-field LWW within a single
 * condition is not a v1 generic primitive — see header-mod.ts for the
 * same trade-off note. The caller passes the merged condition object;
 * this factory does not read state.
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import { recompileDnrIntent } from './side-effects';
import type { MutatorContext, MutatorIntent } from '../types';
import { RULE_ENTITY_TYPE } from './types';

export interface RuleConditionLike {
  /**
   * Persisted per-row identity. Doubles as the sync engine's itemId so
   * row identity round-trips through save/reload (parallel to
   * {@link HeaderModification.uid} from the rule-header-mod slice).
   */
  uid: string;
  type: string;
  values: string[];
  headerName?: string;
}

export interface AddConditionArgs {
  ruleUid: string;
  condition: RuleConditionLike;
  /**
   * Optional explicit itemId override. Defaults to `condition.uid` so
   * the persisted row identity and the oracle's set-member identity
   * stay the same string (the synthesizer keys on this).
   */
  itemId?: string;
}

export function addCondition(ctx: MutatorContext, args: AddConditionArgs): MutatorIntent {
  const itemId = args.itemId ?? args.condition.uid ?? generateUid();
  const bodies: MutationBody[] = [
    { kind: 'addToSet', type: RULE_ENTITY_TYPE, id: args.ruleUid, path: 'conditions', itemId, item: args.condition },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

export interface RemoveConditionArgs {
  ruleUid: string;
  itemId: string;
}

export function removeCondition(ctx: MutatorContext, args: RemoveConditionArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: RULE_ENTITY_TYPE,
        id: args.ruleUid,
        path: 'conditions',
        itemId: args.itemId,
      },
    ]),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

export interface SetConditionFieldArgs {
  ruleUid: string;
  itemId: string;
  /** Full merged condition record after the field write. The caller owns the merge. */
  condition: RuleConditionLike;
}

export function setConditionField(ctx: MutatorContext, args: SetConditionFieldArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: RULE_ENTITY_TYPE,
        id: args.ruleUid,
        path: 'conditions',
        itemId: args.itemId,
        item: args.condition,
      },
    ]),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

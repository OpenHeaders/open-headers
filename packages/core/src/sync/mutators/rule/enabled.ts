/**
 * `toggleEnabled` is semantically `setField('enabled', _)` — named for
 * UI/awareness clarity (§7.2 / §8). Splitting it out makes call sites
 * grep-friendly ("who toggles rules") and gives observability a
 * stable mutation kind to surface in the awareness ribbon.
 *
 * The factory still emits a generic `setField` envelope; the oracle
 * doesn't dispatch on the catalog name, only on the body kind.
 */

import { mintBatch } from './envelope';
import { recompileDnrIntent } from './side-effects';
import { RULE_ENTITY_TYPE, type RuleIntent, type RuleMutatorContext } from './types';

export interface ToggleEnabledArgs {
  ruleUid: string;
  enabled: boolean;
}

export function toggleEnabled(ctx: RuleMutatorContext, args: ToggleEnabledArgs): RuleIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'setField', type: RULE_ENTITY_TYPE, id: args.ruleUid, path: 'enabled', value: args.enabled },
    ]),
    sideEffects: [recompileDnrIntent(args.ruleUid, ctx.hlc)],
  };
}

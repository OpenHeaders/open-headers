/**
 * `toggleEnabled` is semantically `setField('enabled', _)` — named for
 * UI/awareness clarity (§7.2 / §8). Splitting it out makes call sites
 * grep-friendly ("who toggles rules") and gives observability a
 * stable mutation kind to surface in the awareness ribbon.
 *
 * The factory still emits a generic `setField` envelope; the oracle
 * doesn't dispatch on the catalog name, only on the body kind.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveRuleSideEffects } from './side-effects';
import { RULE_ENTITY_TYPE } from './types';

export interface ToggleEnabledArgs {
  ruleUid: string;
  enabled: boolean;
}

export function toggleEnabled(ctx: MutatorContext, args: ToggleEnabledArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    { kind: 'setField', type: RULE_ENTITY_TYPE, id: args.ruleUid, path: 'enabled', value: args.enabled },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveRuleSideEffects) };
}

/**
 * Per-envelope rule post-state projection (Phase A Fw7).
 *
 * Renderer-side write helpers (`buildUpdateBatch`, popup toggle, etc.)
 * need to know the live `(itemId, item)` pairs at each set-modeled
 * path on a rule before they can emit the matching `removeFromSet`
 * envelopes. Round-tripping back to the SW per write would kill the
 * synchronous-render discipline (§19.4), so we attach the post-commit
 * projection to every Rule {@link SyncBroadcastEvent}: the renderer
 * mirror folds it into its local view in lockstep with the oracle.
 *
 * The projector is intentionally minimal — one `materializeOne` lookup
 * + three `liveSetItems` reads per Rule envelope. Cheap. Coalescing
 * by batch can wait for profiling to show it matters.
 */

import type { SyncRulePostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { RuleOracle } from './oracle';
import { projectRule } from '@/shared/sync/rule-projection';

/** Set-modeled paths on a Rule — mirrors {@link rule-projection.SET_PATHS}. */
const RULE_SET_PATHS = ['conditions', 'action.requestHeaders', 'action.responseHeaders'] as const;

/**
 * Build the rule post-state for `envelope` using `oracle`. Returns
 * `null` for non-Rule envelopes, deletes (entity tombstoned), and any
 * envelope whose target rule fails to project — the broadcast still
 * fires; just without the optional payload.
 */
export function projectRulePostState(
  oracle: Pick<RuleOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncRulePostState | null {
  if (envelope.body.type !== RULE_ENTITY_TYPE) return null;
  return projectRuleByUid(oracle, envelope.body.id);
}

/**
 * Build the rule post-state for a known rule uid. Same shape the
 * envelope projector returns; used by the snapshot RPC to seed
 * freshly-mounted renderer mirrors before the next live broadcast.
 */
export function projectRuleByUid(
  oracle: Pick<RuleOracle, 'materializeOne' | 'liveSetItems'>,
  ruleUid: string,
): SyncRulePostState | null {
  const materialized = oracle.materializeOne(RULE_ENTITY_TYPE, ruleUid);
  if (!materialized) return null;

  const rule = projectRule(materialized);
  if (!rule) return null;

  const setItemIds: Record<string, string[]> = {};
  for (const path of RULE_SET_PATHS) {
    const items = oracle.liveSetItems(RULE_ENTITY_TYPE, ruleUid, path);
    if (items.length === 0) continue;
    setItemIds[path] = items.map((entry) => entry.itemId);
  }

  return { rule, setItemIds };
}

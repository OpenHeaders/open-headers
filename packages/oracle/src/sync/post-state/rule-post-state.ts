/**
 * Per-envelope rule post-state projection (Phase A Fw7).
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers (`buildUpdateBatch`, popup toggle) need to know the live
 * `(itemId, orderKey, item)` triplets at each set-modeled path on a rule
 * before they can emit the matching synthesizer envelopes — round-
 * tripping back to the SW per write would kill the synchronous-render
 * discipline (§19.4), so we attach the post-commit projection to every
 * Rule {@link SyncBroadcastEvent}.
 */

import type { SyncRulePostState } from '@openheaders/core/protocol';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { projectRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from '../oracle';

/** Set-modeled paths on a Rule — mirrors {@link rule-projection.SET_PATHS}. */
const RULE_SET_PATHS = ['conditions', 'action.requestHeaders', 'action.responseHeaders'] as const;

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Rule, SyncRulePostState>({
  entityType: RULE_ENTITY_TYPE,
  project: projectRule,
  composeResult: (rule, oracle, uid) => ({
    rule,
    ...buildSetMembersExtras(oracle, RULE_ENTITY_TYPE, uid, RULE_SET_PATHS),
  }),
});

export const projectRulePostState = projectors.projectPostState;
export const projectRuleByUid = projectors.projectByUid;

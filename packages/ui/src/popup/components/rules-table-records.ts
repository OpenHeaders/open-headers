/**
 * Record model + projection for the popup's all-rules table. Pure
 * functions over the rule list — no hooks, no component state.
 */

import type { Rule, RuleCondition, RuleType } from '@openheaders/core/types';
import {
  getActionDetail,
  isRuleComplete,
  isRuleDraft,
  type PauseMarkers,
  resolvePauseState,
} from '@openheaders/core/utils';
import { resolveRule, type VariableResolver } from '@openheaders/core/variables';
import { compareBySortMode, type SortMode } from '@openheaders/ui/shared/table-shared';
import type { ActionDetail } from './columns/sharedColumnRenderers';

/** 0 = active, 1 = paused, 2 = disabled, 3 = draft */
export type StatusRank = 0 | 1 | 2 | 3;

export interface TableRecord {
  key: string;
  id: string;
  name: string;
  path: string;
  ruleType: RuleType;
  actionDetail: ActionDetail;
  domains: string[];
  conditions: RuleCondition[];
  isEnabled: boolean;
  isComplete: boolean;
  /** True for unpublished rules — derived from `isRuleDraft(rule)`.
   *  Drives the gray "draft" row styling (publication gate, distinct
   *  from completeness). */
  isDraft: boolean;
  statusRank: StatusRank;
}

/**
 * Build table records from all rules, sorted by status group then name.
 * `actionDetail` and the displayed `conditions` flow from the RESOLVED
 * rule (templates substituted) so the row reflects what reaches the
 * wire — not the literal `{{ref}}` source. The original `rule` is
 * still used for the IS-COMPLETE / pause checks because completeness
 * is a structural property independent of variable values.
 */
export function rulesToRecords(
  rules: Rule[],
  pauseMarkers: PauseMarkers,
  resolver: VariableResolver,
  sortMode: SortMode,
): TableRecord[] {
  return rules
    .map((rule) => {
      const isEnabled = rule.enabled;
      const complete = isRuleComplete(rule);
      const draft = isRuleDraft(rule);
      const groupPaused = resolvePauseState(rule.path, pauseMarkers);
      const resolved = resolveRule(rule, resolver);

      // Status rank drives sort order: active first, then paused/disabled,
      // drafts last. Unpublished rules are treated as "draft" regardless
      // of completeness — they're not on the wire either way.
      let statusRank: StatusRank;
      if (draft)
        statusRank = 3; // draft
      else if (isEnabled && complete && !groupPaused)
        statusRank = 0; // active
      else if (isEnabled && complete && groupPaused)
        statusRank = 1; // paused
      else if (complete && !isEnabled)
        statusRank = 2; // disabled
      else statusRank = 3; // draft / incomplete

      return {
        key: rule.uid,
        id: rule.uid,
        name: rule.name,
        path: rule.path,
        ruleType: rule.type,
        actionDetail: getActionDetail(resolved),
        domains: resolved.conditions.filter((c) => c.type === 'request-domains').flatMap((c) => c.values),
        conditions: resolved.conditions,
        isEnabled,
        isComplete: complete,
        isDraft: draft,
        statusRank,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));
}

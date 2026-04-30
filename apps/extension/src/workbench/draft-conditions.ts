/**
 * Shared helper — turn a `RuleDraft`'s pre-fill fields
 * (`url` / `urlFilter` / `requestMethods` / `resourceTypes`) into the
 * `RuleCondition[]` shape the rule editor's form expects.
 *
 * Extracted out of `useTabOpeners` so both the tab-opening path and
 * `RuleEditor` (which now also populates drafts on mount) share one
 * implementation. Keeps URL-filter derivation consistent — `urlFilter`
 * wins over `url` when both are present so callers who've already
 * picked a specific pattern don't get overridden by the workspace's
 * draft-URL strategy.
 */

import type { V5 } from '@openheaders/core/types';
import { type DraftUrlStrategy, deriveUrlFilter } from '@openheaders/core/utils';

export function buildDraftConditions(draft: V5.RuleDraftBase, strategy: DraftUrlStrategy): V5.RuleCondition[] {
  const conditions: V5.RuleCondition[] = [];
  const resolvedFilter = draft.urlFilter ?? (draft.url ? deriveUrlFilter(draft.url, strategy) : undefined);
  if (resolvedFilter) {
    conditions.push({ uid: 'sct00027', type: 'url-filter', values: [resolvedFilter] });
  }
  if (draft.requestMethods && draft.requestMethods.length > 0) {
    conditions.push({ uid: 'sct00028', type: 'request-methods', values: draft.requestMethods });
  }
  if (draft.resourceTypes && draft.resourceTypes.length > 0) {
    conditions.push({ uid: 'sct00029', type: 'resource-types', values: draft.resourceTypes });
  }
  return conditions;
}

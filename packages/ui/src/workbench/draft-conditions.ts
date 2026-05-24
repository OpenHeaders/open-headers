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

import type { HeaderModification, HeaderRuleDraftHeader, RuleCondition, RuleDraftBase } from '@openheaders/core/types';
import { type DraftUrlStrategy, deriveUrlFilter, generateUid } from '@openheaders/core/utils';

export function buildDraftConditions(draft: RuleDraftBase, strategy: DraftUrlStrategy): RuleCondition[] {
  const conditions: RuleCondition[] = [];
  const resolvedFilter = draft.urlFilter ?? (draft.url ? deriveUrlFilter(draft.url, strategy) : undefined);
  if (resolvedFilter) {
    conditions.push({ uid: generateUid(), type: 'url-filter', values: [resolvedFilter] });
  }
  if (draft.requestMethods && draft.requestMethods.length > 0) {
    conditions.push({ uid: generateUid(), type: 'request-methods', values: draft.requestMethods });
  }
  if (draft.resourceTypes && draft.resourceTypes.length > 0) {
    conditions.push({ uid: generateUid(), type: 'resource-types', values: draft.resourceTypes });
  }
  return conditions;
}

/**
 * Mint per-row uids onto header mods coming from a `RuleDraft`. `RuleDraft`
 * deliberately omits uid (drafts are partial pre-fill data); the editor owns
 * row identity from the moment rows enter form state. Without this, `seedRule`
 * refuses the save batch because the persisted `HeaderModification` schema
 * requires uid on every set member.
 */
export function buildDraftHeaders(headers: readonly HeaderRuleDraftHeader[]): HeaderModification[] {
  return headers.map((h) => ({ uid: generateUid(), ...h }));
}

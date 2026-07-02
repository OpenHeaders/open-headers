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

import type {
  HeaderModification,
  HeaderRuleDraftHeader,
  QueryParamRuleDraft,
  RequestBodyRuleDraft,
  ResponseRuleDraft,
  RuleCondition,
  RuleDraftBase,
} from '@openheaders/core/types';
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

/**
 * Map a `ResponseRuleDraft`'s pre-fill fields onto the rule editor's
 * response form fields. Mutates `overlay` in place (the caller has
 * already seeded it with the draft's conditions). The body lands in the
 * static or dynamic slot per the draft's `bodyType` — same split the
 * editor uses when populating from a saved rule.
 */
export function applyResponseDraftOverlay(overlay: Record<string, unknown>, draft: ResponseRuleDraft): void {
  if (draft.responseSource) overlay.responseSource = draft.responseSource;
  if (draft.resourceType) overlay.responseResourceType = draft.resourceType;
  if (draft.bodyType) overlay.responseBodyType = draft.bodyType;
  if (draft.statusCode != null) overlay.responseStatusCode = draft.statusCode;
  if (draft.contentType != null) overlay.responseContentType = draft.contentType;
  if (draft.responseBody != null) {
    if (draft.bodyType === 'dynamic') overlay.responseDynamicBody = draft.responseBody;
    else overlay.responseStaticBody = draft.responseBody;
  }
  if (draft.responseHeaders) {
    overlay.responseHeaderRows = Object.entries(draft.responseHeaders).map(([name, value]) => ({ name, value }));
  }
}

/**
 * Map a `RequestBodyRuleDraft`'s pre-fill fields onto the rule editor's
 * request-body form fields. Mutates `overlay` in place. The body lands
 * in the static or dynamic slot per the draft's `bodyType` — same split
 * the editor uses when populating from a saved rule.
 */
export function applyRequestBodyDraftOverlay(overlay: Record<string, unknown>, draft: RequestBodyRuleDraft): void {
  if (draft.bodyType) overlay.requestBodyType = draft.bodyType;
  if (draft.resourceType) overlay.requestResourceType = draft.resourceType;
  if (draft.requestBody != null) {
    if (draft.bodyType === 'dynamic') overlay.requestDynamicBody = draft.requestBody;
    else overlay.requestStaticBody = draft.requestBody;
  }
}

/**
 * Map a `QueryParamRuleDraft`'s pre-fill params onto the rule editor's
 * `queryParams` rows. Mints a uid per row (drafts omit uid; the editor
 * owns row identity) — same as `buildDraftHeaders` does for header mods.
 */
export function applyQueryParamDraftOverlay(overlay: Record<string, unknown>, draft: QueryParamRuleDraft): void {
  if (draft.params && draft.params.length > 0) {
    overlay.queryParams = draft.params.map((p) => ({
      uid: generateUid(),
      param: p.param,
      value: p.value ?? '',
      operation: p.operation,
    }));
  }
}

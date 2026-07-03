/**
 * Pure builders for the inspector response quick-editor's CREATE mode.
 * Counterpart of `response-rule-edit.ts`: the popover's Save is the
 * publication gesture — the caller creates the rule from this seed and
 * publishes it in the same flow. The seed mirrors `buildEmptyRule`'s
 * response defaults for every field the compact editor doesn't surface,
 * overlaid with the captured draft (source, resource type, headers) and
 * the user's edits (status, content-type, body).
 */

import type { ResponseRule, ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import type { ResponseQuickDraft } from './response-rule-edit';

export type ResponseRuleSeed = Omit<ResponseRule, 'uid' | 'path' | 'schemaVersion'>;

/** Seed the editable fields from the captured draft. */
export function seedQuickDraft(draft: ResponseRuleDraft): ResponseQuickDraft {
  return {
    statusCode: draft.statusCode ?? 0,
    contentType: draft.contentType ?? '',
    responseBody: draft.responseBody ?? '',
  };
}

/**
 * Fold the popover's edits back into the handoff draft so the "Open in
 * workspace" link carries the CURRENT form state, not the original
 * capture.
 */
export function mergeQuickIntoResponseDraft(draft: ResponseRuleDraft, quick: ResponseQuickDraft): ResponseRuleDraft {
  return {
    ...draft,
    statusCode: quick.statusCode,
    contentType: quick.contentType,
    responseBody: quick.responseBody,
  };
}

/**
 * Build the full rule seed for `applyRuleCreate`. Conditions pass
 * through unchanged from the popover's Conditions row (seeded via
 * `buildDraftConditions`, edited in place).
 */
export function buildResponseRuleSeed(
  draft: ResponseRuleDraft,
  quick: ResponseQuickDraft,
  name: string,
  conditions: RuleCondition[],
): ResponseRuleSeed {
  return {
    name,
    enabled: true,
    type: 'response',
    conditions,
    action: {
      responseSource: draft.responseSource ?? 'mock',
      bodyType: draft.bodyType ?? 'static',
      responseBody: quick.responseBody,
      statusCode: quick.statusCode,
      contentType: quick.contentType,
      responseHeaders: draft.responseHeaders ?? {},
      resourceType: draft.resourceType ?? 'rest',
    },
  };
}

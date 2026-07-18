/**
 * Pure builders for the response quick-editor's CREATE mode — shared by
 * the popover and the rule-editor tab document, which present the SAME
 * form at two sizes. Counterpart of `response-rule-edit.ts`: Save is the
 * publication gesture — the caller creates the rule from this seed and
 * publishes it in the same flow. The seed mirrors `buildEmptyRule`'s
 * response defaults for every field the editors don't surface, overlaid
 * with the captured draft (source, resource type, headers) and the
 * user's edits (status, content-type, body).
 *
 * The whole plane is WIRE-space: the body field is a
 * `FormatAwareBodyEditor`, whose form value is already wire text
 * (encoded per edit, Raw mode verbatim). Seeds carry the captured bytes
 * AS IS and every exit — Save, the workspace hand-off, the tab
 * escalation — stores the field verbatim; a re-encode here would
 * re-profile a deliberate Raw-mode edit.
 */

import type { ResponseRule, ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import type { ResponseQuickDraft } from './response-rule-edit';

export type ResponseRuleSeed = Omit<ResponseRule, 'uid' | 'path' | 'schemaVersion'>;

/** Seed the editable fields from the captured draft — the body carries
 *  the captured wire bytes verbatim (the editor formats its own view). */
export function seedResponseQuickDraft(draft: ResponseRuleDraft): ResponseQuickDraft {
  return {
    statusCode: draft.statusCode ?? 0,
    contentType: draft.contentType ?? '',
    responseBody: draft.responseBody ?? '',
  };
}

/**
 * Fold the current edits back into the handoff draft so the workspace
 * link and the tab escalation carry the CURRENT form state, not the
 * original capture. Wire in, wire out.
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
 * through unchanged from the Conditions row (seeded via
 * `buildDraftConditions`, edited in place); the body stores AS IS (see
 * the file header).
 */
export function buildResponseRuleSeedFromWire(
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

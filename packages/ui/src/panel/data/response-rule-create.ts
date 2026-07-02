/**
 * Pure builders for the inspector response quick-editor's CREATE mode.
 * Counterpart of `response-rule-edit.ts`: the popover's Save is the
 * publication gesture — the caller creates the rule from this seed and
 * publishes it in the same flow. The seed mirrors `buildEmptyRule`'s
 * response defaults for every field the compact editor doesn't surface,
 * overlaid with the captured draft (source, resource type, headers) and
 * the user's edits (status, content-type, body).
 */

import type { ResponseRule, ResponseRuleDraft } from '@openheaders/core/types';
import type { DraftUrlStrategy } from '@openheaders/core/utils';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';
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

/** "New API Response Rule" deduped against existing rule names — same
 *  scheme as the workbench's `generateDraftName`. */
export function generateResponseRuleName(rules: ReadonlyArray<{ name: string }>): string {
  const baseName = 'New API Response Rule';
  const existing = new Set(rules.map((r) => r.name));
  if (!existing.has(baseName)) return baseName;
  let counter = 2;
  while (existing.has(`${baseName} (${counter})`)) counter++;
  return `${baseName} (${counter})`;
}

/**
 * Build the full rule seed for `applyRuleCreate`. Conditions derive
 * from the draft's URL (per the workspace's draft-URL strategy) and
 * captured request methods — the same derivation the workbench applies
 * to an inspector handoff draft.
 */
export function buildResponseRuleSeed(
  draft: ResponseRuleDraft,
  quick: ResponseQuickDraft,
  name: string,
  strategy: DraftUrlStrategy,
): ResponseRuleSeed {
  return {
    name,
    enabled: true,
    type: 'response',
    conditions: buildDraftConditions(draft, strategy),
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

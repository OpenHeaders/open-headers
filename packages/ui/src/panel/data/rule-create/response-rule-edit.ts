/**
 * Pure builder for the response editors' Save payload — shared by the
 * quick popover and the rule-editor tab document. Same contract as
 * `header-mod-edit.ts`: the edit is ATOMIC — the full new value is
 * committed in one gesture, never streamed per-keystroke — so a
 * published rule must carry `published: true` in the SAME batch. An
 * explicit `published` in the update is read as the publication
 * gesture, skipping `applyRuleUpdate`'s streaming-edit auto-unpublish,
 * so the tweaked override takes effect on the next request instead of
 * silently dropping the rule to draft.
 *
 * The draft body is WIRE text (`FormatAwareBodyEditor` encodes per
 * edit; Raw mode is verbatim), so it stores AS IS — a re-encode here
 * would re-profile a deliberate Raw-mode edit.
 */

import type { ResponseRule, RuleCondition } from '@openheaders/core/types';

export interface ResponseQuickDraft {
  statusCode: number;
  contentType: string;
  responseBody: string;
}

/** `conditions` joins the batch only when the Conditions row is dirty —
 *  an untouched row never clobbers a concurrent conditions edit from
 *  another surface. */
export function buildResponseRuleWireUpdate(
  rule: ResponseRule,
  draft: ResponseQuickDraft,
  conditions?: RuleCondition[],
): Partial<ResponseRule> {
  return {
    action: {
      ...rule.action,
      statusCode: draft.statusCode,
      contentType: draft.contentType,
      responseBody: draft.responseBody,
    },
    ...(conditions ? { conditions } : {}),
    // Keep a published rule published in the SAME batch (see file header).
    ...(rule.published === true ? { published: true } : {}),
  };
}

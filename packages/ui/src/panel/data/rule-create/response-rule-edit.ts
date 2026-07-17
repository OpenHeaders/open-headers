/**
 * Pure builder for the inspector response quick-editor's Save payload.
 * Same contract as `header-mod-edit.ts`: the popover is an ATOMIC edit —
 * the full new value is committed in one gesture, never streamed
 * per-keystroke — so a published rule must carry `published: true` in
 * the SAME batch. An explicit `published` in the update is read as the
 * publication gesture, skipping `applyRuleUpdate`'s streaming-edit
 * auto-unpublish, so the tweaked override takes effect on the next
 * request instead of silently dropping the rule to draft.
 *
 * The draft body is the popover's formatted VIEW; the update re-encodes
 * it against the rule's stored body (`encodeBodyForWire`): untouched
 * view ⇒ the stored bytes exactly, edited view ⇒ the stored body's
 * serialization profile.
 */

import type { ResponseRule, RuleCondition } from '@openheaders/core/types';
import { encodeBodyForWire } from '@openheaders/ui/shared/body-format';

export interface ResponseQuickDraft {
  statusCode: number;
  contentType: string;
  responseBody: string;
}

/** `conditions` joins the batch only when the popover's Conditions row
 *  is dirty — an untouched row never clobbers a concurrent conditions
 *  edit from another surface. */
export function buildResponseRuleUpdate(
  rule: ResponseRule,
  draft: ResponseQuickDraft,
  conditions?: RuleCondition[],
): Partial<ResponseRule> {
  return {
    action: {
      ...rule.action,
      statusCode: draft.statusCode,
      contentType: draft.contentType,
      responseBody: encodeBodyForWire(rule.action.responseBody, draft.responseBody),
    },
    ...(conditions ? { conditions } : {}),
    // Keep a published rule published in the SAME batch (see file header).
    ...(rule.published === true ? { published: true } : {}),
  };
}

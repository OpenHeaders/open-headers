/**
 * Pure builder for the inspector response quick-editor's Save payload.
 * Same contract as `header-mod-edit.ts`: the popover is an ATOMIC edit —
 * the full new value is committed in one gesture, never streamed
 * per-keystroke — so a published rule must carry `published: true` in
 * the SAME batch. An explicit `published` in the update is read as the
 * publication gesture, skipping `applyRuleUpdate`'s streaming-edit
 * auto-unpublish, so the tweaked override takes effect on the next
 * request instead of silently dropping the rule to draft.
 */

import type { ResponseRule } from '@openheaders/core/types';

export interface ResponseQuickDraft {
  statusCode: number;
  contentType: string;
  responseBody: string;
}

export function buildResponseRuleUpdate(rule: ResponseRule, draft: ResponseQuickDraft): Partial<ResponseRule> {
  return {
    action: {
      ...rule.action,
      statusCode: draft.statusCode,
      contentType: draft.contentType,
      responseBody: draft.responseBody,
    },
    // Keep a published rule published in the SAME batch (see file header).
    ...(rule.published === true ? { published: true } : {}),
  };
}

/**
 * Pure builder for the inspector redirect quick-editor's Save payload.
 * Same contract as `response-rule-edit.ts`: the popover is an ATOMIC edit —
 * the full new target is committed in one gesture, never streamed
 * per-keystroke — so a published rule must carry `published: true` in
 * the SAME batch. An explicit `published` in the update is read as the
 * publication gesture, skipping `applyRuleUpdate`'s streaming-edit
 * auto-unpublish, so the retargeted redirect takes effect on the next
 * request instead of silently dropping the rule to draft.
 */

import type { RedirectRule, RuleCondition } from '@openheaders/core/types';

export interface RedirectQuickEditDraft {
  redirectTo: string;
}

/** `conditions` joins the batch only when the popover's Conditions row
 *  is dirty — an untouched row never clobbers a concurrent conditions
 *  edit from another surface. */
export function buildRedirectRuleUpdate(
  rule: RedirectRule,
  draft: RedirectQuickEditDraft,
  conditions?: RuleCondition[],
): Partial<RedirectRule> {
  return {
    action: {
      ...rule.action,
      redirectTo: draft.redirectTo,
    },
    ...(conditions ? { conditions } : {}),
    // Keep a published rule published in the SAME batch (see file header).
    ...(rule.published === true ? { published: true } : {}),
  };
}

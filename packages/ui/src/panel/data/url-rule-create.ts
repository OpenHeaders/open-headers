/**
 * Pure builders for the inspector URL-action quick-editors' CREATE mode
 * — redirect, delay, and block. Counterpart of `header-rule-create.ts` /
 * `response-rule-create.ts` for the Headers tab's CTA row: the popover's
 * Save is the publication gesture — the caller creates the rule from
 * this seed and publishes it in the same flow. Conditions derive from
 * the captured draft (URL per strategy + request methods, when present).
 */

import type {
  BlockRule,
  BlockRuleDraft,
  DelayRule,
  DelayRuleDraft,
  RedirectRule,
  RedirectRuleDraft,
} from '@openheaders/core/types';
import type { DraftUrlStrategy } from '@openheaders/core/utils';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';
import { generateQuickRuleName } from './quick-rule-name';

export type RedirectRuleSeed = Omit<RedirectRule, 'uid' | 'path' | 'schemaVersion'>;
export type DelayRuleSeed = Omit<DelayRule, 'uid' | 'path' | 'schemaVersion'>;
export type BlockRuleSeed = Omit<BlockRule, 'uid' | 'path' | 'schemaVersion'>;

// ── Redirect ────────────────────────────────────────────────────────

export interface RedirectQuickDraft {
  redirectTo: string;
}

/** Seed the editable field from the captured draft — the three CTA
 *  variants (Redirect URL / Replace host / Replace URL part) differ
 *  only in what `rule-draft-bridge` put here. */
export function seedRedirectQuickDraft(draft: RedirectRuleDraft): RedirectQuickDraft {
  return { redirectTo: draft.redirectTo ?? '' };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoRedirectDraft(draft: RedirectRuleDraft, quick: RedirectQuickDraft): RedirectRuleDraft {
  return { ...draft, redirectTo: quick.redirectTo };
}

/** "New Redirect Rule" deduped against existing rule names. */
export function generateRedirectRuleName(rules: ReadonlyArray<{ name: string }>): string {
  return generateQuickRuleName('New Redirect Rule', rules);
}

export function buildRedirectRuleSeed(
  draft: RedirectRuleDraft,
  quick: RedirectQuickDraft,
  name: string,
  strategy: DraftUrlStrategy,
): RedirectRuleSeed {
  return {
    name,
    enabled: true,
    type: 'redirect',
    conditions: buildDraftConditions(draft, strategy),
    action: { redirectTo: quick.redirectTo },
  };
}

// ── Delay ───────────────────────────────────────────────────────────

export interface DelayQuickDraft {
  /** Null while the number input is cleared — the save gate blocks. */
  delayMs: number | null;
}

export function seedDelayQuickDraft(draft: DelayRuleDraft): DelayQuickDraft {
  return { delayMs: draft.delayMs ?? 1000 };
}

export function mergeQuickIntoDelayDraft(draft: DelayRuleDraft, quick: DelayQuickDraft): DelayRuleDraft {
  return { ...draft, ...(quick.delayMs != null ? { delayMs: quick.delayMs } : {}) };
}

/** "New Delay Rule" deduped against existing rule names. */
export function generateDelayRuleName(rules: ReadonlyArray<{ name: string }>): string {
  return generateQuickRuleName('New Delay Rule', rules);
}

export function buildDelayRuleSeed(
  draft: DelayRuleDraft,
  delayMs: number,
  name: string,
  strategy: DraftUrlStrategy,
): DelayRuleSeed {
  return {
    name,
    enabled: true,
    type: 'delay',
    conditions: buildDraftConditions(draft, strategy),
    action: { delayMs },
  };
}

// ── Block ───────────────────────────────────────────────────────────

/** "New Block Rule" deduped against existing rule names. */
export function generateBlockRuleName(rules: ReadonlyArray<{ name: string }>): string {
  return generateQuickRuleName('New Block Rule', rules);
}

/** Block has no editable fields — the block itself is the action;
 *  conditions decide what gets blocked. */
export function buildBlockRuleSeed(draft: BlockRuleDraft, name: string, strategy: DraftUrlStrategy): BlockRuleSeed {
  return {
    name,
    enabled: true,
    type: 'block',
    conditions: buildDraftConditions(draft, strategy),
    action: {},
  };
}

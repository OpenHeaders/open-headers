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
import { domainFolderName } from './quick-rule-destination';

export type RedirectRuleSeed = Omit<RedirectRule, 'uid' | 'path' | 'schemaVersion'>;
export type DelayRuleSeed = Omit<DelayRule, 'uid' | 'path' | 'schemaVersion'>;
export type BlockRuleSeed = Omit<BlockRule, 'uid' | 'path' | 'schemaVersion'>;

/** Which CTA opened a URL-action create session. The three redirect
 *  variants share a rule type but seed different targets (and name
 *  themselves differently), so the variant — not the type — is the
 *  per-request session discriminator. */
export type RedirectCreateVariant = 'redirect' | 'replace-host' | 'replace-url-part';
export type UrlCreateVariant = RedirectCreateVariant | 'delay' | 'block';

// ── Redirect ────────────────────────────────────────────────────────

export interface RedirectQuickDraft {
  redirectTo: string;
}

/** Domain-scoped variable name for the plain Redirect URL variant's
 *  seed — `redirect_url_openheaders_io` — so redirect targets are
 *  reusable per domain and don't collide across rules for other sites. */
export function redirectVarName(url: string): string | null {
  const domain = domainFolderName(url);
  if (!domain) return null;
  return `redirect_url_${domain.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

/** Seed the editable field from the captured draft. The Replace host /
 *  Replace URL part variants carry their pre-built target; the plain
 *  Redirect URL variant (empty target) seeds a `{{redirect_url_<domain>}}`
 *  reference instead — if the variable already exists it resolves
 *  immediately (reuse), otherwise the popover's save gate holds until
 *  the user creates it via the reference's create flow. */
export function seedRedirectQuickDraft(
  draft: RedirectRuleDraft,
  variant: RedirectCreateVariant = 'redirect',
): RedirectQuickDraft {
  const captured = draft.redirectTo ?? '';
  if (variant === 'redirect' && !captured) {
    const varName = redirectVarName(draft.url ?? '');
    if (varName) return { redirectTo: `{{${varName}}}` };
  }
  return { redirectTo: captured };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoRedirectDraft(draft: RedirectRuleDraft, quick: RedirectQuickDraft): RedirectRuleDraft {
  return { ...draft, redirectTo: quick.redirectTo };
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

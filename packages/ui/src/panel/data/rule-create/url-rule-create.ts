/**
 * Pure builders for the inspector URL-action quick-editors' CREATE mode
 * — redirect, delay, and block. Counterpart of `header-rule-create.ts` /
 * `response-rule-create.ts` for the Headers tab's CTA row: the popover's
 * Save is the publication gesture — the caller creates the rule from
 * this seed and publishes it in the same flow. Conditions pass through
 * unchanged from the popover's Conditions row (seeded via
 * `buildDraftConditions`, edited in place).
 */

import type {
  BlockRule,
  DelayRule,
  DelayRuleDraft,
  RedirectRule,
  RedirectRuleDraft,
  RuleCondition,
} from '@openheaders/core/types';
import { domainFolderName } from './quick-rule-destination';

export type RedirectRuleSeed = Omit<RedirectRule, 'uid' | 'path' | 'schemaVersion'>;
export type DelayRuleSeed = Omit<DelayRule, 'uid' | 'path' | 'schemaVersion'>;
export type BlockRuleSeed = Omit<BlockRule, 'uid' | 'path' | 'schemaVersion'>;

/** Which menu entry opened a redirect create session. The variants
 *  share a rule type but seed different targets (and name themselves
 *  differently), so the variant — not the type — is the per-request
 *  session discriminator. */
export type RedirectCreateVariant = 'redirect' | 'replace-host' | 'localhost';
export type UrlCreateVariant = RedirectCreateVariant | 'delay' | 'block';

// ── Redirect ────────────────────────────────────────────────────────

export interface RedirectQuickDraft {
  redirectTo: string;
}

function domainVarName(prefix: string, url: string): string | null {
  const domain = domainFolderName(url);
  if (!domain) return null;
  return `${prefix}_${domain.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

/** Domain-scoped variable name for the plain Redirect URL variant's
 *  seed — `redirect_url_openheaders_io` — so redirect targets are
 *  reusable per domain and don't collide across rules for other sites. */
export function redirectVarName(url: string): string | null {
  return domainVarName('redirect_url', url);
}

/** Domain-scoped variable name for the Replace host variant's seed —
 *  `new_host_openheaders_io` — so every replace-host rule for a domain
 *  shares one retargetable host variable. */
export function newHostVarName(url: string): string | null {
  return domainVarName('new_host', url);
}

/** Domain-scoped variable name for the Point-to-localhost variant's
 *  seed — `port_localhost_openheaders_io`, holding just the local port
 *  (e.g. `5173`) — so every localhost rule for a domain shares one
 *  retargetable dev-server port variable. */
export function localhostPortVarName(url: string): string | null {
  return domainVarName('port_localhost', url);
}

/** Seed the editable field from the captured draft. An empty target
 *  seeds a domain-scoped variable reference per variant — the plain
 *  Redirect URL variant as the whole target (`{{redirect_url_<domain>}}`),
 *  Replace host as the host slot of the captured URL
 *  (`https://{{new_host_<domain>}}/path?query`) so path and query are
 *  preserved verbatim, and Point to localhost as a literal localhost
 *  host with only the port templated
 *  (`http://localhost:{{port_localhost_<domain>}}/path?query`) — the
 *  host IS the menu entry's promise, the port is the only unknown, and
 *  local dev servers rarely speak TLS. If the variable already exists
 *  it resolves immediately (reuse), otherwise the popover's save gate
 *  holds until the user creates it via the reference's create flow. */
export function seedRedirectQuickDraft(
  draft: RedirectRuleDraft,
  variant: RedirectCreateVariant = 'redirect',
): RedirectQuickDraft {
  const captured = draft.redirectTo ?? '';
  if (captured) return { redirectTo: captured };
  if (variant === 'redirect') {
    const varName = redirectVarName(draft.url ?? '');
    if (varName) return { redirectTo: `{{${varName}}}` };
  }
  if (variant === 'replace-host' || variant === 'localhost') {
    const varName = variant === 'localhost' ? localhostPortVarName(draft.url ?? '') : newHostVarName(draft.url ?? '');
    if (varName) {
      try {
        const u = new URL(draft.url ?? '');
        const hostSlot = variant === 'localhost' ? `http://localhost:{{${varName}}}` : `${u.protocol}//{{${varName}}}`;
        return { redirectTo: `${hostSlot}${u.pathname}${u.search}${u.hash}` };
      } catch {
        // non-URL captures fall through to the empty seed
      }
    }
  }
  return { redirectTo: captured };
}

/** Fold the popover's edit back into the handoff draft so the "Open in
 *  workspace" link carries the CURRENT form state. */
export function mergeQuickIntoRedirectDraft(draft: RedirectRuleDraft, quick: RedirectQuickDraft): RedirectRuleDraft {
  return { ...draft, redirectTo: quick.redirectTo };
}

export function buildRedirectRuleSeed(
  quick: RedirectQuickDraft,
  name: string,
  conditions: RuleCondition[],
): RedirectRuleSeed {
  return {
    name,
    enabled: true,
    type: 'redirect',
    conditions,
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

export function buildDelayRuleSeed(delayMs: number, name: string, conditions: RuleCondition[]): DelayRuleSeed {
  return {
    name,
    enabled: true,
    type: 'delay',
    conditions,
    action: { delayMs },
  };
}

// ── Block ───────────────────────────────────────────────────────────

/** Block has no editable fields — the block itself is the action;
 *  conditions decide what gets blocked. */
export function buildBlockRuleSeed(name: string, conditions: RuleCondition[]): BlockRuleSeed {
  return {
    name,
    enabled: true,
    type: 'block',
    conditions,
    action: {},
  };
}

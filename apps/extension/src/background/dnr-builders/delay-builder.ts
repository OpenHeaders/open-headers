/**
 * Delay compiler — converts V5.DelayRule into a CompilationPlan.
 *
 * A delay rule has TWO execution paths that coexist:
 *
 *   1. **Scriptable XHR/fetch monkey-patch** — for JS-initiated requests.
 *      inject-manager executes this in the page's MAIN world; it wraps
 *      fetch and XMLHttpRequest.send with setTimeout. Capped at 5000ms
 *      to avoid HTTP connection-pool starvation (fetch held open still
 *      occupies a connection slot).
 *
 *   2. **DNR redirect to the extension's delay.html** — for main_frame
 *      and sub_frame navigations (browser-initiated HTTP requests that
 *      the monkey-patch can never see because it lives inside the page's
 *      JS context). The redirect sends the navigation to delay.html,
 *      which shows a branded countdown and then navigates to the real
 *      target via location.replace. This lives in the SESSION layer
 *      because it needs `excludedTabIds` for loop-prevention bypass, and
 *      Chrome only allows that field on session-scoped workbench.
 *
 * Sub-resources (CSS/JS/images/fonts) are not delayed at all in the
 * standalone extension — delaying them would need a real local proxy
 * that can hold the connection open and then stream the actual bytes.
 * That's a future desktop-app integration.
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import type { CompilationPlan, CompilerContext, DnrCondition, DnrRule, RuleCompiler } from './types';
import { buildDnrCondition, resolveResourceTypes, stripResourceTypeFields } from './types';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Priority is deliberately LOW (below user's own header, redirect, block
// workbench). Redirect is terminal, but modifyHeaders workbench stack regardless
// of priority, so users' header workbench keep applying to the redelivered
// URL. Explicit user redirect/block at higher priority wins over our
// delay redirect — if the user blocks a domain, the block fires and we
// never delay.
const DELAY_PRIORITY = 2;

/** Hard cap for the DNR-redirect main-frame path. Kept in sync with the UI input. */
const DNR_DELAY_MAX_MS = 30_000;

/** Lazy-evaluated so tests can mock `chrome.runtime.getURL`. */
function getDelayPageUrl(): string {
  try {
    return browserAPI.runtime.getURL('delay.html');
  } catch {
    return 'delay.html';
  }
}

/** Escape a literal string so it can be embedded in an RE2 regex. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a Chrome DNR `urlFilter` glob into a regex fragment.
 * Supports `*` (any) and `|` at start / end as anchors; everything else is
 * treated as a literal. Best-effort conversion — `||host` subdomain anchors
 * are treated as literals and may under-match.
 */
function urlFilterToRegex(filter: string): string {
  let pattern = filter;
  let anchorStart = false;
  let anchorEnd = false;
  if (pattern.startsWith('|')) {
    anchorStart = true;
    pattern = pattern.slice(1);
  }
  if (pattern.endsWith('|')) {
    anchorEnd = true;
    pattern = pattern.slice(0, -1);
  }
  const escaped = pattern
    .split('*')
    .map((seg) => escapeRegex(seg))
    .join('.*');
  return (anchorStart ? '^' : '') + escaped + (anchorEnd ? '$' : '');
}

export const delayCompiler: RuleCompiler<V5.DelayRule> = {
  ruleType: 'delay',
  compile(rule: V5.DelayRule, ctx: CompilerContext): CompilationPlan {
    const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

    if (domains.length === 0 && !urlPattern) {
      logger.debug('DelayCompiler', `Skipping rule "${rule.name}" — no matching conditions`);
      return {};
    }

    const delayMs = Math.max(0, Math.min(Math.floor(rule.action.delayMs), DNR_DELAY_MAX_MS));
    if (delayMs === 0) {
      logger.debug('DelayCompiler', `Skipping rule "${rule.name}" — delay is 0`);
      return {};
    }

    // Note: the scriptable monkey-patch for JS-initiated XHR/fetch is
    // NOT emitted here — inject-manager reads delay workbench directly from
    // the rule store and installs the MAIN-world monkey-patch on each
    // main-frame commit, independent of this compilation plan.

    // Delay DNR workbench can only meaningfully act on main_frame and sub_frame —
    // sub-resources need a real proxy that can hold the connection open, not
    // an extension-page redirect. The resolver folds that capability set with
    // any user resource-type filters. If nothing supported survives, skip the
    // rule (the scriptable XHR/fetch monkey-patch in inject-manager still runs
    // independently).
    const DELAY_CAPABILITY: chrome.declarativeNetRequest.ResourceType[] = [
      'main_frame' as chrome.declarativeNetRequest.ResourceType,
      'sub_frame' as chrome.declarativeNetRequest.ResourceType,
    ];
    const resourceTypes = resolveResourceTypes(DELAY_CAPABILITY, base.resourceTypes, base.excludedResourceTypes);
    if (!resourceTypes) {
      logger.debug(
        'DelayCompiler',
        `Skipping rule "${rule.name}" — resource-type filter excludes everything delayable`,
      );
      return {};
    }
    const cleanBase = stripResourceTypeFields(base);

    const delayUrl = getDelayPageUrl();
    // `\\0` is the whole matched portion of the regex — we wrap every
    // pattern below so the match spans the full URL, then drop it into
    // the fragment of the delay page target. Fragments are preserved
    // literally by Chrome DNR's regexSubstitution and never collide with
    // our own query string on delay.html.
    const regexSubstitution = `${delayUrl}?ms=${delayMs}#\\0`;

    const sessionRules: DnrRule[] = [];
    const makeFullMatchRegex = (innerRegex: string): string => `^.*(?:${innerRegex}).*$`;

    if (urlPattern) {
      const innerRegex = useRegex ? urlPattern : urlFilterToRegex(urlPattern);
      const condition: DnrCondition = {
        ...cleanBase,
        regexFilter: makeFullMatchRegex(innerRegex),
        resourceTypes,
      };
      sessionRules.push({
        id: ctx.allocateId(),
        priority: DELAY_PRIORITY,
        action: { type: 'redirect', redirect: { regexSubstitution } },
        condition,
      });
    } else {
      // request-domains path: one rule covering all listed domains. Domains
      // go into DNR's native `requestDomains` filter and we use a
      // match-everything regex to capture the full URL for substitution.
      const condition: DnrCondition = {
        ...cleanBase,
        requestDomains: domains,
        regexFilter: '^.*$',
        resourceTypes,
      };
      sessionRules.push({
        id: ctx.allocateId(),
        priority: DELAY_PRIORITY,
        action: { type: 'redirect', redirect: { regexSubstitution } },
        condition,
      });
    }

    return { sessionRules };
  },
};

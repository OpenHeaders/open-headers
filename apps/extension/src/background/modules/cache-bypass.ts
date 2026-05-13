/**
 * Per-tab cache-bypass DNR rule — the background half of the panel's
 * "Disable Cache" toolbar toggle.
 *
 * Chrome's Network-panel "Disable cache" uses `Network.setCacheDisabled`
 * via CDP, which we can't invoke without the debugger API (and the
 * yellow "started debugging this browser" banner that comes with it).
 *
 * The best DNR-only approximation: install a session-layer rule
 * scoped to a single tab that appends `Cache-Control: no-cache` and
 * `Pragma: no-cache` to every outgoing request. Chrome honors the
 * request's `no-cache` directive by forcing a revalidation round-trip
 * to the server — the observable result (fresh responses) matches
 * what users actually want from "disable cache".
 *
 * What's different from Chrome's native version:
 *   - Chrome bypasses its HTTP cache at the network stack level before
 *     any request goes out. We let the request go out with a
 *     revalidation hint; the server typically answers fresh (200
 *     with new body) but may answer 304 if nothing changed — in
 *     which case Chrome still serves from its cache copy.
 *   - For offline-only cached responses (e.g. service-worker-served
 *     content) we don't intercept at all.
 *
 * Rule ID range: `CACHE_BYPASS_ID_BASE + tabId`. Well above the
 * session-rule space used by test runs (1_000_000+) so `rebuildAll`
 * can preserve these rules across updates — see the carve-out in
 * `applySessionRules` in `dnr-manager.ts`.
 */

import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { CACHE_BYPASS_ID_BASE } from '@openheaders/rule-engine';

export { CACHE_BYPASS_ID_BASE };

function ruleIdForTab(tabId: number): number {
  return CACHE_BYPASS_ID_BASE + tabId;
}

function buildCacheBypassRule(tabId: number): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleIdForTab(tabId),
    priority: 1,
    action: {
      type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [
        {
          operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
          header: 'cache-control',
          value: 'no-cache',
        },
        {
          operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
          header: 'pragma',
          value: 'no-cache',
        },
      ],
    },
    // No `resourceTypes` — DNR treats the field as "every resource
    // type" when omitted. This future-proofs against Chrome adding
    // new types (webtransport, webbundle, etc.) without us having to
    // update a hardcoded enumeration.
    condition: {
      tabIds: [tabId],
    },
  };
}

/** Tabs currently running with a cache-bypass rule. Kept here so
 *  `applySessionRules` can preserve them across rule-rebuild passes. */
const activeTabs = new Set<number>();

export function isCacheBypassActive(tabId: number): boolean {
  return activeTabs.has(tabId);
}

export function getActiveCacheBypassTabIds(): readonly number[] {
  return [...activeTabs];
}

export async function enableCacheBypassForTab(tabId: number): Promise<void> {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules) {
    logger.info('CacheBypass', 'updateSessionRules unavailable — cache bypass ignored');
    return;
  }
  const id = ruleIdForTab(tabId);
  try {
    await dnr.updateSessionRules({
      removeRuleIds: [id],
      addRules: [buildCacheBypassRule(tabId)],
    });
    activeTabs.add(tabId);
    logger.debug('CacheBypass', `Enabled for tab ${tabId}`);
  } catch (err) {
    logger.error('CacheBypass', `Failed to enable for tab ${tabId}: ${(err as Error).message}`);
  }
}

export async function disableCacheBypassForTab(tabId: number): Promise<void> {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules) return;
  const id = ruleIdForTab(tabId);
  try {
    await dnr.updateSessionRules({
      removeRuleIds: [id],
      addRules: [],
    });
    activeTabs.delete(tabId);
    logger.debug('CacheBypass', `Disabled for tab ${tabId}`);
  } catch (err) {
    logger.error('CacheBypass', `Failed to disable for tab ${tabId}: ${(err as Error).message}`);
  }
}

/**
 * Tab-close cleanup. Session rules are NOT tied to tab lifetime — a
 * rule with `tabIds: [closed-tab-id]` simply becomes inert and
 * lingers in the session rule store until the browser closes. Over
 * a long browser session with many tab open/close cycles that's a
 * small DNR leak (capped at 5000 session rules). Remove the rule
 * explicitly so the session store stays tidy.
 */
export async function forgetCacheBypassForTab(tabId: number): Promise<void> {
  if (!activeTabs.has(tabId)) return;
  await disableCacheBypassForTab(tabId);
}

/**
 * Rebuild `activeTabs` from Chrome's session rule store on SW wake.
 * Rules in the `CACHE_BYPASS_ID_BASE` range that we installed before
 * the worker was terminated are still live — they just don't appear
 * in our in-memory tracking set after a cold start. Without this
 * rehydration, `forgetCacheBypassForTab` would no-op on tab close
 * and the rule would linger inert until the browser closes.
 *
 * Call once at SW startup, after the rule engine has initialized.
 * Safe no-op when `updateSessionRules` isn't supported.
 */
export async function rehydrateCacheBypassFromSessionRules(): Promise<void> {
  const dnr = declarativeNetRequest;
  if (!dnr?.getSessionRules) return;
  try {
    const existing = await dnr.getSessionRules();
    for (const rule of existing) {
      if (rule.id >= CACHE_BYPASS_ID_BASE) {
        const tabId = rule.id - CACHE_BYPASS_ID_BASE;
        if (tabId > 0) activeTabs.add(tabId);
      }
    }
    if (activeTabs.size > 0) {
      logger.info('CacheBypass', `Rehydrated ${activeTabs.size} active tab(s) from session rules`);
    }
  } catch (err) {
    logger.info('CacheBypass', `Rehydration failed: ${(err as Error).message}`);
  }
}

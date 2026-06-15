/**
 * Inject Manager — applies rules that require chrome.scripting API.
 *
 * Handles 6 rule types that can't use declarativeNetRequest:
 *   - inject: user-authored JS/CSS injection
 *   - delay: monkey-patches fetch/XHR with setTimeout
 *   - body: monkey-patches fetch/XHR to modify request/response bodies
 *   - response: monkey-patches fetch/XHR to synthesize or rewrite responses
 *   - ws: wraps the WebSocket constructor to modify/inject/drop frames
 *   - sse: wraps the EventSource constructor to modify/inject/drop events
 *
 * Architecture:
 * - Keeps the current set of scriptable rules in memory
 * - Listens to webNavigation.onCommitted for main frame navigations
 * - For each navigation, checks URL matches and injects appropriate scripts
 * - delay/body/response inject at document_start (before page JS runs)
 * - inject rules respect their configured position
 */

declare const browser: typeof chrome | undefined;

import type {
  DelayRule,
  HeaderRule,
  InjectRule,
  RequestBodyRule,
  ResponseRule,
  Rule,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import { compileRuleForInjection, doesHostMatchDomains, doesUrlMatchRule } from '@openheaders/core/utils';
import {
  buildDelayInjection,
  buildHeaderMergeInjection,
  buildRequestBodyInjection,
  buildResetInjection,
  buildResponseInjection,
  buildSetupInjection,
  buildSseInjection,
  buildWsInjection,
} from '@openheaders/rule-engine/content-scripts';
import {
  applyInjection,
  injectCSS,
  injectCSSUrl,
  injectScript,
  injectScriptUrl,
} from '@openheaders/rule-engine/inject';
import { logger } from '@utils/logger';
import { getTestScopeForTab, isRuleUnderTest } from './modules/test-runner';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/** Response/request-body/delay rules: their URL conditions target REQUEST urls. */
type InterceptorRule = DelayRule | RequestBodyRule | ResponseRule;

/**
 * Page-install gate for rules whose URL conditions match REQUEST /
 * connection urls (tested in-page by the interceptor), not page urls.
 * Only initiator-domain conditions legitimately gate WHERE the
 * interceptor installs — for fetch/XHR/WebSocket/EventSource issued by a
 * page, the initiator IS the page origin.
 */
interface PageInstallGate {
  /**
   * Regex sources pre-compiled from the rule's URL conditions. Empty
   * array means the rule has no URL conditions and should not match any
   * request.
   */
  regexSources: string[];
  initiatorDomains: string[];
  excludedInitiatorDomains: string[];
}

/** A header merge operation extracted from a HeaderRule. */
interface HeaderMergeEntry extends PageInstallGate {
  ruleUid: string;
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
}

/** A ws/sse rule paired with its pre-compiled install gate. */
interface MessageRuleEntry extends PageInstallGate {
  rule: WsRule | SseRule;
}

/** A response/body/delay rule paired with its pre-compiled install gate. */
interface InterceptorRuleEntry extends PageInstallGate {
  rule: InterceptorRule;
}

let activeInjectRules: InjectRule[] = [];
let activeInterceptorRules: InterceptorRuleEntry[] = [];
let activeHeaderMerges: HeaderMergeEntry[] = [];
let activeMessageRules: MessageRuleEntry[] = [];

// Signature of the live-pushable interceptor set (response/body/delay/
// header-merge/ws/sse — NOT inject, which is navigation-only). When it
// changes after the first load, already-open tabs are refreshed in place
// (reset + re-inject) so rule edits/deletes apply without a page reload.
// `null` until the first `updateScriptableRules` so boot doesn't trigger
// a mass push — fresh navigations install the current set anyway.
let lastInterceptorSignature: string | null = null;

function defaultSeparator(headerName: string): string {
  const lower = headerName.toLowerCase();
  return lower === 'cookie' || lower === 'set-cookie' ? '; ' : ', ';
}

/**
 * Extract the merge operations from a HeaderRule. Returns null if the
 * rule has no merges — caller should skip installing an injection in that
 * case. This lives here (not in the header compiler) because header merge
 * injection is strictly a scriptable concern — inject-manager reads it
 * from the rule store, never from a compiled plan.
 */
/**
 * Skip a merge mod whose template fields didn't fully resolve at
 * compile time. Mirrors the header-compiler's per-mod guard: if any of
 * the strings the page would inject still contains `{{`, the SW
 * resolver couldn't satisfy a reference (TOTP in `reject` mode, broken
 * var, missing env). Shipping the literal would inject a `{{...}}`
 * substring into the page's headers — silently wrong. Drop instead.
 */
function isMergeModResolvable(m: { headerName: string; value?: string; mergeSeparator?: string }): boolean {
  if (m.headerName.includes('{{')) return false;
  if (typeof m.value === 'string' && m.value.includes('{{')) return false;
  if (typeof m.mergeSeparator === 'string' && m.mergeSeparator.includes('{{')) return false;
  return true;
}

/** Build the install gate from a rule's conditions (see PageInstallGate). */
function extractInstallGate(rule: Rule): PageInstallGate {
  const initiatorDomains: string[] = [];
  const excludedInitiatorDomains: string[] = [];
  for (const cond of rule.conditions) {
    if (cond.type !== 'initiator-domains' && cond.type !== 'exclude-initiator-domains') continue;
    const target = cond.type === 'initiator-domains' ? initiatorDomains : excludedInitiatorDomains;
    for (const v of cond.values) {
      const trimmed = v.trim();
      if (trimmed) target.push(trimmed);
    }
  }
  return {
    regexSources: compileRuleForInjection(rule),
    initiatorDomains,
    excludedInitiatorDomains,
  };
}

function extractHeaderMergeEntry(rule: HeaderRule): HeaderMergeEntry | null {
  const requestMerges = (rule.action.requestHeaders ?? [])
    .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim() && isMergeModResolvable(m))
    .map((m) => ({
      headerName: m.headerName,
      value: m.value!,
      separator: m.mergeSeparator || defaultSeparator(m.headerName),
    }));
  const responseMerges = (rule.action.responseHeaders ?? [])
    .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim() && isMergeModResolvable(m))
    .map((m) => ({
      headerName: m.headerName,
      value: m.value!,
      separator: m.mergeSeparator || defaultSeparator(m.headerName),
    }));
  if (requestMerges.length === 0 && responseMerges.length === 0) return null;
  return {
    ruleUid: rule.uid,
    ...extractInstallGate(rule),
    requestMerges,
    responseMerges,
  };
}

/** Test-only handle for the unresolved-template guard. */
export const __testExtractHeaderMergeEntry = extractHeaderMergeEntry;

// ── Public API ───────────────────────────────────────────────────

/**
 * Update the set of active scriptable rules. Called by dnr-manager whenever
 * rules change. Accepts every rule with any in-page side effect (inject,
 * delay, body, response, header); header-merge entries are derived from header
 * rules internally so dnr-manager doesn't have to know about them.
 *
 * Returns the uids that actually received an in-page artifact — a header
 * rule without merge operations installs nothing here. dnr-manager folds
 * the set into its effective-fire-uid snapshot.
 */
export function updateScriptableRules(rules: Rule[]): ReadonlySet<string> {
  const injectRules: InjectRule[] = [];
  const interceptorRules: InterceptorRuleEntry[] = [];
  const headerMerges: HeaderMergeEntry[] = [];
  const messageRules: MessageRuleEntry[] = [];
  const installedUids = new Set<string>();
  for (const rule of rules) {
    switch (rule.type) {
      case 'inject':
        injectRules.push(rule);
        installedUids.add(rule.uid);
        break;
      case 'delay':
      case 'request-body':
      case 'response':
        interceptorRules.push({ rule, ...extractInstallGate(rule) });
        installedUids.add(rule.uid);
        break;
      case 'header': {
        const merge = extractHeaderMergeEntry(rule);
        if (merge) {
          headerMerges.push(merge);
          installedUids.add(rule.uid);
        }
        break;
      }
      case 'ws':
      case 'sse':
        messageRules.push({ rule, ...extractInstallGate(rule) });
        installedUids.add(rule.uid);
        break;
    }
  }
  activeInjectRules = injectRules;
  activeInterceptorRules = interceptorRules;
  activeHeaderMerges = headerMerges;
  activeMessageRules = messageRules;
  const scriptableCount = injectRules.length + interceptorRules.length;
  if (scriptableCount > 0 || headerMerges.length > 0 || messageRules.length > 0) {
    const summary = [...injectRules, ...interceptorRules.map((e) => e.rule)]
      .map((r) => `${r.type}:${r.name}`)
      .join(', ');
    logger.info(
      'InjectManager',
      `Updated scriptable rules: ${scriptableCount} active (${summary}), ${headerMerges.length} header merges, ${messageRules.length} ws/sse`,
    );
  } else {
    logger.debug('InjectManager', 'Updated scriptable rules: 0 active');
  }

  // Live-update already-open tabs when the interceptor set changes. Skip
  // the first call (boot): `null` signature means navigation will install
  // the current set as tabs load, so there's nothing stale to refresh.
  const signature = interceptorSignature(interceptorRules, headerMerges, messageRules);
  if (lastInterceptorSignature !== null && signature !== lastInterceptorSignature) {
    void pushInterceptorUpdate();
  }
  lastInterceptorSignature = signature;

  return installedUids;
}

/**
 * Content-shaped fingerprint of the live-pushable interceptor set. Two
 * rebuilds with identical interceptor content produce the same string,
 * so a DNR-only change (or a no-op rebuild) never triggers a push.
 */
function interceptorSignature(
  interceptors: InterceptorRuleEntry[],
  headerMerges: HeaderMergeEntry[],
  messageRules: MessageRuleEntry[],
): string {
  const gate = (e: PageInstallGate) => ({
    r: e.regexSources,
    i: e.initiatorDomains,
    x: e.excludedInitiatorDomains,
  });
  return JSON.stringify({
    i: interceptors.map((e) => ({ u: e.rule.uid, a: e.rule.action, ...gate(e) })),
    h: headerMerges.map((e) => ({ u: e.ruleUid, q: e.requestMerges, s: e.responseMerges, ...gate(e) })),
    m: messageRules.map((e) => ({ u: e.rule.uid, a: e.rule.action, ...gate(e) })),
  });
}

/**
 * Set up the navigation listener that triggers injection.
 * Call once during extension initialization.
 */
export function setupInjectListener(): void {
  if (!browserAPI.webNavigation?.onCommitted) {
    logger.info('InjectManager', 'webNavigation API not available — inject rules disabled');
    return;
  }

  browserAPI.webNavigation.onCommitted.addListener(
    (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      // Main frame only
      if (details.frameId !== 0) return;
      if (
        activeInjectRules.length === 0 &&
        activeInterceptorRules.length === 0 &&
        activeHeaderMerges.length === 0 &&
        activeMessageRules.length === 0
      )
        return;

      void injectForUrl(details.tabId, details.url);
    },
  );

  logger.info('InjectManager', 'Navigation listener registered');
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Install-time gate for interceptor injections (header-merge, ws, sse).
 * The gate's URL conditions target REQUEST / connection urls and are
 * matched in-page by the interceptor — they say nothing about which
 * pages can originate a matching request, so they never gate
 * installation. The only page-level conditions are the initiator-domain
 * rows: a page's fetch/XHR/WebSocket/EventSource requests carry its
 * origin as initiator, so gating install on the page host mirrors
 * Chrome's initiatorDomains semantics exactly.
 */
function shouldInstallForPage(gate: PageInstallGate, pageUrl: string): boolean {
  if (gate.regexSources.length === 0) return false;
  let host: string | null;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    host = null;
  }
  if (gate.excludedInitiatorDomains.length > 0 && host !== null) {
    if (doesHostMatchDomains(host, gate.excludedInitiatorDomains)) return false;
  }
  if (gate.initiatorDomains.length > 0) {
    return host !== null && doesHostMatchDomains(host, gate.initiatorDomains);
  }
  return true;
}

/** Test-only handle for the install gate. */
export const __testShouldInstallForPage = shouldInstallForPage;

// ── Injection logic ──────────────────────────────────────────────

/**
 * Log an injection failure, swallowing the benign "tab closed / not yet
 * accessible" races that fire when a navigation outruns the inject.
 */
function logInjectFailure(what: string, tabId: number, error: unknown): void {
  const msg = (error as Error).message;
  if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
    logger.info('InjectManager', `Failed to inject ${what} into tab ${tabId}: ${msg}`);
  }
}

type TestScope = ReturnType<typeof getTestScopeForTab>;

/**
 * Test-isolation gate. In a test tab, only that session's scoped rules
 * apply; elsewhere, a rule under test in some other session is skipped so
 * it can't leak into unrelated tabs. Returns true when the rule is blocked.
 */
function blockedByTestScope(uid: string, testScope: TestScope): boolean {
  if (testScope) return !testScope.has(uid);
  return isRuleUnderTest(uid);
}

async function injectForUrl(tabId: number, url: string): Promise<void> {
  const testScope = getTestScopeForTab(tabId);

  // Capture the page's pristine fetch/XHR/WebSocket/EventSource before any
  // interceptor patches them, so a later live-update reset has clean
  // references to restore to.
  try {
    await applyInjection(tabId, buildSetupInjection(), 'oh-setup');
  } catch (error) {
    logInjectFailure('oh-setup', tabId, error);
  }

  // Inject rules target the PAGE itself (page-url match, one-shot DOM
  // injection). Navigation-only: re-running them would double-inject, so
  // they are deliberately excluded from the live-update push.
  for (const rule of activeInjectRules) {
    if (!doesUrlMatchRule(url, rule)) continue;
    if (blockedByTestScope(rule.uid, testScope)) continue;

    try {
      if (rule.action.source === 'url' && rule.action.sourceUrl) {
        if (rule.action.injectType === 'css') {
          await injectCSSUrl(tabId, rule.action.sourceUrl);
        } else {
          await injectScriptUrl(tabId, rule.action.sourceUrl);
        }
      } else if (rule.action.injectType === 'css') {
        await injectCSS(tabId, rule);
      } else {
        await injectScript(tabId, rule.action.code, rule.action.position);
      }
    } catch (error) {
      logInjectFailure(`"${rule.name}"`, tabId, error);
    }
  }

  await injectInterceptorsForTab(tabId, url, testScope);
}

/**
 * Inject the live-pushable interceptors — response/body/delay (REQUEST-url
 * matched in-page), header merges, and ws/sse wrappers. All gate on the
 * initiator-domain rule (`shouldInstallForPage`), not the page url. Used
 * on navigation AND on the live-update push (where the caller resets
 * first so this rebuilds a clean patch chain).
 */
async function injectInterceptorsForTab(tabId: number, url: string, testScope: TestScope): Promise<void> {
  for (const entry of activeInterceptorRules) {
    if (!shouldInstallForPage(entry, url)) continue;
    const rule = entry.rule;
    if (blockedByTestScope(rule.uid, testScope)) continue;

    try {
      switch (rule.type) {
        case 'delay':
          await applyInjection(tabId, buildDelayInjection(rule), rule.name);
          break;
        case 'request-body':
          await applyInjection(tabId, buildRequestBodyInjection(rule), rule.name);
          break;
        case 'response':
          await applyInjection(tabId, buildResponseInjection(rule), rule.name);
          break;
      }
    } catch (error) {
      logInjectFailure(`"${rule.name}"`, tabId, error);
    }
  }

  for (const merge of activeHeaderMerges) {
    if (!shouldInstallForPage(merge, url)) continue;
    if (blockedByTestScope(merge.ruleUid, testScope)) continue;

    try {
      const injection = buildHeaderMergeInjection(
        merge.ruleUid,
        merge.regexSources,
        merge.requestMerges,
        merge.responseMerges,
      );
      await applyInjection(tabId, injection, 'header-merge');
    } catch (error) {
      logInjectFailure('header merge', tabId, error);
    }
  }

  for (const entry of activeMessageRules) {
    if (!shouldInstallForPage(entry, url)) continue;
    if (blockedByTestScope(entry.rule.uid, testScope)) continue;

    try {
      const injection = entry.rule.type === 'ws' ? buildWsInjection(entry.rule) : buildSseInjection(entry.rule);
      await applyInjection(tabId, injection, entry.rule.name);
    } catch (error) {
      logInjectFailure(`"${entry.rule.name}"`, tabId, error);
    }
  }
}

/**
 * Apply an interceptor-set change to already-open tabs without a reload:
 * restore the pristine references (drop every chained OH patch), then
 * re-inject the current interceptor set. Inject rules are excluded — they
 * already ran on load and re-running would double-inject.
 */
async function pushInterceptorUpdate(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await browserAPI.tabs.query({});
  } catch {
    return;
  }
  if (!Array.isArray(tabs)) return;
  for (const tab of tabs) {
    const tabId = tab.id;
    if (typeof tabId !== 'number' || !tab.url || !/^https?:/.test(tab.url)) continue;
    try {
      await applyInjection(tabId, buildResetInjection(), 'oh-reset');
      await injectInterceptorsForTab(tabId, tab.url, getTestScopeForTab(tabId));
    } catch (error) {
      logInjectFailure('interceptor update', tabId, error);
    }
  }
}

/** Test-only handles for the injection passes. */
export const __testInjectForUrl = injectForUrl;
export const __testPushInterceptorUpdate = pushInterceptorUpdate;

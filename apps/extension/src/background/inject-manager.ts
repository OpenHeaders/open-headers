/**
 * Inject Manager — applies rules that require chrome.scripting API.
 *
 * Handles 6 rule types that can't use declarativeNetRequest:
 *   - inject: user-authored JS/CSS injection
 *   - delay: monkey-patches fetch/XHR with setTimeout
 *   - body: monkey-patches fetch/XHR to modify request/response bodies
 *   - mock: monkey-patches fetch/XHR to return fake responses
 *   - ws: wraps the WebSocket constructor to modify/inject/drop frames
 *   - sse: wraps the EventSource constructor to modify/inject/drop events
 *
 * Architecture:
 * - Keeps the current set of scriptable rules in memory
 * - Listens to webNavigation.onCommitted for main frame navigations
 * - For each navigation, checks URL matches and injects appropriate scripts
 * - delay/body/mock inject at document_start (before page JS runs)
 * - inject rules respect their configured position
 */

declare const browser: typeof chrome | undefined;

import type {
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  Rule,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import { compileRuleForInjection, doesHostMatchDomains, doesUrlMatchRule } from '@openheaders/core/utils';
import {
  buildBodyInjection,
  buildDelayInjection,
  buildHeaderMergeInjection,
  buildMockInjection,
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

/** Rules inject-manager can act on. Header rules are here for their `merge` operations. */
type ScriptableRule = InjectRule | DelayRule | BodyRule | MockRule | HeaderRule;

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

let activeScriptableRules: ScriptableRule[] = [];
let activeHeaderMerges: HeaderMergeEntry[] = [];
let activeMessageRules: MessageRuleEntry[] = [];

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
 * delay, body, mock, header); header-merge entries are derived from header
 * rules internally so dnr-manager doesn't have to know about them.
 *
 * Returns the uids that actually received an in-page artifact — a header
 * rule without merge operations installs nothing here. dnr-manager folds
 * the set into its effective-fire-uid snapshot.
 */
export function updateScriptableRules(rules: Rule[]): ReadonlySet<string> {
  const scriptable: ScriptableRule[] = [];
  const headerMerges: HeaderMergeEntry[] = [];
  const messageRules: MessageRuleEntry[] = [];
  const installedUids = new Set<string>();
  for (const rule of rules) {
    switch (rule.type) {
      case 'inject':
      case 'delay':
      case 'body':
      case 'mock':
        scriptable.push(rule);
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
  activeScriptableRules = scriptable;
  activeHeaderMerges = headerMerges;
  activeMessageRules = messageRules;
  if (scriptable.length > 0 || headerMerges.length > 0 || messageRules.length > 0) {
    logger.info(
      'InjectManager',
      `Updated scriptable rules: ${scriptable.length} active (${scriptable.map((r) => `${r.type}:${r.name}`).join(', ')}), ${headerMerges.length} header merges, ${messageRules.length} ws/sse`,
    );
  } else {
    logger.debug('InjectManager', 'Updated scriptable rules: 0 active');
  }
  return installedUids;
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
      if (activeScriptableRules.length === 0 && activeHeaderMerges.length === 0 && activeMessageRules.length === 0)
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

async function injectForUrl(tabId: number, url: string): Promise<void> {
  // Test isolation: if this is a test tab, only inject rules in that session's
  // scope. If it is NOT a test tab, skip any rule currently under test in some
  // other session so the test doesn't leak into unrelated tabs.
  const testScope = getTestScopeForTab(tabId);

  for (const rule of activeScriptableRules) {
    // Header rules are tracked in this list only so dnr-manager can pass a
    // single set of scriptable-capable rules over; their merge injections
    // are driven separately from `activeHeaderMerges` below.
    if (rule.type === 'header') continue;

    // A rule with no URL-matching conditions never matches any URL —
    // incomplete rules are already filtered upstream by isRuleComplete.
    if (!doesUrlMatchRule(url, rule)) continue;
    if (testScope) {
      if (!testScope.has(rule.uid)) continue;
    } else if (isRuleUnderTest(rule.uid)) {
      continue;
    }

    try {
      switch (rule.type) {
        case 'inject':
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
          break;
        case 'delay':
          await applyInjection(tabId, buildDelayInjection(rule), rule.name);
          break;
        case 'body':
          await applyInjection(tabId, buildBodyInjection(rule), rule.name);
          break;
        case 'mock':
          await applyInjection(tabId, buildMockInjection(rule), rule.name);
          break;
      }
    } catch (error) {
      const msg = (error as Error).message;
      if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
        logger.info('InjectManager', `Failed to inject "${rule.name}" into tab ${tabId}: ${msg}`);
      }
    }
  }

  // Inject header merge scripts — installed wherever a matching request
  // could originate (request-URL matching happens in-page), subject to the
  // initiator-domain gate and the same test-session scope filter.
  for (const merge of activeHeaderMerges) {
    if (!shouldInstallForPage(merge, url)) continue;
    if (testScope) {
      if (!testScope.has(merge.ruleUid)) continue;
    } else if (isRuleUnderTest(merge.ruleUid)) {
      continue;
    }

    try {
      const injection = buildHeaderMergeInjection(
        merge.ruleUid,
        merge.regexSources,
        merge.requestMerges,
        merge.responseMerges,
      );
      await applyInjection(tabId, injection, 'header-merge');
    } catch (error) {
      const msg = (error as Error).message;
      if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
        logger.info('InjectManager', `Failed to inject header merge into tab ${tabId}: ${msg}`);
      }
    }
  }

  // Inject ws/sse wrappers — same install model as header merges: the
  // rule's URL conditions match the socket/stream endpoint in-page, the
  // initiator-domain gate decides which pages get the wrapper.
  for (const entry of activeMessageRules) {
    if (!shouldInstallForPage(entry, url)) continue;
    if (testScope) {
      if (!testScope.has(entry.rule.uid)) continue;
    } else if (isRuleUnderTest(entry.rule.uid)) {
      continue;
    }

    try {
      const injection = entry.rule.type === 'ws' ? buildWsInjection(entry.rule) : buildSseInjection(entry.rule);
      await applyInjection(tabId, injection, entry.rule.name);
    } catch (error) {
      const msg = (error as Error).message;
      if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
        logger.info('InjectManager', `Failed to inject "${entry.rule.name}" into tab ${tabId}: ${msg}`);
      }
    }
  }
}

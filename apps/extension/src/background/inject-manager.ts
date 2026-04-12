/**
 * Inject Manager — applies rules that require chrome.scripting API.
 *
 * Handles 4 rule types that can't use declarativeNetRequest:
 *   - inject: user-authored JS/CSS injection
 *   - delay: monkey-patches fetch/XHR with setTimeout
 *   - body: monkey-patches fetch/XHR to modify request/response bodies
 *   - mock: monkey-patches fetch/XHR to return fake responses
 *
 * Architecture:
 * - Keeps the current set of scriptable rules in memory
 * - Listens to webNavigation.onCommitted for main frame navigations
 * - For each navigation, checks URL matches and injects appropriate scripts
 * - delay/body/mock inject at document_start (before page JS runs)
 * - inject rules respect their configured position
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import {
  generateBodyScript,
  generateDelayScript,
  generateHeaderMergeScript,
  generateMockScript,
} from './content-scripts';
import { getTestScopeForTab, isRuleUnderTest } from './modules/test-runner';
import { doesUrlMatchPattern } from './modules/url-utils';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/** All scriptable rule types — inject, delay, body, mock. */
type ScriptableRule = V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule;

/** A header merge operation extracted from a HeaderRule. */
export interface HeaderMergeEntry {
  /** The V5 header rule this merge came from — used for test-session scope filtering and telemetry. */
  ruleUid: string;
  /** Domain patterns from rule conditions. */
  patterns: string[];
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
}

let activeScriptableRules: ScriptableRule[] = [];
let activeHeaderMerges: HeaderMergeEntry[] = [];

// ── Public API ───────────────────────────────────────────────────

/**
 * Update the set of active scriptable rules. Called by dnr-manager
 * whenever rules change.
 */
export function updateScriptableRules(rules: ScriptableRule[], headerMerges: HeaderMergeEntry[] = []): void {
  activeScriptableRules = rules;
  activeHeaderMerges = headerMerges;
  logger.debug(
    'InjectManager',
    `Updated scriptable rules: ${rules.length} active, ${headerMerges.length} header merges`,
  );
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
      if (activeScriptableRules.length === 0 && activeHeaderMerges.length === 0) return;

      void injectForUrl(details.tabId, details.url);
    },
  );

  logger.info('InjectManager', 'Navigation listener registered');
}

// ── Helpers ──────────────────────────────────────────────────────

/** Extract host domains from a rule's conditions. */
function getHostDomains(rule: ScriptableRule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'request-domains')
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
}

function urlMatchesRule(url: string, rule: ScriptableRule): boolean {
  const domains = getHostDomains(rule);
  return domains.length === 0 || domains.some((d) => doesUrlMatchPattern(url, d));
}

// ── Injection logic ──────────────────────────────────────────────

async function injectForUrl(tabId: number, url: string): Promise<void> {
  // Test isolation: if this is a test tab, only inject rules in that session's
  // scope. If it is NOT a test tab, skip any rule currently under test in some
  // other session so the test doesn't leak into unrelated tabs.
  const testScope = getTestScopeForTab(tabId);

  for (const rule of activeScriptableRules) {
    if (!urlMatchesRule(url, rule)) continue;
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
          await injectGeneratedScript(tabId, generateDelayScript(rule), rule.name);
          break;
        case 'body':
          await injectGeneratedScript(tabId, generateBodyScript(rule), rule.name);
          break;
        case 'mock':
          await injectGeneratedScript(tabId, generateMockScript(rule), rule.name);
          break;
      }
    } catch (error) {
      const msg = (error as Error).message;
      if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
        logger.info('InjectManager', `Failed to inject "${rule.name}" into tab ${tabId}: ${msg}`);
      }
    }
  }

  // Inject header merge scripts — subject to the same test-session scope filter.
  for (const merge of activeHeaderMerges) {
    const matches = merge.patterns.length === 0 || merge.patterns.some((d) => doesUrlMatchPattern(url, d));
    if (!matches) continue;
    if (testScope) {
      if (!testScope.has(merge.ruleUid)) continue;
    } else if (isRuleUnderTest(merge.ruleUid)) {
      continue;
    }

    try {
      const script = generateHeaderMergeScript(merge.ruleUid, merge.patterns, merge.requestMerges, merge.responseMerges);
      await injectGeneratedScript(tabId, script, 'header-merge');
    } catch (error) {
      const msg = (error as Error).message;
      if (!msg?.includes('Cannot access') && !msg?.includes('No tab')) {
        logger.info('InjectManager', `Failed to inject header merge into tab ${tabId}: ${msg}`);
      }
    }
  }
}

async function injectScript(tabId: number, code: string, position: V5.InjectAction['position']): Promise<void> {
  const early = position === 'head'; // 'head' = as soon as possible
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (injectedCode: string) => {
      const script = document.createElement('script');
      script.textContent = injectedCode;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    },
    args: [code],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
    ...(early ? { injectImmediately: true } : {}),
  });
  logger.debug('InjectManager', `Injected script into tab ${tabId} (${position})`);
}

/** Inject a generated script (delay/body/mock) at document_start in MAIN world. */
async function injectGeneratedScript(tabId: number, code: string, ruleName: string): Promise<void> {
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (injectedCode: string) => {
      const script = document.createElement('script');
      script.textContent = injectedCode;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    },
    args: [code],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
    injectImmediately: true,
  });
  logger.debug('InjectManager', `Injected ${ruleName} into tab ${tabId}`);
}

async function injectCSS(tabId: number, rule: V5.InjectRule): Promise<void> {
  await browserAPI.scripting.insertCSS({
    target: { tabId },
    css: rule.action.code,
  });
  logger.debug('InjectManager', `Injected CSS "${rule.name}" into tab ${tabId}`);
}

/** Inject an external script by URL — creates a <script src="..."> tag in MAIN world. */
async function injectScriptUrl(tabId: number, url: string): Promise<void> {
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (srcUrl: string) => {
      const script = document.createElement('script');
      script.src = srcUrl;
      (document.head || document.documentElement).appendChild(script);
    },
    args: [url],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
  });
  logger.debug('InjectManager', `Injected script URL into tab ${tabId}: ${url}`);
}

/** Inject an external CSS by URL — creates a <link rel="stylesheet"> tag. */
async function injectCSSUrl(tabId: number, url: string): Promise<void> {
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (href: string) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      (document.head || document.documentElement).appendChild(link);
    },
    args: [url],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
  });
  logger.debug('InjectManager', `Injected CSS URL into tab ${tabId}: ${url}`);
}

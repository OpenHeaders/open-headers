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
import { generateBodyScript, generateDelayScript, generateMockScript } from './content-scripts';
import { doesUrlMatchPattern } from './modules/url-utils';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/** All scriptable rule types — inject, delay, body, mock. */
type ScriptableRule = V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule;

let activeScriptableRules: ScriptableRule[] = [];

// ── Public API ───────────────────────────────────────────────────

/**
 * Update the set of active scriptable rules. Called by dnr-manager
 * whenever rules change.
 */
export function updateScriptableRules(rules: ScriptableRule[]): void {
  activeScriptableRules = rules;
  logger.debug('InjectManager', `Updated scriptable rules: ${rules.length} active`);
}

/** @deprecated Use updateScriptableRules instead. */
export function updateInjectRules(rules: V5.InjectRule[]): void {
  updateScriptableRules(rules);
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
      if (activeScriptableRules.length === 0) return;

      void injectForUrl(details.tabId, details.url);
    },
  );

  logger.info('InjectManager', 'Navigation listener registered');
}

// ── Helpers ──────────────────────────────────────────────────────

/** Extract host domains from a rule's conditions. */
function getHostDomains(rule: ScriptableRule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'host' && !c.exclude)
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
}

function urlMatchesRule(url: string, rule: ScriptableRule): boolean {
  const domains = getHostDomains(rule);
  return domains.length === 0 || domains.some((d) => doesUrlMatchPattern(url, d));
}

// ── Injection logic ──────────────────────────────────────────────

async function injectForUrl(tabId: number, url: string): Promise<void> {
  for (const rule of activeScriptableRules) {
    if (!urlMatchesRule(url, rule)) continue;

    try {
      switch (rule.type) {
        case 'inject':
          if (rule.action.injectType === 'css') {
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
}

function mapRunAt(position: V5.InjectAction['position']): 'document_start' | 'document_end' | 'document_idle' {
  switch (position) {
    case 'head':
      return 'document_start';
    case 'body-start':
      return 'document_end';
    case 'body-end':
      return 'document_idle';
  }
}

async function injectScript(tabId: number, code: string, position: V5.InjectAction['position']): Promise<void> {
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
    ...(mapRunAt(position) !== 'document_idle' ? {} : {}),
  });
  logger.debug('InjectManager', `Injected script into tab ${tabId}`);
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

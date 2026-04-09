/**
 * Inject Manager — applies V5.InjectRule via chrome.scripting API.
 *
 * Inject rules cannot use declarativeNetRequest — they require the scripting
 * API to execute JavaScript or insert CSS into matching pages.
 *
 * Architecture:
 * - Keeps the current set of inject rules in memory
 * - Listens to webNavigation.onCommitted for main frame navigations
 * - For each navigation, checks if the URL matches any inject rule's domains
 * - Executes script or inserts CSS using chrome.scripting
 *
 * Position mapping:
 *   'head'       → runAt: 'document_start'
 *   'body-start' → runAt: 'document_end'
 *   'body-end'   → runAt: 'document_idle'
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { doesUrlMatchPattern } from './modules/url-utils';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let activeInjectRules: V5.InjectRule[] = [];

// ── Public API ───────────────────────────────────────────────────

/**
 * Update the set of active inject rules. Called by dnr-manager
 * whenever rules change.
 */
export function updateInjectRules(rules: V5.InjectRule[]): void {
  activeInjectRules = rules;
  logger.debug('InjectManager', `Updated inject rules: ${rules.length} active`);
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
      if (activeInjectRules.length === 0) return;

      void injectForUrl(details.tabId, details.url);
    },
  );

  logger.info('InjectManager', 'Navigation listener registered');
}

// ── Injection logic ──────────────────────────────────────────────

async function injectForUrl(tabId: number, url: string): Promise<void> {
  for (const rule of activeInjectRules) {
    const hostConditions = rule.conditions.filter((c) => c.type === 'host' && !c.exclude);
    const domains = hostConditions.flatMap((c) => c.values).filter((v) => v.trim());
    const matches = domains.length === 0 || domains.some((d) => doesUrlMatchPattern(url, d));
    if (!matches) continue;

    try {
      if (rule.action.injectType === 'css') {
        await injectCSS(tabId, rule);
      } else {
        await injectScript(tabId, rule);
      }
    } catch (error) {
      const msg = (error as Error).message;
      // Silently ignore expected errors (internal pages, closed tabs)
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

async function injectScript(tabId: number, rule: V5.InjectRule): Promise<void> {
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (code: string) => {
      const script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    },
    args: [rule.action.code],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
    ...(mapRunAt(rule.action.position) !== 'document_idle' ? {} : {}),
  });
  logger.debug('InjectManager', `Injected script "${rule.name}" into tab ${tabId}`);
}

async function injectCSS(tabId: number, rule: V5.InjectRule): Promise<void> {
  await browserAPI.scripting.insertCSS({
    target: { tabId },
    css: rule.action.code,
  });
  logger.debug('InjectManager', `Injected CSS "${rule.name}" into tab ${tabId}`);
}

/**
 * Rule-engine injection layer — pushes content-script injections into
 * Chrome via `chrome.scripting`.
 *
 * Pure-ish: every function takes a `tabId` + payload and calls the
 * scripting API directly. Errors that mean "the tab is gone" are
 * filtered by callers (orchestrator `inject-manager.ts`); other errors
 * surface as rejections.
 *
 * Today this calls `chrome.scripting` directly via the global. When the
 * engine moves to its own package, the `browserApi` becomes an injected
 * dependency so the package stays host-agnostic.
 */

declare const browser: typeof chrome | undefined;

import type { InjectAction, InjectRule } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import type { Injection } from '../content-scripts';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Dispatch an Injection to the correct underlying injection mechanism.
 *
 * - `func` injections go through `executeScript({func, args, world:'MAIN'})`
 *   directly — the func body runs in MAIN world with extension privilege and
 *   never creates an inline <script> tag, so it bypasses the page's CSP.
 * - `inline-script` injections use the legacy `<script>` tag approach, which
 *   is subject to the page's CSP and may be blocked on strict-CSP sites. This
 *   path is only used for dynamic body/mock rules that embed user JavaScript.
 */
export async function applyInjection(tabId: number, injection: Injection, ruleName: string): Promise<void> {
  if (injection.kind === 'func') {
    await browserAPI.scripting.executeScript({
      target: { tabId },
      // Cast: Injection.func is typed as (cfg: never) => void to seal the
      // contravariant parameter. executeScript serializes via toString() and
      // runs it in the page — TS type of the param is meaningless at runtime.
      func: injection.func as unknown as (cfg: unknown) => void,
      args: injection.args,
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
      injectImmediately: true,
    });
    logger.info('InjectEngine', `Injected ${ruleName} func into tab ${tabId}`);
    return;
  }
  // Legacy inline-<script> path for dynamic rules with user JS.
  await browserAPI.scripting.executeScript({
    target: { tabId },
    func: (injectedCode: string) => {
      const script = document.createElement('script');
      script.textContent = injectedCode;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    },
    args: [injection.code],
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
    injectImmediately: true,
  });
  logger.debug('InjectEngine', `Injected ${ruleName} (inline) into tab ${tabId}`);
}

export async function injectScript(tabId: number, code: string, position: InjectAction['position']): Promise<void> {
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
  logger.debug('InjectEngine', `Injected script into tab ${tabId} (${position})`);
}

export async function injectCSS(tabId: number, rule: InjectRule): Promise<void> {
  await browserAPI.scripting.insertCSS({
    target: { tabId },
    css: rule.action.code,
  });
  logger.debug('InjectEngine', `Injected CSS "${rule.name}" into tab ${tabId}`);
}

/** Inject an external script by URL — creates a <script src="..."> tag in MAIN world. */
export async function injectScriptUrl(tabId: number, url: string): Promise<void> {
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
  logger.debug('InjectEngine', `Injected script URL into tab ${tabId}: ${url}`);
}

/** Inject an external CSS by URL — creates a <link rel="stylesheet"> tag. */
export async function injectCSSUrl(tabId: number, url: string): Promise<void> {
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
  logger.debug('InjectEngine', `Injected CSS URL into tab ${tabId}: ${url}`);
}

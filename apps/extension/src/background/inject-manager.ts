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

import type { BodyRule, DelayRule, HeaderRule, InjectAction, InjectRule, MockRule, Rule } from '@openheaders/core/types';
import { compileRuleForInjection, doesUrlMatchRule } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import {
  buildBodyInjection,
  buildDelayInjection,
  buildHeaderMergeInjection,
  buildMockInjection,
  type Injection,
} from './content-scripts';
import { getTestScopeForTab, isRuleUnderTest } from './modules/test-runner';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/** Rules inject-manager can act on. Header rules are here for their `merge` operations. */
type ScriptableRule = InjectRule | DelayRule | BodyRule | MockRule | HeaderRule;

/** A header merge operation extracted from a HeaderRule. */
interface HeaderMergeEntry {
  ruleUid: string;
  /**
   * Regex sources pre-compiled from the rule's URL conditions. Empty array
   * means the rule has no URL conditions and should not match any URL.
   */
  regexSources: string[];
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
}

let activeScriptableRules: ScriptableRule[] = [];
let activeHeaderMerges: HeaderMergeEntry[] = [];

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
  return { ruleUid: rule.uid, regexSources: compileRuleForInjection(rule), requestMerges, responseMerges };
}

/** Test-only handle for the unresolved-template guard. */
export const __testExtractHeaderMergeEntry = extractHeaderMergeEntry;

// ── Public API ───────────────────────────────────────────────────

/**
 * Update the set of active scriptable rules. Called by dnr-manager whenever
 * rules change. Accepts every V5 rule with any in-page side effect (inject,
 * delay, body, mock, header); header-merge entries are derived from header
 * rules internally so dnr-manager doesn't have to know about them.
 */
export function updateScriptableRules(rules: Rule[]): void {
  const scriptable: ScriptableRule[] = [];
  const headerMerges: HeaderMergeEntry[] = [];
  for (const rule of rules) {
    switch (rule.type) {
      case 'inject':
      case 'delay':
      case 'body':
      case 'mock':
        scriptable.push(rule);
        break;
      case 'header': {
        const merge = extractHeaderMergeEntry(rule);
        if (merge) headerMerges.push(merge);
        break;
      }
    }
  }
  activeScriptableRules = scriptable;
  activeHeaderMerges = headerMerges;
  headerMergeRegexCache = new WeakMap();
  if (scriptable.length > 0 || headerMerges.length > 0) {
    logger.info(
      'InjectManager',
      `Updated scriptable rules: ${scriptable.length} active (${scriptable.map((r) => `${r.type}:${r.name}`).join(', ')}), ${headerMerges.length} header merges`,
    );
  } else {
    logger.debug('InjectManager', 'Updated scriptable rules: 0 active');
  }
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

/**
 * Cached compiled regexes per header-merge entry — rebuilt whenever
 * `updateScriptableRules` swaps the entries. Keeps the hot path free of
 * repeated `new RegExp` calls during navigation.
 */
let headerMergeRegexCache: WeakMap<HeaderMergeEntry, RegExp[]> = new WeakMap();

function regexesFor(entry: HeaderMergeEntry): RegExp[] {
  let cached = headerMergeRegexCache.get(entry);
  if (!cached) {
    cached = entry.regexSources.map((s) => new RegExp(s, 'i'));
    headerMergeRegexCache.set(entry, cached);
  }
  return cached;
}

function headerMergeMatches(entry: HeaderMergeEntry, url: string): boolean {
  const regexes = regexesFor(entry);
  for (let i = 0; i < regexes.length; i++) {
    if (regexes[i]!.test(url)) return true;
  }
  return false;
}

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

  // Inject header merge scripts — subject to the same test-session scope filter.
  for (const merge of activeHeaderMerges) {
    if (!headerMergeMatches(merge, url)) continue;
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
}

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
async function applyInjection(tabId: number, injection: Injection, ruleName: string): Promise<void> {
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
    logger.info('InjectManager', `Injected ${ruleName} func into tab ${tabId}`);
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
  logger.debug('InjectManager', `Injected ${ruleName} (inline) into tab ${tabId}`);
}

async function injectScript(tabId: number, code: string, position: InjectAction['position']): Promise<void> {
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

async function injectCSS(tabId: number, rule: InjectRule): Promise<void> {
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

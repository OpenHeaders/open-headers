/**
 * Content script generators for rules that can't use declarativeNetRequest.
 *
 * Two injection strategies coexist:
 *
 *   1. **Real-function injection** (static delay/body/mock/header-merge) —
 *      returns a `{func, args}` pair that inject-manager passes directly to
 *      `chrome.scripting.executeScript({world:'MAIN'})`. The func body runs in
 *      the page's MAIN world with extension privilege, **without** creating an
 *      inline <script> tag, so it is not subject to the page's CSP. This is
 *      the CSP-safe path that works on strict-CSP sites like GitHub.
 *
 *   2. **Inline-script injection** (dynamic body/mock, inject rules) — returns
 *      a string of JavaScript that inject-manager wraps in a page-side <script>
 *      tag. Needed because these rules embed user-authored JS (modifyRequestBody,
 *      modifyResponse, arbitrary inject code) which can't be embedded inside a
 *      closed TypeScript function. On strict-CSP sites the <script> tag is
 *      blocked — this is a pre-existing limitation, not a regression.
 *
 * URL matching inside every injected function is driven by regex sources
 * pre-compiled by `@openheaders/core/utils::compileRuleForInjection`. The
 * in-page code does:
 *
 *     const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
 *     function matches(url) { return regexes.some((r) => r.test(url)); }
 *
 * There is no hand-rolled glob matcher in the page. Chrome urlFilter
 * semantics (including future `|`/`||` anchor support) live in ONE place:
 * core's rule-matcher module.
 *
 * On match, each function fires a `window.postMessage({__ohFire:true,...})`.
 * The always-on ISOLATED fire-bridge content script (registered via
 * manifest.json) catches the message and forwards it to the background
 * tab-telemetry service. postMessage is the canonical MAIN↔ISOLATED channel
 * in MV3 — it performs structured cloning, unlike CustomEvent.detail which
 * is an opaque cross-realm object.
 */

import type { BodyRule, DelayRule, MockRule, SseRule, WsRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { FuncInjection, Injection } from './builders/types';

// Re-export the injection types so existing importers keep working.
export type { FuncInjection, Injection, InlineScriptInjection } from './builders/types';

// ── Per-rule config shapes passed into injected funcs ───────────────

interface DelayConfig {
  ruleUid: string;
  regexSources: string[];
  delayMs: number;
}

interface GraphqlFilter {
  key: string;
  operator: 'Equals' | 'Contains';
  value: string;
}

interface StaticBodyConfig {
  ruleUid: string;
  regexSources: string[];
  body: string;
  graphqlFilter?: GraphqlFilter;
}

interface StaticMockConfig {
  ruleUid: string;
  regexSources: string[];
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  graphqlFilter?: GraphqlFilter;
}

interface HeaderMergeConfig {
  ruleUid: string;
  regexSources: string[];
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
}

interface MessageFilterConfig {
  matchType: 'contains' | 'regex';
  value: string;
}

interface WsConfig {
  ruleUid: string;
  regexSources: string[];
  operation: 'modify' | 'inject' | 'drop';
  direction: 'send' | 'receive';
  filter?: MessageFilterConfig;
  payload: string;
  injectTrigger: 'open' | 'message';
}

interface SseConfig {
  ruleUid: string;
  regexSources: string[];
  operation: 'modify' | 'inject' | 'drop';
  eventName?: string;
  filter?: MessageFilterConfig;
  payload: string;
  injectTrigger: 'open' | 'message';
}

// ── Inline helper code (embedded in every dynamic string-template script) ──

const TEST_BRIDGE_CODE = [
  'function __ohFire(ruleUid, url, kind) {',
  '  try {',
  // window.postMessage is the canonical MAIN→ISOLATED channel in MV3 — it
  // performs structured cloning of the payload, unlike CustomEvent.detail
  // which is an opaque cross-realm object and often comes through as null.
  '    window.postMessage({ __ohFire: true, ruleUid: ruleUid, url: url, kind: kind, t: Date.now() }, "*");',
  '  } catch (e) {}',
  '}',
].join('\n');

const URL_MATCHER_CODE = [
  'function __ohMatchesUrl(url, regexSources) {',
  '  for (var i = 0; i < regexSources.length; i++) {',
  '    try { if (new RegExp(regexSources[i], "i").test(url)) return true; } catch (e) {}',
  '  }',
  '  return false;',
  '}',
].join('\n');

// GraphQL operation filter — parses the request body as JSON and tests
// the configured field (commonly `operationName`, or `query` for substring
// match) against the user's value. Returns true (pass-through) when no
// filter is configured. Returns false when a filter is configured and the
// body is missing, unparseable, or the field does not match — those are
// the cases where the rule should NOT fire.
const GRAPHQL_MATCHER_CODE = [
  'function __ohMatchesGraphQL(bodyStr, filter) {',
  '  if (!filter || !filter.key) return true;',
  '  if (typeof bodyStr !== "string" || bodyStr.length === 0) return false;',
  '  try {',
  '    var parsed = JSON.parse(bodyStr);',
  '    if (parsed == null || typeof parsed !== "object") return false;',
  '    var v = parsed[filter.key];',
  '    if (typeof v !== "string") return false;',
  '    return filter.operator === "Contains" ? v.indexOf(filter.value) !== -1 : v === filter.value;',
  '  } catch (e) { return false; }',
  '}',
].join('\n');

// ── Static Delay (real function) ────────────────────────────────────

export function buildDelayInjection(rule: DelayRule): FuncInjection {
  const config: DelayConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    delayMs: Math.max(0, Math.min(rule.action.delayMs, 5000)),
  };
  return {
    kind: 'func',
    func: delayInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Monkey-patches fetch/XHR to delay requests matching the configured regexes.
 * MUST be self-contained — no closures, no outer refs. Serialized via
 * Function.prototype.toString and re-parsed in the page's MAIN world.
 */
function delayInjectionFunc(cfg: DelayConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'delay', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
    if (matches(url)) {
      fire(url);
      return new Promise((resolve) => {
        setTimeout(() => resolve(origFetch.apply(this, args)), cfg.delayMs);
      });
    }
    return origFetch.apply(this, args);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__ohUrl = typeof url === 'string' ? url : url.href;
    origXHROpen.call(this, method, url, async, username, password);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = this.__ohUrl ?? '';
    if (url && matches(url)) {
      fire(url);
      setTimeout(() => origXHRSend.apply(this, args), cfg.delayMs);
    } else {
      origXHRSend.apply(this, args);
    }
  };
}

// ── Static Body (real function) ─────────────────────────────────────

export function buildBodyInjection(rule: BodyRule): Injection {
  const bodyType = rule.action.bodyType || 'static';
  if (bodyType === 'dynamic') {
    return { kind: 'inline-script', code: generateDynamicBodyScript(rule) };
  }
  const config: StaticBodyConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    body: rule.action.body,
    graphqlFilter:
      rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : undefined,
  };
  return {
    kind: 'func',
    func: staticBodyInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

function staticBodyInjectionFunc(cfg: StaticBodyConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  // GraphQL operation filter — see GRAPHQL_MATCHER_CODE for the
  // canonical inline-template version. Behavior must match it exactly;
  // a drift test in graphql-filter.test.ts pins the contract.
  function matchesGraphQL(bodyStr: unknown, filter: GraphqlFilter | undefined): boolean {
    if (!filter?.key) return true;
    if (typeof bodyStr !== 'string' || bodyStr.length === 0) return false;
    try {
      const parsed: unknown = JSON.parse(bodyStr);
      if (parsed == null || typeof parsed !== 'object') return false;
      const v = (parsed as Record<string, unknown>)[filter.key];
      if (typeof v !== 'string') return false;
      return filter.operator === 'Contains' ? v.indexOf(filter.value) !== -1 : v === filter.value;
    } catch {
      return false;
    }
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'body', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
    if (matches(url) && args[1]) {
      const reqBody = (args[1] as RequestInit).body;
      const bodyStr = typeof reqBody === 'string' ? reqBody : reqBody == null ? '' : String(reqBody);
      if (!matchesGraphQL(bodyStr, cfg.graphqlFilter)) return origFetch.apply(this, args);
      fire(url);
      args[1] = Object.assign({}, args[1], { body: cfg.body });
    }
    return origFetch.apply(this, args);
  };

  const origXHRSend = XMLHttpRequest.prototype.send;
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__ohUrl = typeof url === 'string' ? url : url.href;
    origXHROpen.call(this, method, url, async, username, password);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = this.__ohUrl ?? '';
    if (url && matches(url)) {
      const reqBody = args[0];
      const bodyStr = typeof reqBody === 'string' ? reqBody : reqBody == null ? '' : String(reqBody);
      if (!matchesGraphQL(bodyStr, cfg.graphqlFilter)) {
        origXHRSend.apply(this, args);
        return;
      }
      fire(url);
      origXHRSend.call(this, cfg.body);
      return;
    }
    origXHRSend.apply(this, args);
  };
}

// ── Static Mock (real function) ─────────────────────────────────────

export function buildMockInjection(rule: MockRule): Injection {
  const bodyType = rule.action.bodyType || 'static';
  if (bodyType === 'dynamic') {
    return { kind: 'inline-script', code: generateDynamicMockScript(rule) };
  }
  const { statusCode, responseBody, contentType, responseHeaders } = rule.action;
  const config: StaticMockConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    statusCode: statusCode || 200,
    body: responseBody,
    headers: { 'Content-Type': contentType || 'application/json', ...responseHeaders },
    graphqlFilter:
      rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : undefined,
  };
  return {
    kind: 'func',
    func: staticMockInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

function staticMockInjectionFunc(cfg: StaticMockConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  function matchesGraphQL(bodyStr: unknown, filter: GraphqlFilter | undefined): boolean {
    if (!filter?.key) return true;
    if (typeof bodyStr !== 'string' || bodyStr.length === 0) return false;
    try {
      const parsed: unknown = JSON.parse(bodyStr);
      if (parsed == null || typeof parsed !== 'object') return false;
      const v = (parsed as Record<string, unknown>)[filter.key];
      if (typeof v !== 'string') return false;
      return filter.operator === 'Contains' ? v.indexOf(filter.value) !== -1 : v === filter.value;
    } catch {
      return false;
    }
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'mock', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
    if (matches(url)) {
      const reqBody = (args[1] as RequestInit | undefined)?.body;
      const bodyStr = typeof reqBody === 'string' ? reqBody : reqBody == null ? '' : String(reqBody);
      if (!matchesGraphQL(bodyStr, cfg.graphqlFilter)) return origFetch.apply(this, args);
      fire(url);
      return Promise.resolve(new Response(cfg.body, { status: cfg.statusCode, headers: cfg.headers }));
    }
    return origFetch.apply(this, args);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__ohUrl = typeof url === 'string' ? url : url.href;
    origXHROpen.call(this, method, url, async, username, password);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = this.__ohUrl ?? '';
    if (url && matches(url)) {
      const reqBody = args[0];
      const bodyStr = typeof reqBody === 'string' ? reqBody : reqBody == null ? '' : String(reqBody);
      if (!matchesGraphQL(bodyStr, cfg.graphqlFilter)) {
        origXHRSend.apply(this, args);
        return;
      }
      fire(url);
      Object.defineProperty(this, 'status', { get: () => cfg.statusCode });
      Object.defineProperty(this, 'statusText', { get: () => 'OK' });
      Object.defineProperty(this, 'responseText', { get: () => cfg.body });
      Object.defineProperty(this, 'response', { get: () => cfg.body });
      Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
      setTimeout(() => {
        (this as XMLHttpRequest & { readyState: number }).readyState = 4;
        if (this.onreadystatechange) this.onreadystatechange.call(this, new Event('readystatechange'));
        if (this.onload) this.onload.call(this, new ProgressEvent('load'));
      }, 10);
      return;
    }
    origXHRSend.apply(this, args);
  };
}

// ── Static Header Merge (real function) ─────────────────────────────

export function buildHeaderMergeInjection(
  ruleUid: string,
  regexSources: string[],
  requestMerges: HeaderMergeConfig['requestMerges'],
  responseMerges: HeaderMergeConfig['responseMerges'],
): FuncInjection {
  const config: HeaderMergeConfig = {
    ruleUid,
    regexSources,
    requestMerges,
    responseMerges,
  };
  return {
    kind: 'func',
    func: headerMergeInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

function headerMergeInjectionFunc(cfg: HeaderMergeConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'header-merge', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  function mergeValue(existing: string, newVal: string, sep: string): string {
    if (!existing?.trim()) return newVal;
    return existing + sep + newVal;
  }

  if (cfg.requestMerges.length > 0) {
    const origFetch = window.fetch;
    window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const input = args[0];
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
      if (!matches(url)) return origFetch.apply(this, args);
      fire(url);
      const init = args[1] || {};
      const headers = new Headers(init.headers || {});
      for (let i = 0; i < cfg.requestMerges.length; i++) {
        const m = cfg.requestMerges[i]!;
        const existing = headers.get(m.headerName) || '';
        headers.set(m.headerName, mergeValue(existing, m.value, m.separator));
      }
      return origFetch.call(this, input as RequestInfo, Object.assign({}, init, { headers }));
    };

    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __ohUrl?: string; __ohHeaders?: Record<string, string> },
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null,
    ): void {
      this.__ohUrl = typeof url === 'string' ? url : url.href;
      this.__ohHeaders = {};
      origXHROpen.call(this, method, url, async, username, password);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.setRequestHeader = function (
      this: XMLHttpRequest & { __ohHeaders?: Record<string, string> },
      name: string,
      value: string,
    ): void {
      if (this.__ohHeaders) this.__ohHeaders[name.toLowerCase()] = value;
      origXHRSetHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __ohUrl?: string; __ohHeaders?: Record<string, string> },
      ...args: Parameters<XMLHttpRequest['send']>
    ): void {
      const url = this.__ohUrl ?? '';
      if (url && matches(url)) {
        fire(url);
        for (let i = 0; i < cfg.requestMerges.length; i++) {
          const m = cfg.requestMerges[i]!;
          const existing = this.__ohHeaders?.[m.headerName.toLowerCase()] || '';
          origXHRSetHeader.call(this, m.headerName, mergeValue(existing, m.value, m.separator));
        }
      }
      origXHRSend.apply(this, args);
    };
  }

  if (cfg.responseMerges.length > 0) {
    const origFetchR = window.fetch;
    window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const input = args[0];
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
      if (!matches(url)) return origFetchR.apply(this, args);
      fire(url);
      return origFetchR.apply(this, args).then((response) => {
        const newHeaders = new Headers(response.headers);
        for (let i = 0; i < cfg.responseMerges.length; i++) {
          const m = cfg.responseMerges[i]!;
          const existing = newHeaders.get(m.headerName) || '';
          newHeaders.set(m.headerName, mergeValue(existing, m.value, m.separator));
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      });
    };
  }
}

// ── WebSocket messages (real function) ──────────────────────────────

export function buildWsInjection(rule: WsRule): FuncInjection {
  const config: WsConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    operation: rule.action.operation,
    direction: rule.action.direction,
    filter: rule.action.messageFilter,
    payload: rule.action.payload ?? '',
    injectTrigger: rule.action.injectTrigger ?? 'open',
  };
  return {
    kind: 'func',
    func: wsInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Wraps the WebSocket constructor to modify / inject / drop frames on
 * matching sockets. The rule's URL conditions match the SOCKET endpoint
 * (`ws://` / `wss://`), tested at construction. Receive-side
 * interception relies on registration order: the interceptor listener is
 * added before the socket is handed to page code, so its
 * `stopImmediatePropagation()` runs ahead of every page listener
 * (including later `onmessage` assignments). Synthetic re-dispatches are
 * tagged `__ohSynthetic` so the interceptor never reprocesses them.
 *
 * Binary frames: a content filter only matches string data, so filtered
 * modify/drop passes binary frames through untouched; with no filter,
 * every frame in the configured direction is acted on.
 */
function wsInjectionFunc(cfg: WsConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  function matchesMessage(data: unknown): boolean {
    if (!cfg.filter) return true;
    if (typeof data !== 'string') return false;
    if (cfg.filter.matchType === 'regex') {
      try {
        return new RegExp(cfg.filter.value, 'i').test(data);
      } catch {
        return false;
      }
    }
    return data.indexOf(cfg.filter.value) !== -1;
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'ws', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  type SyntheticMessageEvent = MessageEvent & { __ohSynthetic?: boolean };

  function deliver(ws: WebSocket, data: string, origin: string): void {
    const ev = new MessageEvent('message', { data, origin }) as SyntheticMessageEvent;
    ev.__ohSynthetic = true;
    ws.dispatchEvent(ev);
  }

  const OrigWebSocket = window.WebSocket;

  function WrappedWebSocket(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
    const ws = protocols === undefined ? new OrigWebSocket(url) : new OrigWebSocket(url, protocols);
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : String(url);
    if (!matches(urlStr)) return ws;

    if (cfg.direction === 'send' && (cfg.operation === 'modify' || cfg.operation === 'drop')) {
      const origSend = ws.send.bind(ws);
      ws.send = (data: Parameters<WebSocket['send']>[0]): void => {
        if (matchesMessage(data)) {
          fire(urlStr);
          if (cfg.operation === 'drop') return;
          origSend(cfg.payload);
          return;
        }
        origSend(data);
      };
    }

    if (cfg.direction === 'receive' && (cfg.operation === 'modify' || cfg.operation === 'drop')) {
      ws.addEventListener('message', (ev: MessageEvent) => {
        if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
        if (!matchesMessage(ev.data)) return;
        fire(urlStr);
        ev.stopImmediatePropagation();
        if (cfg.operation === 'modify') deliver(ws, cfg.payload, ev.origin);
      });
    }

    if (cfg.operation === 'inject') {
      // Deferred a tick so the synthetic frame lands AFTER the trigger
      // event finishes dispatching to page listeners — a synchronous
      // dispatch from inside the trigger's own listener chain would
      // deliver the injection before the frame that caused it.
      const injectSoon = (): void => {
        setTimeout(() => {
          fire(urlStr);
          if (cfg.direction === 'send') {
            if (ws.readyState === OrigWebSocket.OPEN) ws.send(cfg.payload);
          } else {
            deliver(ws, cfg.payload, urlStr);
          }
        }, 0);
      };
      if (cfg.injectTrigger === 'message') {
        ws.addEventListener('message', (ev: MessageEvent) => {
          if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
          if (!matchesMessage(ev.data)) return;
          injectSoon();
        });
      } else {
        ws.addEventListener('open', () => injectSoon());
      }
    }

    return ws;
  }

  // Constructed instances come from OrigWebSocket, so `instanceof` and
  // prototype patches keep working; statics cover page code reading
  // WebSocket.OPEN and friends off the constructor.
  WrappedWebSocket.prototype = OrigWebSocket.prototype;
  const statics = WrappedWebSocket as unknown as Record<string, number>;
  statics.CONNECTING = OrigWebSocket.CONNECTING;
  statics.OPEN = OrigWebSocket.OPEN;
  statics.CLOSING = OrigWebSocket.CLOSING;
  statics.CLOSED = OrigWebSocket.CLOSED;
  window.WebSocket = WrappedWebSocket as unknown as typeof WebSocket;
}

// ── Server-sent events (real function) ──────────────────────────────

export function buildSseInjection(rule: SseRule): FuncInjection {
  const config: SseConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    operation: rule.action.operation,
    eventName: rule.action.eventName,
    filter: rule.action.messageFilter,
    payload: rule.action.payload ?? '',
    injectTrigger: rule.action.injectTrigger ?? 'open',
  };
  return {
    kind: 'func',
    func: sseInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Wraps the EventSource constructor to modify / inject / drop events on
 * matching streams. The interceptor pre-registers for the configured
 * event type (`eventName`, or the default 'message') at construction —
 * before any page listener or `onmessage` assignment — so
 * `stopImmediatePropagation()` always wins. Same `__ohSynthetic`
 * re-dispatch tagging as the WebSocket wrapper.
 */
function sseInjectionFunc(cfg: SseConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(url)) return true;
    }
    return false;
  }

  function matchesMessage(data: unknown): boolean {
    if (!cfg.filter) return true;
    if (typeof data !== 'string') return false;
    if (cfg.filter.matchType === 'regex') {
      try {
        return new RegExp(cfg.filter.value, 'i').test(data);
      } catch {
        return false;
      }
    }
    return data.indexOf(cfg.filter.value) !== -1;
  }

  function fire(url: string): void {
    try {
      window.postMessage({ __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'sse', t: Date.now() }, '*');
    } catch {
      /* swallow */
    }
  }

  type SyntheticMessageEvent = MessageEvent & { __ohSynthetic?: boolean };

  const eventType = cfg.eventName || 'message';

  function deliver(es: EventSource, data: string, origin: string, lastEventId: string): void {
    const ev = new MessageEvent(eventType, { data, origin, lastEventId }) as SyntheticMessageEvent;
    ev.__ohSynthetic = true;
    es.dispatchEvent(ev);
  }

  const OrigEventSource = window.EventSource;

  function WrappedEventSource(this: unknown, url: string | URL, init?: EventSourceInit): EventSource {
    const es = init === undefined ? new OrigEventSource(url) : new OrigEventSource(url, init);
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : String(url);
    if (!matches(urlStr)) return es;

    if (cfg.operation === 'modify' || cfg.operation === 'drop') {
      es.addEventListener(eventType, (ev: MessageEvent) => {
        if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
        if (!matchesMessage(ev.data)) return;
        fire(urlStr);
        ev.stopImmediatePropagation();
        if (cfg.operation === 'modify') deliver(es, cfg.payload, ev.origin, ev.lastEventId);
      });
    } else {
      // Deferred a tick — same reasoning as the WebSocket wrapper: the
      // synthetic event must land after its trigger finishes dispatching.
      const injectSoon = (): void => {
        setTimeout(() => {
          fire(urlStr);
          deliver(es, cfg.payload, urlStr, '');
        }, 0);
      };
      if (cfg.injectTrigger === 'message') {
        es.addEventListener(eventType, (ev: MessageEvent) => {
          if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
          if (!matchesMessage(ev.data)) return;
          injectSoon();
        });
      } else {
        es.addEventListener('open', () => injectSoon());
      }
    }

    return es;
  }

  WrappedEventSource.prototype = OrigEventSource.prototype;
  const statics = WrappedEventSource as unknown as Record<string, number>;
  statics.CONNECTING = OrigEventSource.CONNECTING;
  statics.OPEN = OrigEventSource.OPEN;
  statics.CLOSED = OrigEventSource.CLOSED;
  window.EventSource = WrappedEventSource as unknown as typeof EventSource;
}

// ── Dynamic Body (inline script — user JS embedded) ─────────────────

/**
 * Dynamic mode — make the real request, then pass to user's modifyRequestBody() function.
 * Stays as a string-template inline-script injection because it embeds arbitrary
 * user JavaScript. On strict-CSP sites this will be blocked — pre-existing limitation.
 */
function generateDynamicBodyScript(rule: BodyRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { body: userCode } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const ruleUidLit = JSON.stringify(rule.uid);
  const graphqlFilter =
    rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : null;
  const graphqlFilterJSON = JSON.stringify(graphqlFilter);

  return `(function(){
${TEST_BRIDGE_CODE}
${URL_MATCHER_CODE}
${GRAPHQL_MATCHER_CODE}
var RULE_UID = ${ruleUidLit};
var REGEX_SOURCES = ${regexSourcesJSON};
var GRAPHQL_FILTER = ${graphqlFilterJSON};

${userCode}

var origFetch = window.fetch;
window.fetch = function() {
  var args = Array.prototype.slice.call(arguments);
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, REGEX_SOURCES) && args[1] && args[1].body) {
    var bodyStr = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body);
    if (!__ohMatchesGraphQL(bodyStr, GRAPHQL_FILTER)) return origFetch.apply(this, args);
    __ohFire(RULE_UID, url, 'body');
    try {
      var bodyAsJson = null;
      try { bodyAsJson = JSON.parse(bodyStr); } catch(e) {}
      var modified = modifyRequestBody({ method: (args[1].method || 'GET'), url: url, body: bodyStr, bodyAsJson: bodyAsJson });
      args[1] = Object.assign({}, args[1], { body: typeof modified === 'object' ? JSON.stringify(modified) : String(modified) });
    } catch(err) { console.error('[Open Headers] modifyRequestBody() error:', err); }
  }
  return origFetch.apply(this, args);
};

var origXHRSend = XMLHttpRequest.prototype.send;
var origXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function() {
  this.__ohUrl = arguments[1] || '';
  this.__ohMethod = arguments[0] || 'GET';
  return origXHROpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function(body) {
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, REGEX_SOURCES) && body) {
    var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (!__ohMatchesGraphQL(bodyStr, GRAPHQL_FILTER)) return origXHRSend.call(this, body);
    __ohFire(RULE_UID, this.__ohUrl, 'body');
    try {
      var bodyAsJson = null;
      try { bodyAsJson = JSON.parse(bodyStr); } catch(e) {}
      var modified = modifyRequestBody({ method: this.__ohMethod, url: this.__ohUrl, body: bodyStr, bodyAsJson: bodyAsJson });
      body = typeof modified === 'object' ? JSON.stringify(modified) : String(modified);
    } catch(err) { console.error('[Open Headers] modifyRequestBody() error:', err); }
  }
  return origXHRSend.call(this, body);
};
})();`;
}

// ── Dynamic Mock (inline script — user JS embedded) ─────────────────

/**
 * Dynamic mode — make the REAL request, then pass the response to the user's
 * modifyResponse() function. Embeds arbitrary user JS — inline-script path only.
 */
function generateDynamicMockScript(rule: MockRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { statusCode, responseBody } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const overrideStatus = statusCode || 0;
  const ruleUidLit = JSON.stringify(rule.uid);
  const graphqlFilter =
    rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : null;
  const graphqlFilterJSON = JSON.stringify(graphqlFilter);

  return `(function(){
${TEST_BRIDGE_CODE}
${URL_MATCHER_CODE}
${GRAPHQL_MATCHER_CODE}
var RULE_UID = ${ruleUidLit};
var REGEX_SOURCES = ${regexSourcesJSON};
var OVERRIDE_STATUS = ${overrideStatus};
var GRAPHQL_FILTER = ${graphqlFilterJSON};

${responseBody}

var origFetch = window.fetch;
window.fetch = function() {
  var args = arguments;
  var self = this;
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (!__ohMatchesUrl(url, REGEX_SOURCES)) return origFetch.apply(self, args);
  var __reqBody = (args[1] && args[1].body) || '';
  var __reqBodyStr = typeof __reqBody === 'string' ? __reqBody : (__reqBody == null ? '' : String(__reqBody));
  if (!__ohMatchesGraphQL(__reqBodyStr, GRAPHQL_FILTER)) return origFetch.apply(self, args);
  __ohFire(RULE_UID, url, 'mock');

  var requestMethod = (args[1] && args[1].method) || 'GET';
  var requestHeaders = (args[1] && args[1].headers) || {};
  var requestData = (args[1] && args[1].body) || null;

  return origFetch.apply(self, args).then(function(response) {
    return response.clone().text().then(function(responseText) {
      var responseJSON = null;
      try { responseJSON = JSON.parse(responseText); } catch(e) {}

      var modifyArgs = {
        method: requestMethod,
        url: url,
        response: responseText,
        responseType: response.headers.get('content-type') || '',
        requestHeaders: requestHeaders instanceof Headers ? Object.fromEntries(requestHeaders.entries()) : requestHeaders,
        requestData: requestData,
        responseJSON: responseJSON,
      };

      try {
        var modified = modifyResponse(modifyArgs);
        var body = typeof modified === 'object' ? JSON.stringify(modified) : String(modified);
        var status = OVERRIDE_STATUS || response.status;
        return new Response(body, { status: status, statusText: response.statusText, headers: response.headers });
      } catch(err) {
        console.error('[Open Headers] modifyResponse() error:', err);
        return response;
      }
    });
  });
};

var origXHROpen = XMLHttpRequest.prototype.open;
var origXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function() {
  this.__ohUrl = arguments[1] || '';
  this.__ohMethod = arguments[0] || 'GET';
  return origXHROpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function(body) {
  var self = this;
  if (!this.__ohUrl || !__ohMatchesUrl(this.__ohUrl, REGEX_SOURCES)) {
    return origXHRSend.apply(this, arguments);
  }
  var __xhrBodyStr = typeof body === 'string' ? body : (body == null ? '' : String(body));
  if (!__ohMatchesGraphQL(__xhrBodyStr, GRAPHQL_FILTER)) {
    return origXHRSend.apply(this, arguments);
  }
  __ohFire(RULE_UID, this.__ohUrl, 'mock');

  var xhrUrl = this.__ohUrl;
  var xhrMethod = this.__ohMethod;
  var origOnReadyStateChange = this.onreadystatechange;
  var origOnLoad = this.onload;

  this.onreadystatechange = null;
  this.onload = null;

  var realOnLoad = function() {
    var responseText = self.responseText;
    var responseJSON = null;
    try { responseJSON = JSON.parse(responseText); } catch(e) {}

    var modifyArgs = {
      method: xhrMethod,
      url: xhrUrl,
      response: responseText,
      responseType: self.getResponseHeader('content-type') || '',
      requestHeaders: {},
      requestData: body,
      responseJSON: responseJSON,
    };

    try {
      var modified = modifyResponse(modifyArgs);
      var modifiedBody = typeof modified === 'object' ? JSON.stringify(modified) : String(modified);
      Object.defineProperty(self, 'responseText', { get: function() { return modifiedBody; }, configurable: true });
      Object.defineProperty(self, 'response', { get: function() { return modifiedBody; }, configurable: true });
      if (OVERRIDE_STATUS) {
        Object.defineProperty(self, 'status', { get: function() { return OVERRIDE_STATUS; }, configurable: true });
      }
    } catch(err) {
      console.error('[Open Headers] modifyResponse() error:', err);
    }

    if (origOnReadyStateChange) origOnReadyStateChange.call(self);
    if (origOnLoad) origOnLoad.call(self);
  };

  this.addEventListener('load', realOnLoad, { once: true });
  return origXHRSend.call(this, body);
};
})();`;
}

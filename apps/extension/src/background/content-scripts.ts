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

import type { V5 } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';

// ── Injection result types ──────────────────────────────────────────

/**
 * CSP-safe real-function injection for static rule variants. The func is
 * typed with `never` in the parameter slot because it's serialized via
 * `Function.prototype.toString` and executed in the page's MAIN world by
 * `chrome.scripting.executeScript` — it is never called directly from the
 * background. The `never` contravariance sink means you cannot accidentally
 * invoke it with the wrong config shape from TypeScript code.
 */
export interface FuncInjection {
  kind: 'func';
  func: (cfg: never) => void;
  args: [unknown];
}

/** Inline-script injection for dynamic rules that embed user JS. */
export interface InlineScriptInjection {
  kind: 'inline-script';
  code: string;
}

export type Injection = FuncInjection | InlineScriptInjection;

// ── Per-rule config shapes passed into injected funcs ───────────────

interface DelayConfig {
  ruleUid: string;
  regexSources: string[];
  delayMs: number;
}

interface StaticBodyConfig {
  ruleUid: string;
  regexSources: string[];
  body: string;
}

interface StaticMockConfig {
  ruleUid: string;
  regexSources: string[];
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

interface HeaderMergeConfig {
  ruleUid: string;
  regexSources: string[];
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
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

// ── Static Delay (real function) ────────────────────────────────────

export function buildDelayInjection(rule: V5.DelayRule): FuncInjection {
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
      window.postMessage(
        { __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'delay', t: Date.now() },
        '*',
      );
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

export function buildBodyInjection(rule: V5.BodyRule): Injection {
  const bodyType = rule.action.bodyType || 'static';
  if (bodyType === 'dynamic') {
    return { kind: 'inline-script', code: generateDynamicBodyScript(rule) };
  }
  const config: StaticBodyConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    body: rule.action.body,
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

  function fire(url: string): void {
    try {
      window.postMessage(
        { __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'body', t: Date.now() },
        '*',
      );
    } catch {
      /* swallow */
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
    if (matches(url) && args[1]) {
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
      fire(url);
      origXHRSend.call(this, cfg.body);
      return;
    }
    origXHRSend.apply(this, args);
  };
}

// ── Static Mock (real function) ─────────────────────────────────────

export function buildMockInjection(rule: V5.MockRule): Injection {
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

  function fire(url: string): void {
    try {
      window.postMessage(
        { __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'mock', t: Date.now() },
        '*',
      );
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
      window.postMessage(
        { __ohFire: true, ruleUid: cfg.ruleUid, url, kind: 'header-merge', t: Date.now() },
        '*',
      );
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

// ── Dynamic Body (inline script — user JS embedded) ─────────────────

/**
 * Dynamic mode — make the real request, then pass to user's modifyRequestBody() function.
 * Stays as a string-template inline-script injection because it embeds arbitrary
 * user JavaScript. On strict-CSP sites this will be blocked — pre-existing limitation.
 */
function generateDynamicBodyScript(rule: V5.BodyRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { body: userCode } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const ruleUidLit = JSON.stringify(rule.uid);

  return `(function(){
${TEST_BRIDGE_CODE}
${URL_MATCHER_CODE}
var RULE_UID = ${ruleUidLit};
var REGEX_SOURCES = ${regexSourcesJSON};

${userCode}

var origFetch = window.fetch;
window.fetch = function() {
  var args = Array.prototype.slice.call(arguments);
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, REGEX_SOURCES) && args[1] && args[1].body) {
    __ohFire(RULE_UID, url, 'body');
    try {
      var bodyStr = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body);
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
    __ohFire(RULE_UID, this.__ohUrl, 'body');
    try {
      var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
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
function generateDynamicMockScript(rule: V5.MockRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { statusCode, responseBody } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const overrideStatus = statusCode || 0;
  const ruleUidLit = JSON.stringify(rule.uid);

  return `(function(){
${TEST_BRIDGE_CODE}
${URL_MATCHER_CODE}
var RULE_UID = ${ruleUidLit};
var REGEX_SOURCES = ${regexSourcesJSON};
var OVERRIDE_STATUS = ${overrideStatus};

${responseBody}

var origFetch = window.fetch;
window.fetch = function() {
  var args = arguments;
  var self = this;
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (!__ohMatchesUrl(url, REGEX_SOURCES)) return origFetch.apply(self, args);
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

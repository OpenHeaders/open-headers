/**
 * Response wrapper — "Modify Response" across the source×bodyType matrix.
 * Static cells use a self-contained func injection (mock synthesizes a reply;
 * network swaps the real response body). Dynamic cells embed the user's
 * `buildResponse()` / `modifyResponse()` in a string-template inline script.
 */

import type { ResponseRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { Injection } from '../builders/types';
import { GRAPHQL_MATCHER_CODE, TEST_BRIDGE_CODE, URL_MATCHER_CODE } from './inline-helpers';
import type { GraphqlFilter, OhOriginals, StaticResponseConfig } from './types';

export function buildResponseInjection(rule: ResponseRule): Injection {
  const bodyType = rule.action.bodyType || 'static';
  if (bodyType === 'dynamic') {
    return { kind: 'inline-script', code: generateDynamicResponseScript(rule) };
  }
  const { responseSource, statusCode, responseBody, contentType, responseHeaders } = rule.action;
  const config: StaticResponseConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    source: responseSource,
    statusCode,
    body: responseBody,
    contentType,
    responseHeaders,
    graphqlFilter:
      rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : undefined,
  };
  return {
    kind: 'func',
    func: staticResponseInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

function staticResponseInjectionFunc(cfg: StaticResponseConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    // Resolve relative / scheme-relative URLs against the page base so
    // `fetch('/api/x')` matches an absolute-URL pattern — the regexes are
    // compiled from absolute patterns, which is also what the network
    // layer sees. Absolute URLs resolve to themselves (idempotent).
    let abs = url;
    try {
      abs = new URL(url, document.baseURI).href;
    } catch {
      /* not resolvable — match against the raw value */
    }
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(abs)) return true;
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
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'response');
  }

  // mock: build headers from scratch (CT defaults to JSON). network: start
  // from the real response and layer the override on top (empty CT = no
  // override, empty map = keep the server's headers). The real body-framing
  // headers describe the original bytes, so drop them before the substituted
  // body lands — the attached fulfill path strips the same set, and a user
  // override (applied after) can still re-set one.
  function buildHeaders(real?: Headers): Headers {
    const h = real ? new Headers(real) : new Headers();
    if (real) for (const k of ['content-encoding', 'content-length', 'transfer-encoding']) h.delete(k);
    const ct = cfg.contentType || (cfg.source === 'mock' ? 'application/json' : '');
    if (ct) h.set('Content-Type', ct);
    for (const k in cfg.responseHeaders) h.set(k, cfg.responseHeaders[k]!);
    return h;
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
      if (cfg.source === 'mock') {
        return Promise.resolve(new Response(cfg.body, { status: cfg.statusCode || 200, headers: buildHeaders() }));
      }
      return origFetch.apply(this, args).then(
        (real) =>
          new Response(cfg.body, {
            status: cfg.statusCode || real.status,
            statusText: real.statusText,
            headers: buildHeaders(real.headers),
          }),
      );
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
      if (cfg.source === 'mock') {
        // Synthetic: never call the real send, fabricate readyState 4.
        Object.defineProperty(this, 'status', { get: () => cfg.statusCode || 200 });
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
      // network: send for real, swap the body once the response lands.
      // `status === 0` keeps the real status. Header overrides are
      // fetch-only — XHR exposes no writable response-header surface.
      const origOnLoad = this.onload;
      const origOnRSC = this.onreadystatechange;
      this.onload = null;
      this.onreadystatechange = null;
      this.addEventListener(
        'load',
        () => {
          Object.defineProperty(this, 'responseText', { get: () => cfg.body, configurable: true });
          Object.defineProperty(this, 'response', { get: () => cfg.body, configurable: true });
          if (cfg.statusCode !== 0) {
            Object.defineProperty(this, 'status', { get: () => cfg.statusCode, configurable: true });
          }
          if (origOnRSC) origOnRSC.call(this, new Event('readystatechange'));
          if (origOnLoad) origOnLoad.call(this, new ProgressEvent('load'));
        },
        { once: true },
      );
      origXHRSend.apply(this, args);
      return;
    }
    origXHRSend.apply(this, args);
  };
}

// ── Dynamic Response (inline script — user JS embedded) ─────────────
//
// Both dynamic cells embed arbitrary user JS, so they take the
// inline-<script> path (CSP-bound). The source axis picks the contract:
//   - network → user defines `modifyResponse(args)`; the real request is
//               sent and its response transformed.
//   - mock    → user defines `buildResponse({method,url,requestBody})`;
//               nothing is fetched and a synthetic reply is built from the
//               return value.

function generateDynamicResponseScript(rule: ResponseRule): string {
  return rule.action.responseSource === 'mock' ? dynamicMockResponseScript(rule) : dynamicNetworkResponseScript(rule);
}

/**
 * network + dynamic — send the REAL request, then hand the response to the
 * user's modifyResponse(). CT/header overrides are merged onto the real
 * response headers (fetch only; XHR exposes no writable header surface).
 */
function dynamicNetworkResponseScript(rule: ResponseRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { statusCode, responseBody, contentType, responseHeaders } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const overrideStatus = statusCode || 0;
  const ruleUidLit = JSON.stringify(rule.uid);
  const contentTypeLit = JSON.stringify(contentType || '');
  const headersJSON = JSON.stringify(responseHeaders || {});
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
var CONTENT_TYPE = ${contentTypeLit};
var EXTRA_HEADERS = ${headersJSON};
var GRAPHQL_FILTER = ${graphqlFilterJSON};

function __ohMergeHeaders(real) {
  var h = new Headers(real);
  h.delete('content-encoding'); h.delete('content-length'); h.delete('transfer-encoding');
  if (CONTENT_TYPE) h.set('Content-Type', CONTENT_TYPE);
  for (var k in EXTRA_HEADERS) h.set(k, EXTRA_HEADERS[k]);
  return h;
}

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
  __ohFire(RULE_UID, url, 'response');

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
        return new Response(body, { status: status, statusText: response.statusText, headers: __ohMergeHeaders(response.headers) });
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
  __ohFire(RULE_UID, this.__ohUrl, 'response');

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

/**
 * mock + dynamic — never touch the network. The user's buildResponse()
 * returns the body for a synthetic reply; status/CT/headers come from the
 * rule's static fields (statusCode falls back to 200, CT to JSON).
 */
function dynamicMockResponseScript(rule: ResponseRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { statusCode, responseBody, contentType, responseHeaders } = rule.action;
  const regexSourcesJSON = JSON.stringify(regexSources);
  const status = statusCode || 200;
  const ruleUidLit = JSON.stringify(rule.uid);
  const contentTypeLit = JSON.stringify(contentType || 'application/json');
  const headersJSON = JSON.stringify(responseHeaders || {});
  const graphqlFilter =
    rule.action.resourceType === 'graphql' && rule.action.graphqlFilter?.key ? rule.action.graphqlFilter : null;
  const graphqlFilterJSON = JSON.stringify(graphqlFilter);

  return `(function(){
${TEST_BRIDGE_CODE}
${URL_MATCHER_CODE}
${GRAPHQL_MATCHER_CODE}
var RULE_UID = ${ruleUidLit};
var REGEX_SOURCES = ${regexSourcesJSON};
var STATUS = ${status};
var CONTENT_TYPE = ${contentTypeLit};
var EXTRA_HEADERS = ${headersJSON};
var GRAPHQL_FILTER = ${graphqlFilterJSON};

function __ohBuildHeaders() {
  var h = {};
  h['Content-Type'] = CONTENT_TYPE;
  for (var k in EXTRA_HEADERS) h[k] = EXTRA_HEADERS[k];
  return h;
}

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
  __ohFire(RULE_UID, url, 'response');
  try {
    var requestMethod = (args[1] && args[1].method) || 'GET';
    var built = buildResponse({ method: requestMethod, url: url, requestBody: __reqBodyStr });
    var body = typeof built === 'object' ? JSON.stringify(built) : String(built);
    return Promise.resolve(new Response(body, { status: STATUS, headers: __ohBuildHeaders() }));
  } catch(err) {
    console.error('[Open Headers] buildResponse() error:', err);
    return origFetch.apply(self, args);
  }
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
  __ohFire(RULE_UID, this.__ohUrl, 'response');
  try {
    var built = buildResponse({ method: this.__ohMethod, url: this.__ohUrl, requestBody: __xhrBodyStr });
    var out = typeof built === 'object' ? JSON.stringify(built) : String(built);
    Object.defineProperty(this, 'status', { get: function() { return STATUS; }, configurable: true });
    Object.defineProperty(this, 'statusText', { get: function() { return 'OK'; }, configurable: true });
    Object.defineProperty(this, 'responseText', { get: function() { return out; }, configurable: true });
    Object.defineProperty(this, 'response', { get: function() { return out; }, configurable: true });
    Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
    setTimeout(function() {
      self.readyState = 4;
      if (self.onreadystatechange) self.onreadystatechange.call(self, new Event('readystatechange'));
      if (self.onload) self.onload.call(self, new ProgressEvent('load'));
    }, 10);
  } catch(err) {
    console.error('[Open Headers] buildResponse() error:', err);
    return origXHRSend.apply(this, arguments);
  }
};
})();`;
}

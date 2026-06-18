/**
 * Request-body wrapper — rewrites the OUTGOING request body on matching
 * fetch/XHR. Static bodyType substitutes the literal body via a self-contained
 * func injection; dynamic bodyType embeds the user's `modifyRequestBody()` in a
 * string-template inline script (CSP-bound on the onCommitted path).
 */

import type { RequestBodyRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { Injection } from '../builders/types';
import { GRAPHQL_MATCHER_CODE, TEST_BRIDGE_CODE, URL_MATCHER_CODE } from './inline-helpers';
import type { GraphqlFilter, OhOriginals, StaticBodyConfig } from './types';

export function buildRequestBodyInjection(rule: RequestBodyRule): Injection {
  const bodyType = rule.action.bodyType || 'static';
  if (bodyType === 'dynamic') {
    return { kind: 'inline-script', code: generateDynamicRequestBodyScript(rule) };
  }
  const config: StaticBodyConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    body: rule.action.requestBody,
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
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'request-body');
  }

  function absoluteUrl(url: string): string {
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return url;
    }
  }

  // Relay the two-sided request-body capture — what the page produced
  // (`original`) and what actually goes on the wire (`sent`). Page-invisible;
  // the request hasn't been sent yet, so `Date.now()` is the join anchor.
  function captureRequest(url: string, method: string, original: string, sent: string): void {
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.captureRequest({
      ruleUid: cfg.ruleUid,
      url: absoluteUrl(url),
      method,
      startedAt: Date.now(),
      sent: { method, body: { content: sent, encoding: '' } },
      original: { method, body: { content: original, encoding: '' } },
    });
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
      const method = (args[1] as RequestInit).method || 'GET';
      captureRequest(url, method, bodyStr, cfg.body);
      args[1] = Object.assign({}, args[1], { body: cfg.body });
    }
    return origFetch.apply(this, args);
  };

  const origXHRSend = XMLHttpRequest.prototype.send;
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ohUrl?: string; __ohMethod?: string },
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__ohUrl = typeof url === 'string' ? url : url.href;
    this.__ohMethod = method;
    origXHROpen.call(this, method, url, async, username, password);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ohUrl?: string; __ohMethod?: string },
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
      captureRequest(url, this.__ohMethod ?? 'GET', bodyStr, cfg.body);
      origXHRSend.call(this, cfg.body);
      return;
    }
    origXHRSend.apply(this, args);
  };
}

// ── Dynamic Body (inline script — user JS embedded) ─────────────────

/**
 * Dynamic mode — make the real request, then pass to user's modifyRequestBody() function.
 * Stays as a string-template inline-script injection because it embeds arbitrary
 * user JavaScript. On strict-CSP sites this will be blocked — pre-existing limitation.
 * The body-present gate is `!= null` (not truthiness) so a present-but-empty body
 * (`body: ''` / `send('')`) is still a body — transformed and fired, never skipped.
 */
function generateDynamicRequestBodyScript(rule: RequestBodyRule): string {
  const regexSources = compileRuleForInjection(rule);
  const { requestBody: userCode } = rule.action;
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

function __ohAbs(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
function __ohCaptureRequest(url, method, original, sent) {
  try {
    if (window.__ohOrig && window.__ohOrig.captureRequest) window.__ohOrig.captureRequest({
      ruleUid: RULE_UID, url: __ohAbs(url), method: method, startedAt: Date.now(),
      sent: { method: method, body: { content: sent, encoding: '' } },
      original: { method: method, body: { content: original, encoding: '' } },
    });
  } catch (e) {}
}

${userCode}

var origFetch = window.fetch;
window.fetch = function() {
  var args = Array.prototype.slice.call(arguments);
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, REGEX_SOURCES) && args[1] && args[1].body != null) {
    var bodyStr = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body);
    if (!__ohMatchesGraphQL(bodyStr, GRAPHQL_FILTER)) return origFetch.apply(this, args);
    __ohFire(RULE_UID, url, 'request-body');
    try {
      var bodyAsJson = null;
      try { bodyAsJson = JSON.parse(bodyStr); } catch(e) {}
      var method = args[1].method || 'GET';
      var modified = modifyRequestBody({ method: method, url: url, body: bodyStr, bodyAsJson: bodyAsJson });
      var sentBody = typeof modified === 'object' ? JSON.stringify(modified) : String(modified);
      __ohCaptureRequest(url, method, bodyStr, sentBody);
      args[1] = Object.assign({}, args[1], { body: sentBody });
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
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, REGEX_SOURCES) && body != null) {
    var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (!__ohMatchesGraphQL(bodyStr, GRAPHQL_FILTER)) return origXHRSend.call(this, body);
    __ohFire(RULE_UID, this.__ohUrl, 'request-body');
    try {
      var bodyAsJson = null;
      try { bodyAsJson = JSON.parse(bodyStr); } catch(e) {}
      var modified = modifyRequestBody({ method: this.__ohMethod, url: this.__ohUrl, body: bodyStr, bodyAsJson: bodyAsJson });
      var sentBody = typeof modified === 'object' ? JSON.stringify(modified) : String(modified);
      __ohCaptureRequest(this.__ohUrl, this.__ohMethod, bodyStr, sentBody);
      body = sentBody;
    } catch(err) { console.error('[Open Headers] modifyRequestBody() error:', err); }
  }
  return origXHRSend.call(this, body);
};
})();`;
}

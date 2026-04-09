/**
 * Content script generators for rules that can't use declarativeNetRequest.
 *
 * These rules work by monkey-patching fetch() and XMLHttpRequest in the
 * page's JS context. This only intercepts requests made by page JavaScript
 * (fetch, XHR), NOT static resource loads (<img>, <script src>, etc.).
 *
 * Each generator returns a self-contained IIFE string that gets injected
 * via chrome.scripting.executeScript with world: 'MAIN'.
 */

import type { V5 } from '@openheaders/core/types';

// ── Shared URL matching (embedded in every generated script) ────

const URL_MATCHER_CODE = [
  'function __ohMatchesUrl(url, patterns) {',
  '  for (var i = 0; i < patterns.length; i++) {',
  '    var p = patterns[i];',
  '    if (p === "*") return true;',
  '    if (p.indexOf("*") === -1) {',
  '      if (url.indexOf(p) !== -1) return true;',
  '    } else {',
  '      var re = new RegExp("^" + p.replace(/[.+?^${}()|[\\]\\\\]/g, "\\\\$&").replace(/\\*/g, ".*") + "$");',
  '      if (re.test(url)) return true;',
  '      if (url.indexOf(p.replace(/\\*/g, "")) !== -1) return true;',
  '    }',
  '  }',
  '  return false;',
  '}',
].join('\n');

/** Extract host domain values from conditions for embedding in scripts. */
function extractPatterns(rule: V5.Rule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'host' && !c.exclude)
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
}

function escapeForJS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// ── Delay script ────────────────────────────────────────────────

export function generateDelayScript(rule: V5.DelayRule): string {
  const patterns = extractPatterns(rule);
  const delayMs = Math.max(0, Math.min(rule.action.delayMs, 5000)); // cap at 5s for fetch/XHR in extension
  const patternsJSON = JSON.stringify(patterns);

  return `(function(){
${URL_MATCHER_CODE}
var DELAY_MS = ${delayMs};
var PATTERNS = ${patternsJSON};

var origFetch = window.fetch;
window.fetch = function() {
  var args = arguments;
  var self = this;
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, PATTERNS)) {
    return new Promise(function(resolve) {
      setTimeout(function() { resolve(origFetch.apply(self, args)); }, DELAY_MS);
    });
  }
  return origFetch.apply(self, args);
};

var origXHROpen = XMLHttpRequest.prototype.open;
var origXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function() {
  this.__ohUrl = arguments[1] || '';
  return origXHROpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function() {
  var self = this;
  var args = arguments;
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, PATTERNS)) {
    setTimeout(function() { origXHRSend.apply(self, args); }, DELAY_MS);
  } else {
    origXHRSend.apply(self, args);
  }
};
})();`;
}

// ── Body modification script ────────────────────────────────────

export function generateBodyScript(rule: V5.BodyRule): string {
  const bodyType = rule.action.bodyType || 'static';
  return bodyType === 'dynamic' ? generateDynamicBodyScript(rule) : generateStaticBodyScript(rule);
}

/**
 * Static mode — replace the entire request/response body with a literal value.
 */
function generateStaticBodyScript(rule: V5.BodyRule): string {
  const patterns = extractPatterns(rule);
  const { body } = rule.action;
  const patternsJSON = JSON.stringify(patterns);

  return `(function(){
${URL_MATCHER_CODE}
var PATTERNS = ${patternsJSON};
var BODY = '${escapeForJS(body)}';

var origFetch = window.fetch;
window.fetch = function() {
  var args = Array.prototype.slice.call(arguments);
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, PATTERNS) && args[1]) {
    args[1] = Object.assign({}, args[1], { body: BODY });
  }
  return origFetch.apply(this, args);
};

var origXHRSend = XMLHttpRequest.prototype.send;
var origXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function() {
  this.__ohUrl = arguments[1] || '';
  return origXHROpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function() {
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, PATTERNS)) {
    return origXHRSend.call(this, BODY);
  }
  return origXHRSend.apply(this, arguments);
};
})();`;
}

/**
 * Dynamic mode — make the real request, then pass to user's modifyRequestBody() function.
 */
function generateDynamicBodyScript(rule: V5.BodyRule): string {
  const patterns = extractPatterns(rule);
  const { body: userCode } = rule.action;
  const patternsJSON = JSON.stringify(patterns);

  return `(function(){
${URL_MATCHER_CODE}
var PATTERNS = ${patternsJSON};

${userCode}

var origFetch = window.fetch;
window.fetch = function() {
  var args = Array.prototype.slice.call(arguments);
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, PATTERNS) && args[1] && args[1].body) {
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
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, PATTERNS) && body) {
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

// ── Mock / Modify API Response script ────────────────────────────

export function generateMockScript(rule: V5.MockRule): string {
  const bodyType = rule.action.bodyType || 'static';
  return bodyType === 'dynamic' ? generateDynamicMockScript(rule) : generateStaticMockScript(rule);
}

/**
 * Static mode — intercept fetch/XHR, return a fixed response without hitting the server.
 */
function generateStaticMockScript(rule: V5.MockRule): string {
  const patterns = extractPatterns(rule);
  const { statusCode, responseBody, contentType, responseHeaders } = rule.action;
  const patternsJSON = JSON.stringify(patterns);
  const headersJSON = JSON.stringify({ 'Content-Type': contentType || 'application/json', ...responseHeaders });

  return `(function(){
${URL_MATCHER_CODE}
var PATTERNS = ${patternsJSON};
var STATUS = ${statusCode || 200};
var BODY = '${escapeForJS(responseBody)}';
var HEADERS = ${headersJSON};

var origFetch = window.fetch;
window.fetch = function() {
  var args = arguments;
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (__ohMatchesUrl(url, PATTERNS)) {
    return Promise.resolve(new Response(BODY, { status: STATUS, headers: HEADERS }));
  }
  return origFetch.apply(this, args);
};

var origXHROpen = XMLHttpRequest.prototype.open;
var origXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function() {
  this.__ohUrl = arguments[1] || '';
  this.__ohMethod = arguments[0] || 'GET';
  return origXHROpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function() {
  if (this.__ohUrl && __ohMatchesUrl(this.__ohUrl, PATTERNS)) {
    var self = this;
    Object.defineProperty(self, 'status', { get: function() { return STATUS; } });
    Object.defineProperty(self, 'statusText', { get: function() { return 'OK'; } });
    Object.defineProperty(self, 'responseText', { get: function() { return BODY; } });
    Object.defineProperty(self, 'response', { get: function() { return BODY; } });
    Object.defineProperty(self, 'readyState', { writable: true, value: 4 });
    setTimeout(function() {
      self.readyState = 4;
      if (self.onreadystatechange) self.onreadystatechange();
      if (self.onload) self.onload();
    }, 10);
    return;
  }
  return origXHRSend.apply(this, arguments);
};
})();`;
}

/**
 * Dynamic mode — make the REAL request, then pass the response to the user's
 * modifyResponse() function. The function can inspect request context (method,
 * url, headers, body) and the original response, then return the modified response.
 */
function generateDynamicMockScript(rule: V5.MockRule): string {
  const patterns = extractPatterns(rule);
  const { statusCode, responseBody } = rule.action;
  const patternsJSON = JSON.stringify(patterns);
  const overrideStatus = statusCode || 0; // 0 = keep original

  return `(function(){
${URL_MATCHER_CODE}
var PATTERNS = ${patternsJSON};
var OVERRIDE_STATUS = ${overrideStatus};

${responseBody}

var origFetch = window.fetch;
window.fetch = function() {
  var args = arguments;
  var self = this;
  var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (!__ohMatchesUrl(url, PATTERNS)) return origFetch.apply(self, args);

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
  if (!this.__ohUrl || !__ohMatchesUrl(this.__ohUrl, PATTERNS)) {
    return origXHRSend.apply(this, arguments);
  }

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

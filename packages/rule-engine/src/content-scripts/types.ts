/**
 * Per-rule config shapes passed into the injected funcs, plus the
 * {@link OhOriginals} capture shape. Pure types shared across the wrapper
 * modules in this directory; the funcs reference these only in type position
 * (erased before serialization), so importing them never breaks a wrapper's
 * self-contained `Function.prototype.toString` form.
 */

export interface DelayConfig {
  ruleUid: string;
  regexSources: string[];
  delayMs: number;
}

export interface GraphqlFilter {
  key: string;
  operator: 'Equals' | 'Contains';
  value: string;
}

export interface StaticBodyConfig {
  ruleUid: string;
  regexSources: string[];
  body: string;
  graphqlFilter?: GraphqlFilter;
}

export interface StaticResponseConfig {
  ruleUid: string;
  regexSources: string[];
  // 'mock' = synthetic reply, the request never leaves the browser;
  // 'network' = the real request is sent, then its response is rewritten.
  source: 'mock' | 'network';
  // Raw action fields — the func applies the per-source fallbacks: mock
  // treats `statusCode === 0` as 200 and `contentType === ''` as JSON;
  // network treats `0` as "keep the real status" and `''` as "no CT override".
  statusCode: number;
  body: string;
  contentType: string;
  responseHeaders: Record<string, string>;
  graphqlFilter?: GraphqlFilter;
}

export interface HeaderMergeConfig {
  ruleUid: string;
  regexSources: string[];
  requestMerges: Array<{ headerName: string; value: string; separator: string }>;
  responseMerges: Array<{ headerName: string; value: string; separator: string }>;
}

export interface MessageFilterConfig {
  matchType: 'contains' | 'regex';
  value: string;
}

export interface WsConfig {
  ruleUid: string;
  regexSources: string[];
  operation: 'modify' | 'inject' | 'drop';
  direction: 'send' | 'receive';
  filter?: MessageFilterConfig;
  payload: string;
  injectTrigger: 'open' | 'message';
}

export interface SseConfig {
  ruleUid: string;
  regexSources: string[];
  operation: 'modify' | 'inject' | 'drop';
  eventName?: string;
  filter?: MessageFilterConfig;
  payload: string;
  injectTrigger: 'open' | 'message';
}

export interface OhOriginals {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
  xhrSetHeader: typeof XMLHttpRequest.prototype.setRequestHeader;
  WebSocket: typeof window.WebSocket;
  EventSource: typeof window.EventSource;
  /** The one fire dispatcher (see {@link ohSetupFunc}). Every wrapper reports
   *  through this so the binding-vs-postMessage choice lives in one place. */
  fire: (ruleUid: string, url: string, kind: string) => void;
}

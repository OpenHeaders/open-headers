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

/**
 * One side of a page-relayed response capture — the status / headers / body the
 * server sent (`original`) or the page received (`served`). Structurally the
 * `InspectorResponseSnapshot` the engine reduces against; kept as a local shape
 * so the injected wrapper stays decoupled from the lifecycle types (it builds
 * plain objects, the background handler casts the relayed payload).
 */
export interface OhCaptureSnapshot {
  statusCode?: number;
  statusText?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { content: string; encoding: '' | 'base64' };
}

/** The two-sided response capture a response rule relays — what the page
 *  received (`served`) and, for a network-source rule, the real server reply
 *  (`original`). `startedAt` is the request's start instant (the join anchor). */
export interface OhResponseCapture {
  ruleUid: string;
  url: string;
  method: string;
  startedAt: number;
  served: OhCaptureSnapshot;
  original?: OhCaptureSnapshot;
}

/** Request-side snapshot — structurally `InspectorRequestSnapshot`. */
export interface OhRequestSnapshot {
  method?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { content: string; encoding: '' | 'base64' };
}

/** The two-sided request-body capture — what actually went to the server
 *  (`sent`) and what the page originally produced (`original`). */
export interface OhRequestCapture {
  ruleUid: string;
  url: string;
  method: string;
  startedAt: number;
  sent: OhRequestSnapshot;
  original?: OhRequestSnapshot;
}

/**
 * One per-message capture the WebSocket / EventSource wrappers relay
 * when they act on a frame/event — structurally the core
 * `StreamMessageCapture` plus the join keys the background needs
 * (`url` = the resolved endpoint, `t` = the wrapper's wall clock) since
 * the page never knows the requestId. SSE captures are always
 * `receive` and carry `eventName`, the event type acted on.
 */
export interface OhMessageCapture {
  ruleUid: string;
  url: string;
  t: number;
  direction: 'send' | 'receive';
  op: 'replaced' | 'dropped' | 'injected';
  eventName?: string;
  original?: string;
  delivered?: string;
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
  /**
   * Relay a two-sided response capture for a rule that modified the response in
   * page context (standard mode — a CDP-armed tab captures via the Fetch
   * interceptor instead). Page-invisible `window.postMessage` to the fire
   * bridge; never blocks the page's own response.
   */
  captureResponse: (capture: OhResponseCapture) => void;
  /** The request-side twin — a two-sided request-body capture. */
  captureRequest: (capture: OhRequestCapture) => void;
  /** Per-frame WebSocket capture — the ws wrapper reports each frame it
   *  replaced/dropped/injected so the panel can show the side the wire
   *  never carried. Page-invisible `window.postMessage`, like the body
   *  captures. */
  captureMessage: (capture: OhMessageCapture) => void;
}

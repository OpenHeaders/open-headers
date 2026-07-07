/**
 * Normalizers — raw CDP `onEvent` params → the oracle's chrome-free event
 * shapes (CdpNetworkEvent / CdpPageEvent / CdpFetchEvent), plus the private
 * fire-bridge payload parser. Pure functions; the adapter routes events here
 * after gating the session and method. Page-domain events are stamped with the
 * synthetic root session id (page timings are a main-frame, root-only concern).
 */

import type { ConsoleArg, ConsoleEntry, ConsoleLevel } from '@openheaders/core/console-stream';
import type {
  CdpAuthRequired,
  CdpCallFrame,
  CdpInitiator,
  CdpNetworkEvent,
  CdpPageEvent,
  CdpPageFrame,
  CdpRequestParams,
  CdpRequestPaused,
  CdpResourceTiming,
  CdpResponseParams,
  CdpStackTrace,
} from '@openheaders/oracle/correlator-cdp';
import type {
  RawAuthRequired,
  RawCallFrame,
  RawConsoleApiCalled,
  RawDataReceived,
  RawEventSourceMessageReceived,
  RawExceptionDetails,
  RawExceptionThrown,
  RawFrameNavigated,
  RawFrameStoppedLoading,
  RawInitiator,
  RawLoadingFailed,
  RawLoadingFinished,
  RawLogEntry,
  RawLogEntryAdded,
  RawObjectPreview,
  RawPageFrame,
  RawPageLifecycleTimestamp,
  RawPropertyPreview,
  RawRemoteObject,
  RawRequest,
  RawRequestPaused,
  RawRequestWillBeSent,
  RawRequestWillBeSentExtraInfo,
  RawResourceTiming,
  RawResponse,
  RawResponseReceived,
  RawResponseReceivedExtraInfo,
  RawStackTrace,
  RawWebSocketClosed,
  RawWebSocketCreated,
  RawWebSocketFrameError,
  RawWebSocketFrameEvent,
  RawWebSocketHandshakeResponseReceived,
  RawWebSocketWillSendHandshakeRequest,
} from './cdp-raw-payloads';
import { type CdpBindingFire, ROOT_SESSION_ID } from './cdp-session';

export function normalizeRequestWillBeSent(tabId: number, sessionId: string, p: RawRequestWillBeSent): CdpNetworkEvent {
  return {
    method: 'Network.requestWillBeSent',
    tabId,
    sessionId,
    requestId: p.requestId,
    loaderId: p.loaderId,
    documentURL: p.documentURL,
    request: normalizeRequest(p.request),
    timestamp: p.timestamp,
    wallTime: p.wallTime,
    ...(p.initiator !== undefined ? { initiator: normalizeInitiator(p.initiator) } : {}),
    ...(p.redirectResponse !== undefined ? { redirectResponse: normalizeResponse(p.redirectResponse) } : {}),
    ...(p.type !== undefined ? { type: p.type } : {}),
    ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
  };
}

export function normalizeResponseReceived(tabId: number, sessionId: string, p: RawResponseReceived): CdpNetworkEvent {
  return {
    method: 'Network.responseReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    type: p.type,
    response: normalizeResponse(p.response),
  };
}

export function normalizeDataReceived(tabId: number, sessionId: string, p: RawDataReceived): CdpNetworkEvent {
  return {
    method: 'Network.dataReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    dataLength: p.dataLength,
    encodedDataLength: p.encodedDataLength,
  };
}

export function normalizeLoadingFinished(tabId: number, sessionId: string, p: RawLoadingFinished): CdpNetworkEvent {
  return {
    method: 'Network.loadingFinished',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    encodedDataLength: p.encodedDataLength,
  };
}

export function normalizeLoadingFailed(tabId: number, sessionId: string, p: RawLoadingFailed): CdpNetworkEvent {
  return {
    method: 'Network.loadingFailed',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    type: p.type,
    errorText: p.errorText,
    ...(p.canceled !== undefined ? { canceled: p.canceled } : {}),
    ...(p.blockedReason !== undefined ? { blockedReason: p.blockedReason } : {}),
  };
}

export function normalizeRequestWillBeSentExtraInfo(
  tabId: number,
  sessionId: string,
  p: RawRequestWillBeSentExtraInfo,
): CdpNetworkEvent {
  return {
    method: 'Network.requestWillBeSentExtraInfo',
    tabId,
    sessionId,
    requestId: p.requestId,
    headers: p.headers,
  };
}

export function normalizeResponseReceivedExtraInfo(
  tabId: number,
  sessionId: string,
  p: RawResponseReceivedExtraInfo,
): CdpNetworkEvent {
  return {
    method: 'Network.responseReceivedExtraInfo',
    tabId,
    sessionId,
    requestId: p.requestId,
    headers: p.headers,
  };
}

// ── WebSocket / EventSource normalizers ──────────────────────────────

export function normalizeWebSocketCreated(tabId: number, sessionId: string, p: RawWebSocketCreated): CdpNetworkEvent {
  return {
    method: 'Network.webSocketCreated',
    tabId,
    sessionId,
    requestId: p.requestId,
    url: p.url,
    ...(p.initiator !== undefined ? { initiator: normalizeInitiator(p.initiator) } : {}),
    // The event carries no timestamp at the wire; the arrival wall-clock is
    // the row's provisional start (the handshake's wall instant follows).
    atWallMs: Date.now(),
  };
}

export function normalizeWebSocketWillSendHandshakeRequest(
  tabId: number,
  sessionId: string,
  p: RawWebSocketWillSendHandshakeRequest,
): CdpNetworkEvent {
  return {
    method: 'Network.webSocketWillSendHandshakeRequest',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    wallTime: p.wallTime,
    headers: p.request.headers,
  };
}

export function normalizeWebSocketHandshakeResponseReceived(
  tabId: number,
  sessionId: string,
  p: RawWebSocketHandshakeResponseReceived,
): CdpNetworkEvent {
  return {
    method: 'Network.webSocketHandshakeResponseReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    response: {
      status: p.response.status,
      statusText: p.response.statusText,
      headers: p.response.headers,
      ...(p.response.headersText !== undefined ? { headersText: p.response.headersText } : {}),
      ...(p.response.requestHeaders !== undefined ? { requestHeaders: p.response.requestHeaders } : {}),
      ...(p.response.requestHeadersText !== undefined ? { requestHeadersText: p.response.requestHeadersText } : {}),
    },
  };
}

export function normalizeWebSocketFrame(
  method: 'Network.webSocketFrameSent' | 'Network.webSocketFrameReceived',
  tabId: number,
  sessionId: string,
  p: RawWebSocketFrameEvent,
): CdpNetworkEvent {
  return {
    method,
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    response: {
      opcode: p.response.opcode,
      mask: p.response.mask,
      payloadData: p.response.payloadData,
    },
  };
}

export function normalizeWebSocketFrameError(
  tabId: number,
  sessionId: string,
  p: RawWebSocketFrameError,
): CdpNetworkEvent {
  return {
    method: 'Network.webSocketFrameError',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    errorMessage: p.errorMessage,
  };
}

export function normalizeWebSocketClosed(tabId: number, sessionId: string, p: RawWebSocketClosed): CdpNetworkEvent {
  return {
    method: 'Network.webSocketClosed',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
  };
}

export function normalizeEventSourceMessageReceived(
  tabId: number,
  sessionId: string,
  p: RawEventSourceMessageReceived,
): CdpNetworkEvent {
  return {
    method: 'Network.eventSourceMessageReceived',
    tabId,
    sessionId,
    requestId: p.requestId,
    timestamp: p.timestamp,
    eventName: p.eventName,
    eventId: p.eventId,
    data: p.data,
  };
}

// ── fetch-domain normalizer (control-input) ──────────────────────────

export function normalizeRequestPaused(tabId: number, sessionId: string, p: RawRequestPaused): CdpRequestPaused {
  return {
    method: 'Fetch.requestPaused',
    tabId,
    sessionId,
    requestId: p.requestId,
    request: normalizeRequest(p.request),
    resourceType: p.resourceType,
    ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
    ...(p.networkId !== undefined ? { networkId: p.networkId } : {}),
    // Response-stage fields — present only when the pause is the second
    // (Response) stage of a request continued with `interceptResponse:true`.
    ...(p.responseStatusCode !== undefined ? { responseStatusCode: p.responseStatusCode } : {}),
    ...(p.responseStatusText !== undefined ? { responseStatusText: p.responseStatusText } : {}),
    ...(p.responseHeaders !== undefined
      ? { responseHeaders: p.responseHeaders.map((h) => ({ name: h.name, value: h.value })) }
      : {}),
    ...(p.responseErrorReason !== undefined ? { responseErrorReason: p.responseErrorReason } : {}),
  };
}

export function normalizeAuthRequired(tabId: number, sessionId: string, p: RawAuthRequired): CdpAuthRequired {
  return {
    method: 'Fetch.authRequired',
    tabId,
    sessionId,
    requestId: p.requestId,
    request: normalizeRequest(p.request),
    resourceType: p.resourceType,
    ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
    authChallenge: {
      // CDP marks `source` optional; default to `Server` (a 401), the
      // common case, when the browser omits it.
      source: p.authChallenge.source ?? 'Server',
      origin: p.authChallenge.origin,
      scheme: p.authChallenge.scheme,
      realm: p.authChallenge.realm,
    },
  };
}

// ── runtime-domain parser (private fire-bridge) ──────────────────────

/**
 * Parse a `Runtime.bindingCalled` payload into a routed fire, or `null` when it
 * is malformed. A page CAN call the fixed-name binding (the v1 fabrication gap),
 * so the payload is validated, never trusted blindly. `kind` is parsed but
 * dropped — the fire plane keys on `(tabId, ruleUid, url, t)`, mirroring the
 * un-armed postMessage path that relays only those to `tabFire`.
 */
export function parseBindingFire(tabId: number, payload: string): CdpBindingFire | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as { ruleUid?: unknown; url?: unknown; t?: unknown };
  if (typeof p.ruleUid !== 'string' || typeof p.url !== 'string' || typeof p.t !== 'number') return null;
  return { tabId, ruleUid: p.ruleUid, url: p.url, t: p.t };
}

// ── runtime-domain normalizers (console capture, Phase G) ────────────

/**
 * `Runtime.consoleAPICalled` → host-neutral {@link ConsoleEntry}. Each
 * `RemoteObject` arg renders to display text from its inline
 * value/description/preview — no `Runtime.getProperties` round-trip in v1, so
 * a deep object shows its shallow preview, not its full contents. A leading
 * format string with `printf` specifiers consumes the trailing args (see
 * {@link substituteFormat}).
 */
export function normalizeConsoleApiCalled(p: RawConsoleApiCalled): ConsoleEntry {
  return {
    source: 'console-api',
    level: consoleApiLevel(p.type),
    args: renderConsoleArgs(p.args),
    timestamp: p.timestamp,
    ...topFrameLocation(p.stackTrace),
  };
}

/** Render console args, applying leading-format-string substitution if present. */
function renderConsoleArgs(args: readonly RawRemoteObject[]): ConsoleArg[] {
  if (args.length === 0) return [];
  return substituteFormat(args) ?? args.map(renderRemoteObject);
}

/** Value-producing format specifiers — each consumes one trailing arg. `%o`/`%O`
 *  render the object inline; `%s` renders any arg as text. `%c` (CSS styling)
 *  consumes its arg but the styled run is deferred to the panel; `%%` is a
 *  literal percent. */
const FORMAT_SPECIFIER = /%[sdifoOc%]/;
const VALUE_SPECIFIERS = new Set(['s', 'd', 'i', 'f', 'o', 'O']);

/**
 * Apply a leading format string's specifiers (`%s`/`%d`/`%i`/`%f`/`%o`/`%O`/`%c`,
 * `%%`) against the trailing args, mirroring the browser console. Returns the
 * substituted string (followed by any args left unconsumed) when `args[0]` is a
 * format string carrying a specifier, else `null` so the caller renders each arg
 * independently. A specifier with no arg left to consume stays literal.
 */
function substituteFormat(args: readonly RawRemoteObject[]): ConsoleArg[] | null {
  const head = args[0];
  if (head.type !== 'string' || typeof head.value !== 'string') return null;
  const format = head.value;
  if (!FORMAT_SPECIFIER.test(format)) return null;

  let out = '';
  let next = 1;
  for (let i = 0; i < format.length; i++) {
    const ch = format[i];
    if (ch !== '%' || i + 1 >= format.length) {
      out += ch;
      continue;
    }
    const spec = format[i + 1];
    if (spec === '%') {
      out += '%';
      i++;
    } else if (spec === 'c') {
      if (next < args.length) next++; // consume the style arg; styled run deferred to the panel
      i++;
    } else if (VALUE_SPECIFIERS.has(spec)) {
      if (next >= args.length) {
        out += `%${spec}`; // no arg to consume — leave the specifier literal
      } else {
        out += formatArg(spec, args[next]);
        next++;
      }
      i++;
    } else {
      out += ch; // unknown specifier — emit the percent, render the rest literally
    }
  }

  return [{ type: 'string', text: out }, ...args.slice(next).map(renderRemoteObject)];
}

/** Render one arg for a value specifier: `%d`/`%i` truncate to an integer,
 *  `%f` keeps the float, `%s`/`%o`/`%O` render the arg's text. */
function formatArg(spec: string, o: RawRemoteObject): string {
  if (spec === 'd' || spec === 'i') {
    const n = numericValue(o);
    return Number.isNaN(n) ? 'NaN' : String(Math.trunc(n));
  }
  if (spec === 'f') {
    const n = numericValue(o);
    return Number.isNaN(n) ? 'NaN' : String(n);
  }
  return remoteObjectText(o);
}

/** Coerce an arg to a number for `%d`/`%i`/`%f`, else `NaN`. */
function numericValue(o: RawRemoteObject): number {
  if (typeof o.value === 'number') return o.value;
  if (typeof o.value === 'string') return Number(o.value);
  if (o.type === 'number' && o.description !== undefined) return Number(o.description);
  return Number.NaN;
}

/**
 * `Runtime.exceptionThrown` → an `error`-level {@link ConsoleEntry}. The
 * message is the thrown value's description (an Error's `name: message\n  at
 * …`), falling back to the `Uncaught` label; location prefers the top stack
 * frame, then the details' own `url`/`lineNumber`.
 */
export function normalizeExceptionThrown(p: RawExceptionThrown): ConsoleEntry {
  const d = p.exceptionDetails;
  return {
    source: 'exception',
    level: 'error',
    args: [{ type: 'error', subtype: 'error', text: exceptionText(d) }],
    timestamp: p.timestamp,
    ...exceptionLocation(d),
  };
}

/**
 * `Log.entryAdded` → a browser-sourced {@link ConsoleEntry}. These are the
 * browser's own console messages — failed/blocked network requests,
 * deprecations, CSP violations, interventions — the third stream Chrome's
 * console merges alongside `console.*` calls and uncaught exceptions. The
 * entry's category label passes through verbatim; the rendered `text` leads
 * the args, with any structured args appended after it. Location prefers the
 * initiating code (the stack's top frame) over the entry's own `url`, which
 * for a network entry is the failed request, not the caller.
 */
export function normalizeLogEntryAdded(p: RawLogEntryAdded): ConsoleEntry {
  const entry = p.entry;
  return {
    source: 'browser',
    level: logEntryLevel(entry.level),
    args: logEntryArgs(entry),
    timestamp: entry.timestamp,
    category: entry.source,
    ...logEntryLocation(entry),
  };
}

/** Bucket the `Log` entry level onto the display-level union — `verbose` is
 *  the browser's debug tier; an unknown level falls to `log`. */
function logEntryLevel(level: string): ConsoleLevel {
  switch (level) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'verbose':
      return 'debug';
    default:
      return 'log';
  }
}

/** The entry's rendered text leads; structured args (rare) append after it. */
function logEntryArgs(entry: RawLogEntry): ConsoleArg[] {
  const rendered = (entry.args ?? []).map(renderRemoteObject);
  if (entry.text.length === 0 && rendered.length > 0) return rendered;
  return [{ type: 'string', text: entry.text }, ...rendered];
}

/** Log-entry location — the initiating stack's top frame, else the entry's
 *  own resource `url`/`lineNumber`. */
function logEntryLocation(entry: RawLogEntry): Pick<ConsoleEntry, 'url' | 'lineNumber' | 'columnNumber'> {
  const fromStack = topFrameLocation(entry.stackTrace);
  if (fromStack.lineNumber !== undefined) return fromStack;
  return {
    ...(entry.url !== undefined && entry.url.length > 0 ? { url: entry.url } : {}),
    ...(entry.lineNumber !== undefined ? { lineNumber: entry.lineNumber } : {}),
  };
}

/** Bucket the CDP console call `type` onto the display-level union. Unknown
 *  types (`dir`/`table`/`trace`/`group`/…) fall to `log`. */
function consoleApiLevel(type: string): ConsoleLevel {
  switch (type) {
    case 'error':
    case 'assert':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    default:
      return 'log';
  }
}

function renderRemoteObject(o: RawRemoteObject): ConsoleArg {
  return {
    type: o.type,
    ...(o.subtype !== undefined ? { subtype: o.subtype } : {}),
    text: remoteObjectText(o),
  };
}

/** Render one `RemoteObject` to display text from its inline fields only. */
function remoteObjectText(o: RawRemoteObject): string {
  if (o.type === 'string') return typeof o.value === 'string' ? o.value : (o.description ?? '');
  if (o.type === 'undefined') return 'undefined';
  if (o.subtype === 'null') return 'null';
  if (o.unserializableValue !== undefined) return o.unserializableValue;
  if (o.type === 'number' || o.type === 'boolean' || o.type === 'bigint') {
    if (o.value !== undefined) return String(o.value);
    if (o.description !== undefined) return o.description;
  }
  // An error's `description` is its clean stack string; the backend's inline
  // `preview` for it is the redundant `{stack, message}` shape — prefer the stack.
  if (o.subtype === 'error' && o.description !== undefined) return o.description;
  if (o.preview !== undefined) return previewText(o.preview);
  if (o.description !== undefined) return o.description;
  if (o.value !== undefined) return primitiveText(o.value);
  return o.className ?? o.type;
}

/** Render an inline object/array preview as `{a: 1, b: 'x'}` / `[1, 2, …]`. */
function previewText(preview: RawObjectPreview): string {
  const isArray = preview.subtype === 'array';
  const parts = preview.properties.map((prop) =>
    isArray ? propertyValueText(prop) : `${prop.name}: ${propertyValueText(prop)}`,
  );
  if (preview.overflow) parts.push('…');
  const body = parts.join(', ');
  if (isArray) return `[${body}]`;
  const label = preview.description !== undefined && preview.description !== 'Object' ? `${preview.description} ` : '';
  return `${label}{${body}}`;
}

function propertyValueText(prop: RawPropertyPreview): string {
  if (prop.value !== undefined) return prop.type === 'string' ? `'${prop.value}'` : prop.value;
  if (prop.valuePreview !== undefined) return previewText(prop.valuePreview);
  return prop.subtype ?? prop.type;
}

function primitiveText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  return String(value);
}

function exceptionText(d: RawExceptionDetails): string {
  if (d.exception !== undefined) {
    const rendered = remoteObjectText(d.exception);
    if (rendered.length > 0) return rendered;
  }
  return d.text;
}

/** Top stack frame's source location, when the event carried a stack. */
function topFrameLocation(stack: RawStackTrace | undefined): Pick<ConsoleEntry, 'url' | 'lineNumber' | 'columnNumber'> {
  const frame = stack?.callFrames[0];
  if (frame === undefined) return {};
  return {
    ...(frame.url.length > 0 ? { url: frame.url } : {}),
    lineNumber: frame.lineNumber,
    columnNumber: frame.columnNumber,
  };
}

/** Exception location — the stack top frame, else the details' own fields. */
function exceptionLocation(d: RawExceptionDetails): Pick<ConsoleEntry, 'url' | 'lineNumber' | 'columnNumber'> {
  const fromStack = topFrameLocation(d.stackTrace);
  if (fromStack.lineNumber !== undefined) return fromStack;
  return {
    ...(d.url !== undefined && d.url.length > 0 ? { url: d.url } : {}),
    lineNumber: d.lineNumber,
    columnNumber: d.columnNumber,
  };
}

// ── page-domain normalizers (root target only) ───────────────────────

export function normalizeFrameNavigated(tabId: number, p: RawFrameNavigated): CdpPageEvent {
  return {
    method: 'Page.frameNavigated',
    tabId,
    sessionId: ROOT_SESSION_ID,
    frame: normalizePageFrame(p.frame),
  };
}

export function normalizePageLifecycle(
  method: 'Page.domContentEventFired' | 'Page.loadEventFired',
  tabId: number,
  p: RawPageLifecycleTimestamp,
): CdpPageEvent {
  return { method, tabId, sessionId: ROOT_SESSION_ID, timestamp: p.timestamp };
}

export function normalizeFrameStoppedLoading(tabId: number, p: RawFrameStoppedLoading): CdpPageEvent {
  // The protocol event carries no timestamp; the arrival wall-clock is the
  // fact's instant (it feeds no timing math, only the teardown record).
  return {
    method: 'Page.frameStoppedLoading',
    tabId,
    sessionId: ROOT_SESSION_ID,
    frameId: p.frameId,
    atWallMs: Date.now(),
  };
}

export function normalizePageFrame(f: RawPageFrame): CdpPageFrame {
  return {
    id: f.id,
    loaderId: f.loaderId,
    url: f.url,
    ...(f.parentId !== undefined ? { parentId: f.parentId } : {}),
  };
}

export function normalizeRequest(r: RawRequest): CdpRequestParams {
  return {
    url: r.url,
    method: r.method,
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
    ...(r.hasPostData !== undefined ? { hasPostData: r.hasPostData } : {}),
    ...(r.postData !== undefined ? { postData: r.postData } : {}),
    ...(r.initialPriority !== undefined ? { initialPriority: r.initialPriority } : {}),
  };
}

export function normalizeResponse(r: RawResponse): CdpResponseParams {
  return {
    url: r.url,
    status: r.status,
    statusText: r.statusText,
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
    ...(r.fromDiskCache !== undefined ? { fromDiskCache: r.fromDiskCache } : {}),
    ...(r.fromServiceWorker !== undefined ? { fromServiceWorker: r.fromServiceWorker } : {}),
    ...(r.remoteIPAddress !== undefined ? { remoteIPAddress: r.remoteIPAddress } : {}),
    ...(r.remotePort !== undefined ? { remotePort: r.remotePort } : {}),
    ...(r.connectionId !== undefined ? { connectionId: r.connectionId } : {}),
    ...(r.protocol !== undefined ? { protocol: r.protocol } : {}),
    ...(r.mimeType !== undefined ? { mimeType: r.mimeType } : {}),
    ...(r.charset !== undefined ? { charset: r.charset } : {}),
    ...(r.timing !== undefined ? { timing: normalizeTiming(r.timing) } : {}),
    ...(r.encodedDataLength !== undefined ? { encodedDataLength: r.encodedDataLength } : {}),
  };
}

export function normalizeTiming(t: RawResourceTiming): CdpResourceTiming {
  return {
    requestTime: t.requestTime,
    ...(t.proxyStart !== undefined ? { proxyStart: t.proxyStart } : {}),
    ...(t.proxyEnd !== undefined ? { proxyEnd: t.proxyEnd } : {}),
    ...(t.dnsStart !== undefined ? { dnsStart: t.dnsStart } : {}),
    ...(t.dnsEnd !== undefined ? { dnsEnd: t.dnsEnd } : {}),
    ...(t.connectStart !== undefined ? { connectStart: t.connectStart } : {}),
    ...(t.connectEnd !== undefined ? { connectEnd: t.connectEnd } : {}),
    ...(t.sslStart !== undefined ? { sslStart: t.sslStart } : {}),
    ...(t.sslEnd !== undefined ? { sslEnd: t.sslEnd } : {}),
    ...(t.sendStart !== undefined ? { sendStart: t.sendStart } : {}),
    ...(t.sendEnd !== undefined ? { sendEnd: t.sendEnd } : {}),
    ...(t.receiveHeadersStart !== undefined ? { receiveHeadersStart: t.receiveHeadersStart } : {}),
    ...(t.receiveHeadersEnd !== undefined ? { receiveHeadersEnd: t.receiveHeadersEnd } : {}),
    ...(t.workerStart !== undefined ? { workerStart: t.workerStart } : {}),
    ...(t.workerReady !== undefined ? { workerReady: t.workerReady } : {}),
    ...(t.workerFetchStart !== undefined ? { workerFetchStart: t.workerFetchStart } : {}),
    ...(t.workerRespondWithSettled !== undefined ? { workerRespondWithSettled: t.workerRespondWithSettled } : {}),
  };
}

export function normalizeInitiator(i: RawInitiator): CdpInitiator {
  return {
    type: normalizeInitiatorType(i.type),
    ...(i.url !== undefined ? { url: i.url } : {}),
    ...(i.lineNumber !== undefined ? { lineNumber: i.lineNumber } : {}),
    ...(i.columnNumber !== undefined ? { columnNumber: i.columnNumber } : {}),
    ...(i.stack !== undefined ? { stack: normalizeStackTrace(i.stack) } : {}),
  };
}

export function normalizeStackTrace(s: RawStackTrace): CdpStackTrace {
  return {
    ...(s.description !== undefined ? { description: s.description } : {}),
    callFrames: s.callFrames.map(normalizeCallFrame),
    ...(s.parent !== undefined ? { parent: normalizeStackTrace(s.parent) } : {}),
  };
}

export function normalizeCallFrame(f: RawCallFrame): CdpCallFrame {
  return {
    functionName: f.functionName,
    scriptId: f.scriptId,
    url: f.url,
    lineNumber: f.lineNumber,
    columnNumber: f.columnNumber,
  };
}

/** Clamp the CDP initiator type onto the oracle's known union. */
export function normalizeInitiatorType(type: string): CdpInitiator['type'] {
  switch (type) {
    case 'parser':
    case 'script':
    case 'preload':
    case 'SignedExchange':
    case 'preflight':
      return type;
    default:
      return 'other';
  }
}

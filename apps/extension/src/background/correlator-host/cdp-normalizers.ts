/**
 * Normalizers — raw CDP `onEvent` params → the oracle's chrome-free event
 * shapes (CdpNetworkEvent / CdpPageEvent / CdpFetchEvent), plus the private
 * fire-bridge payload parser. Pure functions; the adapter routes events here
 * after gating the session and method. Page-domain events are stamped with the
 * synthetic root session id (page timings are a main-frame, root-only concern).
 */

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
  RawDataReceived,
  RawEventSourceMessageReceived,
  RawFrameNavigated,
  RawFrameStoppedLoading,
  RawInitiator,
  RawLoadingFailed,
  RawLoadingFinished,
  RawPageFrame,
  RawPageLifecycleTimestamp,
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

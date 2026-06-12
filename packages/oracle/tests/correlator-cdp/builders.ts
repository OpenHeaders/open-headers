/**
 * Tiny builders for CDP network events. Tests compose canonical traces
 * from these; defaults are realistic enough that callers only override
 * the fields the case under test cares about.
 */

import type {
  CdpDataReceived,
  CdpEventSourceMessageReceived,
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpRequestWillBeSent,
  CdpRequestWillBeSentExtraInfo,
  CdpResponseParams,
  CdpResponseReceived,
  CdpResponseReceivedExtraInfo,
  CdpWebSocketClosed,
  CdpWebSocketCreated,
  CdpWebSocketFrameError,
  CdpWebSocketFrameReceived,
  CdpWebSocketFrameSent,
  CdpWebSocketHandshakeResponseReceived,
  CdpWebSocketWillSendHandshakeRequest,
} from '../../src/correlator-cdp/events';

export interface TraceCtx {
  readonly tabId: number;
  readonly requestId: string;
  /** CDP session the trace runs on; defaults to the tab's page target. */
  readonly sessionId?: string;
}

/** Page-target session id used when a {@link TraceCtx} omits one. */
export const PAGE_SESSION = 'session-page';

export function cdpStart(ctx: TraceCtx, overrides: Partial<CdpRequestWillBeSent> = {}): CdpRequestWillBeSent {
  return {
    method: 'Network.requestWillBeSent',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    loaderId: 'L1',
    documentURL: 'https://app.openheaders.io/',
    request: { url: 'https://api.openheaders.io/users', method: 'GET' },
    timestamp: 100,
    wallTime: 1_700_000_000,
    initiator: { type: 'parser', url: 'https://app.openheaders.io/' },
    type: 'XHR',
    ...overrides,
  };
}

export function cdpRedirect(
  ctx: TraceCtx,
  prior: CdpResponseParams,
  nextUrl: string,
  overrides: Partial<CdpRequestWillBeSent> = {},
): CdpRequestWillBeSent {
  return cdpStart(ctx, {
    request: { url: nextUrl, method: 'GET' },
    timestamp: 100.1,
    redirectResponse: prior,
    ...overrides,
  });
}

export function cdpResponse(ctx: TraceCtx, overrides: Partial<CdpResponseReceived> = {}): CdpResponseReceived {
  return {
    method: 'Network.responseReceived',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100.5,
    type: 'XHR',
    response: { url: 'https://api.openheaders.io/users', status: 200, statusText: 'OK' },
    ...overrides,
  };
}

export function cdpData(ctx: TraceCtx, dataLength: number, overrides: Partial<CdpDataReceived> = {}): CdpDataReceived {
  return {
    method: 'Network.dataReceived',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100.7,
    dataLength,
    encodedDataLength: dataLength,
    ...overrides,
  };
}

export function cdpFinished(ctx: TraceCtx, overrides: Partial<CdpLoadingFinished> = {}): CdpLoadingFinished {
  return {
    method: 'Network.loadingFinished',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100.9,
    encodedDataLength: 1024,
    ...overrides,
  };
}

export function cdpRequestExtra(ctx: TraceCtx, headers: Record<string, string>): CdpRequestWillBeSentExtraInfo {
  return {
    method: 'Network.requestWillBeSentExtraInfo',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    headers,
  };
}

export function cdpResponseExtra(ctx: TraceCtx, headers: Record<string, string>): CdpResponseReceivedExtraInfo {
  return {
    method: 'Network.responseReceivedExtraInfo',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    headers,
  };
}

// ── WebSocket / EventSource builders ─────────────────────────────────

export function cdpWsCreated(ctx: TraceCtx, overrides: Partial<CdpWebSocketCreated> = {}): CdpWebSocketCreated {
  return {
    method: 'Network.webSocketCreated',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    url: 'wss://api.openheaders.io/socket',
    initiator: { type: 'script', url: 'https://app.openheaders.io/' },
    atWallMs: 1_700_000_000_050,
    ...overrides,
  };
}

export function cdpWsHandshakeRequest(
  ctx: TraceCtx,
  overrides: Partial<CdpWebSocketWillSendHandshakeRequest> = {},
): CdpWebSocketWillSendHandshakeRequest {
  return {
    method: 'Network.webSocketWillSendHandshakeRequest',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100,
    wallTime: 1_700_000_000,
    headers: { Upgrade: 'websocket', 'Sec-WebSocket-Version': '13' },
    ...overrides,
  };
}

export function cdpWsHandshakeResponse(
  ctx: TraceCtx,
  overrides: Partial<CdpWebSocketHandshakeResponseReceived> = {},
): CdpWebSocketHandshakeResponseReceived {
  return {
    method: 'Network.webSocketHandshakeResponseReceived',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100.2,
    response: {
      status: 101,
      statusText: 'Switching Protocols',
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
      requestHeaders: { Upgrade: 'websocket', 'Sec-WebSocket-Key': 'k==', 'User-Agent': 'oh-test' },
    },
    ...overrides,
  };
}

export function cdpWsFrameSent(ctx: TraceCtx, overrides: Partial<CdpWebSocketFrameSent> = {}): CdpWebSocketFrameSent {
  return {
    method: 'Network.webSocketFrameSent',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 101,
    response: { opcode: 1, mask: true, payloadData: 'hello from client' },
    ...overrides,
  };
}

export function cdpWsFrameReceived(
  ctx: TraceCtx,
  overrides: Partial<CdpWebSocketFrameReceived> = {},
): CdpWebSocketFrameReceived {
  return {
    method: 'Network.webSocketFrameReceived',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 101.1,
    response: { opcode: 1, mask: false, payloadData: 'hello from server' },
    ...overrides,
  };
}

export function cdpWsFrameError(
  ctx: TraceCtx,
  overrides: Partial<CdpWebSocketFrameError> = {},
): CdpWebSocketFrameError {
  return {
    method: 'Network.webSocketFrameError',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 101.5,
    errorMessage: 'Invalid frame header',
    ...overrides,
  };
}

export function cdpWsClosed(ctx: TraceCtx, overrides: Partial<CdpWebSocketClosed> = {}): CdpWebSocketClosed {
  return {
    method: 'Network.webSocketClosed',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 102,
    ...overrides,
  };
}

export function cdpSseMessage(
  ctx: TraceCtx,
  overrides: Partial<CdpEventSourceMessageReceived> = {},
): CdpEventSourceMessageReceived {
  return {
    method: 'Network.eventSourceMessageReceived',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 101,
    eventName: 'message',
    eventId: '1',
    data: '{"seq":1}',
    ...overrides,
  };
}

export function cdpFailed(ctx: TraceCtx, overrides: Partial<CdpLoadingFailed> = {}): CdpLoadingFailed {
  return {
    method: 'Network.loadingFailed',
    tabId: ctx.tabId,
    sessionId: ctx.sessionId ?? PAGE_SESSION,
    requestId: ctx.requestId,
    timestamp: 100.7,
    type: 'XHR',
    errorText: 'net::ERR_FAILED',
    ...overrides,
  };
}

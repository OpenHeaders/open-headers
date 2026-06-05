/**
 * Tiny builders for CDP network events. Tests compose canonical traces
 * from these; defaults are realistic enough that callers only override
 * the fields the case under test cares about.
 */

import type {
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpRequestWillBeSent,
  CdpResponseParams,
  CdpResponseReceived,
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

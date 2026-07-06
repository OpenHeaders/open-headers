/**
 * K1 + K3 — CDP event trace → expected `RequestLifecycleUpdate`s.
 *
 * The trace below is the canonical "request, single redirect, response,
 * finished" sequence. The store does not run here; we assert the
 * mapper's shape directly.
 *
 * The terminal events carry only CDP's monotonic `timestamp`, so the mapper
 * takes a {@link CdpWallClockResolver} to recover wall-clock `completedAtMs`.
 * These tests inject a fixed-offset resolver (the real per-request offset is
 * exercised in `cdp-wall-clock.test.ts`) and assert the converted wall value.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { cdpEventToUpdates } from '../../src/correlator-cdp/cdp-to-update';
import type { CdpWallClockResolver } from '../../src/correlator-cdp/cdp-wall-clock';
import type {
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpRequestWillBeSent,
  CdpRequestWillBeSentExtraInfo,
  CdpResponseReceived,
  CdpResponseReceivedExtraInfo,
} from '../../src/correlator-cdp/events';
import {
  cdpSseMessage,
  cdpWsClosed,
  cdpWsCreated,
  cdpWsFrameError,
  cdpWsFrameReceived,
  cdpWsFrameSent,
  cdpWsHandshakeRequest,
  cdpWsHandshakeResponse,
} from './builders';

const TAB = 7;
/** Store-facing identity = `${sessionId}::${requestId}` (child-session namespacing). */
const STORE_ID = 'session-page::cdp-1';

const initialRequest: CdpRequestWillBeSent = {
  method: 'Network.requestWillBeSent',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  loaderId: 'L1',
  documentURL: 'https://app.openheaders.io/',
  request: { url: 'https://api.openheaders.io/users', method: 'GET' },
  timestamp: 100.5,
  wallTime: 1_700_000_000.25,
  initiator: { type: 'parser', url: 'https://app.openheaders.io/' },
  type: 'XHR',
};

/**
 * Fixed-offset resolver: `wall − monotonic` for the canonical request, so a
 * monotonic instant maps to the same wall clock as `startedAtMs`. This is the
 * pure conversion `CdpWallClock` performs once it has captured the offset.
 */
const OFFSET_SEC = initialRequest.wallTime - initialRequest.timestamp;
const toWallMs: CdpWallClockResolver = (_tabId, _sessionId, _requestId, monotonicSec) =>
  (monotonicSec + OFFSET_SEC) * 1000;

const redirectStart: CdpRequestWillBeSent = {
  ...initialRequest,
  request: { url: 'https://api.openheaders.io/v2/users', method: 'GET' },
  timestamp: 100.6,
  // The redirect hop begins after the root; wall clock advances with it.
  wallTime: 1_700_000_000.35,
  redirectResponse: {
    url: 'https://api.openheaders.io/users',
    status: 301,
    statusText: 'Moved Permanently',
  },
};

const responseReceived: CdpResponseReceived = {
  method: 'Network.responseReceived',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  timestamp: 100.8,
  type: 'XHR',
  response: { url: 'https://api.openheaders.io/v2/users', status: 200, statusText: 'OK' },
};

const loadingFinished: CdpLoadingFinished = {
  method: 'Network.loadingFinished',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  timestamp: 100.9,
  encodedDataLength: 1024,
};

describe('cdpEventToUpdates — canonical redirect + completion trace', () => {
  it('first requestWillBeSent → started update', () => {
    const updates = cdpEventToUpdates(initialRequest, toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('started');
    if (u?.kind !== 'started') return;
    expect(u.lifecycle.tabId).toBe(TAB);
    expect(u.lifecycle.requestId).toBe(STORE_ID);
    expect(u.lifecycle.url).toBe('https://api.openheaders.io/users');
    expect(u.lifecycle.phase).toBe('pending');
    expect(u.lifecycle.redirectHopCount).toBe(0);
    expect(u.lifecycle.startedAtMs).toBe(1_700_000_000_250);
    expect(u.lifecycle.initiator).toBe('https://app.openheaders.io/');
    // CapitalCase CDP type is lowercased to the one vocabulary panel consumers use.
    expect(u.lifecycle.resourceType).toBe('xhr');
  });

  it('carries the issuing frameId onto the started lifecycle, omitting it when absent', () => {
    const withFrame = cdpEventToUpdates({ ...initialRequest, frameId: 'F1' }, toWallMs)[0];
    expect(withFrame?.kind).toBe('started');
    if (withFrame?.kind !== 'started') return;
    expect(withFrame.lifecycle.frameId).toBe('F1');

    // Worker requests carry no frame — the field stays unset, never ''.
    const withoutFrame = cdpEventToUpdates(initialRequest, toWallMs)[0];
    if (withoutFrame?.kind !== 'started') return;
    expect('frameId' in withoutFrame.lifecycle).toBe(false);
  });

  it('lowercases the CDP resource type so the main document reads as `document`', () => {
    // CDP reports `'Document'`; the footer's `isMainDocument` matches lowercase
    // `'document'`. Without normalization a top-level CDP nav is never the main
    // document and the footer loses its redirect-leg anchoring.
    const u = cdpEventToUpdates({ ...initialRequest, type: 'Document' }, toWallMs)[0];
    expect(u?.kind).toBe('started');
    if (u?.kind !== 'started') return;
    expect(u.lifecycle.resourceType).toBe('document');
  });

  it('keeps full sub-ms precision on the wall-clock start (network-start sort needs it)', () => {
    // wallTime 5.6789 → 5678.9 ms, kept fractional. The start-time sort adds
    // queueing to reach the network start (the host's requestTime); truncating
    // here would collapse sub-ms ordering and mis-sort near-simultaneous
    // requests. The HAR export still truncates for display (new Date → 5678).
    const u = cdpEventToUpdates({ ...initialRequest, wallTime: 5.6789 }, toWallMs)[0];
    expect(u?.kind).toBe('started');
    if (u?.kind !== 'started') return;
    expect(u.lifecycle.startedAtMs).toBe(5.6789 * 1000);
    expect(Number.isInteger(u.lifecycle.startedAtMs)).toBe(false);
  });

  it('requestWillBeSent with redirectResponse → redirect update (not started)', () => {
    const updates = cdpEventToUpdates(redirectStart, toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('redirect');
    if (u?.kind !== 'redirect') return;
    expect(u.tabId).toBe(TAB);
    expect(u.requestId).toBe(STORE_ID);
    expect(u.hop.sourceUrl).toBe('https://api.openheaders.io/users');
    expect(u.hop.redirectUrl).toBe('https://api.openheaders.io/v2/users');
    expect(u.hop.statusCode).toBe(301);
    // Wall clock (wallTime * 1000), full precision — same scale as
    // `startedAtMs`, so the reducer's `hopStartedAtMs` stays sortable.
    expect(u.hop.timestampMs).toBe(1_700_000_000_350);
    expect(u.nextUrl).toBe('https://api.openheaders.io/v2/users');
  });

  it('responseReceived → phase: headers-received with status', () => {
    const updates = cdpEventToUpdates(responseReceived, toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('headers-received');
    expect(u.patch.statusCode).toBe(200);
    expect(u.patch.statusText).toBe('OK');
  });

  it('responseReceived carries the response headers, splitting protocol-joined duplicates per instance', () => {
    const withHeaders: CdpResponseReceived = {
      ...responseReceived,
      response: {
        ...responseReceived.response,
        headers: { 'X-OH-Echo': 'true', 'Set-Cookie': 'a=1\nb=2' },
      },
    };
    const u = cdpEventToUpdates(withHeaders, toWallMs)[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.responseHeaders).toEqual([
      { name: 'X-OH-Echo', value: 'true' },
      { name: 'Set-Cookie', value: 'a=1' },
      { name: 'Set-Cookie', value: 'b=2' },
    ]);
    // Headerless event → field omitted, not an empty list.
    const bare = cdpEventToUpdates(responseReceived, toWallMs)[0];
    if (bare?.kind !== 'phase') return;
    expect(bare.patch.responseHeaders).toBeUndefined();
  });

  it('responseReceived stamps the wall network start from timing.requestTime', () => {
    // requestTime is the network start on CDP's monotonic clock; converting it
    // through the same offset as the wall start gives `hopNetworkStartMs`, the
    // footer's anchor. requestTime 100.7 + OFFSET 1_699_999_899.75 = 1_700_000_000.45.
    const withTiming: CdpResponseReceived = {
      ...responseReceived,
      response: { ...responseReceived.response, timing: { requestTime: 100.7 } },
    };
    const u = cdpEventToUpdates(withTiming, toWallMs)[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.hopNetworkStartMs).toBe(1_700_000_000_450);
  });

  it('omits the network start when responseReceived carries no timing (cached/blocked hop)', () => {
    // No `timing` (a disk-cache or blocked hop reports none) → leave the field
    // unset so the footer falls back to the issue instant.
    const u = cdpEventToUpdates(responseReceived, toWallMs)[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.hopNetworkStartMs).toBeUndefined();
  });

  it('loadingFinished → phase: completed with wall-clock completedAtMs', () => {
    const updates = cdpEventToUpdates(loadingFinished, toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('completed');
    // monotonic 100.9 + offset → wall (1_700_000_000.65 s), same clock as the
    // wall `startedAtMs` so `lifecycleDuration` is a real positive span, not a
    // monotonic value (100_900) that would clamp to 0.
    expect(u.patch.completedAtMs).toBe(1_700_000_000_650);
    expect(u.patch.completedAtMs).toBeGreaterThan(initialRequest.wallTime * 1000);
  });

  it('loadingFailed → phase: failed with refined error and wall-clock completedAtMs', () => {
    const failed: CdpLoadingFailed = {
      method: 'Network.loadingFailed',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      timestamp: 100.9,
      type: 'XHR',
      errorText: 'net::ERR_FAILED',
      blockedReason: 'mixed-content',
    };
    const updates = cdpEventToUpdates(failed, toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('failed');
    // Same wall conversion as the completed path — a failed row's duration
    // stays on the start's clock.
    expect(u.patch.completedAtMs).toBe(1_700_000_000_650);
    expect(u.patch.error?.code).toBe('net::ERR_FAILED');
    expect(u.patch.error?.reason).toBe('mixed-content');
    // The mapped label word rides on `blockedReason` for the panel.
    expect(u.patch.error?.blockedReason).toBe('mixed-content');
  });

  it('loadingFailed folds a CORP-policy blockedReason to its family label', () => {
    const failed: CdpLoadingFailed = {
      method: 'Network.loadingFailed',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      timestamp: 100.9,
      type: 'XHR',
      errorText: 'net::ERR_BLOCKED_BY_RESPONSE',
      blockedReason: 'corp-not-same-origin',
    };
    const updates = cdpEventToUpdates(failed, toWallMs);
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase update');
    expect(u.patch.error?.blockedReason).toBe('corp');
  });

  it('dataReceived → no lifecycle update (HAR-only decoded-size refinement)', () => {
    expect(
      cdpEventToUpdates(
        {
          method: 'Network.dataReceived',
          tabId: TAB,
          sessionId: 'session-page',
          requestId: 'cdp-1',
          timestamp: 100.6,
          dataLength: 4096,
          encodedDataLength: 1024,
        },
        toWallMs,
      ),
    ).toEqual([]);
  });

  it('requestWillBeSentExtraInfo → no lifecycle update (HAR-only refinement)', () => {
    const extra: CdpRequestWillBeSentExtraInfo = {
      method: 'Network.requestWillBeSentExtraInfo',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      headers: { Cookie: 'sid=wire' },
    };
    expect(cdpEventToUpdates(extra, toWallMs)).toEqual([]);
  });

  it('responseReceivedExtraInfo → no lifecycle update (HAR-only refinement)', () => {
    const extra: CdpResponseReceivedExtraInfo = {
      method: 'Network.responseReceivedExtraInfo',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      headers: { 'Set-Cookie': 'sess=raw' },
    };
    expect(cdpEventToUpdates(extra, toWallMs)).toEqual([]);
  });

  it('loadingFailed without a blockedReason leaves the field unset', () => {
    const failed: CdpLoadingFailed = {
      method: 'Network.loadingFailed',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      timestamp: 100.9,
      type: 'XHR',
      errorText: 'net::ERR_TIMED_OUT',
    };
    const updates = cdpEventToUpdates(failed, toWallMs);
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase update');
    expect(u.patch.error?.blockedReason).toBeUndefined();
  });
});

describe('cdpEventToUpdates — full trace produces a coherent update stream', () => {
  // Walk the canonical CDP sequence through the mapper and assert the
  // emitted updates form a legal stream (kind ordering + identity
  // preservation). The store reducer is exercised separately.
  it('start → redirect → headers-received → completed produces a coherent path', () => {
    const trace = [initialRequest, redirectStart, responseReceived, loadingFinished];
    const updates = trace.flatMap((e) => cdpEventToUpdates(e, toWallMs));
    expect(updates.map((u) => u.kind)).toEqual(['started', 'redirect', 'phase', 'phase']);
    // The mapper preserves identity across the whole trace.
    const tabAndIds = updates.map((u) => {
      if (u.kind === 'started') return [u.lifecycle.tabId, u.lifecycle.requestId];
      return [u.tabId, u.requestId];
    });
    for (const [tabId, requestId] of tabAndIds) {
      expect(tabId).toBe(TAB);
      expect(requestId).toBe(STORE_ID);
    }
  });

  // Pre-empt drift: the started lifecycle's type is the one the store
  // will reduce against, so its shape must satisfy `RequestLifecycle`.
  it('emitted started lifecycle satisfies the RequestLifecycle shape (compile-time)', () => {
    const updates = cdpEventToUpdates(initialRequest, toWallMs);
    const u = updates[0];
    if (u?.kind !== 'started') throw new Error('expected started');
    const lc: RequestLifecycle = u.lifecycle;
    expect(lc.har.length).toBe(0);
    expect(lc.harBodyByHop.length).toBe(0);
  });
});

describe('cdpEventToUpdates — WebSocket vocabulary', () => {
  const ctx = { tabId: TAB, requestId: 'ws-1' };
  const WS_STORE_ID = 'session-page::ws-1';

  it('webSocketCreated mints the started lifecycle (GET, websocket, arrival start)', () => {
    const updates = cdpEventToUpdates(cdpWsCreated(ctx), toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    if (u?.kind !== 'started') throw new Error('expected started');
    expect(u.lifecycle).toMatchObject({
      tabId: TAB,
      requestId: WS_STORE_ID,
      url: 'wss://api.openheaders.io/socket',
      method: 'GET',
      resourceType: 'websocket',
      initiator: 'https://app.openheaders.io/',
      phase: 'pending',
      startedAtMs: 1_700_000_000_050,
      hopStartedAtMs: 1_700_000_000_050,
    });
    // Sockets carry no loader/frame identity — page binding falls to the floor.
    expect(u.lifecycle.loaderId).toBeUndefined();
    expect(u.lifecycle.frameId).toBeUndefined();
  });

  it('willSendHandshakeRequest carries no lifecycle update (headers ride the builder)', () => {
    expect(cdpEventToUpdates(cdpWsHandshakeRequest(ctx), toWallMs)).toEqual([]);
  });

  it('handshakeResponseReceived advances to headers-received with status 101', () => {
    const updates = cdpEventToUpdates(cdpWsHandshakeResponse(ctx), toWallMs);
    expect(updates).toEqual([
      {
        kind: 'phase',
        tabId: TAB,
        requestId: WS_STORE_ID,
        patch: { phase: 'headers-received', statusCode: 101, statusText: 'Switching Protocols' },
      },
    ]);
  });

  it('frames project to message-appended with wall-clock instants', () => {
    const sent = cdpEventToUpdates(cdpWsFrameSent(ctx, { timestamp: 101 }), toWallMs);
    expect(sent).toEqual([
      {
        kind: 'message-appended',
        tabId: TAB,
        requestId: WS_STORE_ID,
        message: {
          kind: 'ws',
          type: 'send',
          atMs: (101 + OFFSET_SEC) * 1000,
          opcode: 1,
          mask: true,
          data: 'hello from client',
        },
      },
    ]);
    const received = cdpEventToUpdates(
      cdpWsFrameReceived(ctx, { response: { opcode: 2, mask: false, payloadData: '3q2+7w==' } }),
      toWallMs,
    );
    const u = received[0];
    if (u?.kind !== 'message-appended' || u.message.kind !== 'ws') throw new Error('expected ws message');
    expect(u.message.type).toBe('receive');
    expect(u.message.opcode).toBe(2);
    expect(u.message.data).toBe('3q2+7w==');
  });

  it('frameError joins the frame list as an error message (opcode −1), no phase change', () => {
    const updates = cdpEventToUpdates(cdpWsFrameError(ctx), toWallMs);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    if (u?.kind !== 'message-appended' || u.message.kind !== 'ws') throw new Error('expected ws message');
    expect(u.message).toMatchObject({ type: 'error', opcode: -1, mask: false, data: 'Invalid frame header' });
  });

  it('webSocketClosed terminates the row (completed at the wall-converted close)', () => {
    const updates = cdpEventToUpdates(cdpWsClosed(ctx, { timestamp: 102 }), toWallMs);
    expect(updates).toEqual([
      {
        kind: 'phase',
        tabId: TAB,
        requestId: WS_STORE_ID,
        patch: { phase: 'completed', completedAtMs: (102 + OFFSET_SEC) * 1000 },
      },
    ]);
  });
});

describe('cdpEventToUpdates — EventSource vocabulary', () => {
  const ctx = { tabId: TAB, requestId: 'sse-1' };

  it('eventSourceMessageReceived projects to a parsed sse message', () => {
    const updates = cdpEventToUpdates(
      cdpSseMessage(ctx, { eventName: 'tick', eventId: '3', data: '{"seq":3}\n{"named":true}', timestamp: 101 }),
      toWallMs,
    );
    expect(updates).toEqual([
      {
        kind: 'message-appended',
        tabId: TAB,
        requestId: 'session-page::sse-1',
        message: {
          kind: 'sse',
          atMs: (101 + OFFSET_SEC) * 1000,
          eventName: 'tick',
          eventId: '3',
          data: '{"seq":3}\n{"named":true}',
        },
      },
    ]);
  });
});

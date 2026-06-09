/**
 * H1 mapper — pure projection of webRequest events into
 * `RequestLifecycleUpdate`s. No HAR, no CORS, no late-buffer (own
 * sessions).
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import type { WebRequestEvent } from '../../src/correlator-heuristic/events';
import { webRequestEventToUpdates } from '../../src/correlator-heuristic/webrequest-to-update';

const TAB = 7;
const REQ = 'wr-1';
const URL_A = 'https://api.openheaders.io/a';
const URL_B = 'https://api.openheaders.io/b';

const onBeforeRequest: WebRequestEvent = {
  method_kind: 'onBeforeRequest',
  tabId: TAB,
  requestId: REQ,
  url: URL_A,
  method: 'GET',
  type: 'xmlhttprequest',
  timeStamp: 1_700_000_000_000,
  initiator: 'https://app.openheaders.io',
};

describe('webRequestEventToUpdates — happy-path projection', () => {
  it('onBeforeRequest → started with phase=pending, hopCount=0', () => {
    const [update, ...rest] = webRequestEventToUpdates(onBeforeRequest);
    expect(rest).toHaveLength(0);
    expect(update?.kind).toBe('started');
    if (update?.kind !== 'started') throw new Error('expected started');
    expect(update.lifecycle.tabId).toBe(TAB);
    expect(update.lifecycle.requestId).toBe(REQ);
    expect(update.lifecycle.url).toBe(URL_A);
    expect(update.lifecycle.method).toBe('GET');
    expect(update.lifecycle.resourceType).toBe('xmlhttprequest');
    expect(update.lifecycle.phase).toBe('pending');
    expect(update.lifecycle.redirectHopCount).toBe(0);
    expect(update.lifecycle.redirectHops).toEqual([]);
    expect(update.lifecycle.startedAtMs).toBe(1_700_000_000_000);
    expect(update.lifecycle.hopStartedAtMs).toBe(1_700_000_000_000);
    expect(update.lifecycle.initiator).toBe('https://app.openheaders.io');
  });

  it('onSendHeaders → phase patch with provisional request headers', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_010,
      requestHeaders: [{ name: 'X-Test', value: 'y' }, { name: 'X-Empty' }],
    });
    expect(updates).toHaveLength(1);
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase');
    expect(u.patch.phase).toBeUndefined();
    expect(u.patch.requestHeaders).toEqual([
      { name: 'X-Test', value: 'y' },
      { name: 'X-Empty', value: '' },
    ]);
    expect(u.patch.requestHeadersProvisional).toBe(true);
  });

  it('onSendHeaders without headers → no update emitted', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_010,
    });
    expect(updates).toEqual([]);
  });

  it('onHeadersReceived → phase patch with status + statusText + drops provisional', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_020,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      fromCache: false,
    });
    expect(updates).toHaveLength(1);
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase');
    expect(u.patch.phase).toBe('headers-received');
    expect(u.patch.statusCode).toBe(200);
    expect(u.patch.statusText).toBe('OK');
    expect(u.patch.fromCache).toBe(false);
    expect(u.patch.requestHeadersProvisional).toBe(false);
  });

  it('onBeforeRedirect → redirect with sourceUrl and redirectUrl', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_030,
      statusCode: 302,
      redirectUrl: URL_B,
    });
    expect(updates).toHaveLength(1);
    const u = updates[0];
    if (u?.kind !== 'redirect') throw new Error('expected redirect');
    expect(u.hop.sourceUrl).toBe(URL_A);
    expect(u.hop.redirectUrl).toBe(URL_B);
    expect(u.hop.statusCode).toBe(302);
    expect(u.hop.timestampMs).toBe(1_700_000_000_030);
    expect(u.nextUrl).toBe(URL_B);
  });

  it('onCompleted → phase patch with phase=completed + completedAtMs', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_040,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      fromCache: false,
    });
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase');
    expect(u.patch.phase).toBe('completed');
    expect(u.patch.statusCode).toBe(200);
    expect(u.patch.completedAtMs).toBe(1_700_000_000_040);
  });

  it('onErrorOccurred → phase patch with phase=failed + error.code', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_050,
      error: 'net::ERR_FAILED',
    });
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase');
    expect(u.patch.phase).toBe('failed');
    expect(u.patch.error?.code).toBe('net::ERR_FAILED');
    expect(u.patch.completedAtMs).toBe(1_700_000_000_050);
  });
});

describe('webRequestEventToUpdates — canonical traces', () => {
  it('start → headers → complete produces three sequential updates', () => {
    const trace: WebRequestEvent[] = [
      onBeforeRequest,
      {
        method_kind: 'onSendHeaders',
        tabId: TAB,
        requestId: REQ,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_005,
      },
      {
        method_kind: 'onHeadersReceived',
        tabId: TAB,
        requestId: REQ,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_010,
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
      },
      {
        method_kind: 'onCompleted',
        tabId: TAB,
        requestId: REQ,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_020,
        statusCode: 200,
      },
    ];
    const out: RequestLifecycleUpdate[] = [];
    for (const e of trace) out.push(...webRequestEventToUpdates(e));
    expect(out.map((u) => u.kind)).toEqual(['started', 'phase', 'phase']);
  });

  it('start → redirect → start → complete preserves a single requestId', () => {
    const trace: WebRequestEvent[] = [
      onBeforeRequest,
      {
        method_kind: 'onBeforeRedirect',
        tabId: TAB,
        requestId: REQ,
        url: URL_A,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_005,
        statusCode: 302,
        redirectUrl: URL_B,
      },
      {
        method_kind: 'onBeforeRequest',
        tabId: TAB,
        requestId: REQ,
        url: URL_B,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_007,
      },
      {
        method_kind: 'onCompleted',
        tabId: TAB,
        requestId: REQ,
        url: URL_B,
        method: 'GET',
        type: 'xmlhttprequest',
        timeStamp: 1_700_000_000_020,
        statusCode: 200,
      },
    ];
    const out: RequestLifecycleUpdate[] = [];
    for (const e of trace) out.push(...webRequestEventToUpdates(e));
    expect(out.map((u) => u.kind)).toEqual(['started', 'redirect', 'started', 'phase']);
    for (const u of out) {
      if (u.kind === 'started') expect(u.lifecycle.requestId).toBe(REQ);
      else expect(u.requestId).toBe(REQ);
    }
  });

  it('malformed statusLine → statusText omitted (invariant 5 — no undefined-overwrite)', () => {
    const updates = webRequestEventToUpdates({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: REQ,
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: 1_700_000_000_010,
      statusCode: 200,
      statusLine: 'garbage',
    });
    const u = updates[0];
    if (u?.kind !== 'phase') throw new Error('expected phase');
    expect(u.patch.statusText).toBeUndefined();
  });
});

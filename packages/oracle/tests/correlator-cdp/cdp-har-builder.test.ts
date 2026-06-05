/**
 * `CdpHarBuilder` — stateful `InspectorHarEntry` synthesis across the
 * multi-event CDP request lifecycle, plus the pure CDP→HAR timing
 * base-conversion (`cdpTimingToHar`).
 *
 * Three concerns are covered:
 *   - the timing base-conversion is table-driven (the classic source of
 *     negative legs — monotonic `requestTime` base vs `wallTime` start);
 *   - the builder produces a well-formed entry (cookies parsed from
 *     headers, transfer size, server IP, timings) and refines it across
 *     responseReceived → loadingFinished;
 *   - redirect hops synthesize their HAR from `redirectResponse` at the
 *     right `hopIndex`, and the whole trace round-trips through
 *     `RequestLifecycleStore` with zero reducer rejections (invariants
 *     hold) landing the synthesized HAR in `lifecycle.har`.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

import { CdpHarBuilder } from '../../src/correlator-cdp/cdp-har-builder';
import { cdpTimingToHar } from '../../src/correlator-cdp/cdp-har-synth';
import { CdpCorrelator } from '../../src/correlator-cdp/correlator';
import { type CdpNetworkEvent, type CdpResourceTiming, cdpStoreRequestId } from '../../src/correlator-cdp/events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';

import {
  cdpData,
  cdpFailed,
  cdpFinished,
  cdpRedirect,
  cdpRequestExtra,
  cdpResponse,
  cdpResponseExtra,
  cdpStart,
  PAGE_SESSION,
  type TraceCtx,
} from './builders';
import { InMemoryCdpSource } from './in-memory-source';

// ── pure timing base-conversion ─────────────────────────────────────

const FULL_TIMING: CdpResourceTiming = {
  requestTime: 1000,
  dnsStart: 0,
  dnsEnd: 10,
  connectStart: 10,
  connectEnd: 30,
  sslStart: 15,
  sslEnd: 30,
  sendStart: 30,
  sendEnd: 35,
  receiveHeadersEnd: 100,
};

const REUSED_CONNECTION: CdpResourceTiming = {
  requestTime: 1000,
  dnsStart: -1,
  dnsEnd: -1,
  connectStart: -1,
  connectEnd: -1,
  sslStart: -1,
  sslEnd: -1,
  sendStart: 5,
  sendEnd: 8,
  receiveHeadersEnd: 40,
};

describe('cdpTimingToHar — base conversion', () => {
  it('full timing maps every leg with no negative durations', () => {
    expect(cdpTimingToHar(FULL_TIMING, 250)).toEqual({
      blocked: 0, // earliest activity (dnsStart) is the queue/stall floor
      dns: 10,
      connect: 20,
      ssl: 15,
      send: 5,
      wait: 65, // receiveHeadersEnd - sendEnd
      receive: 150, // totalMs - receiveHeadersEnd
    });
  });

  it('reused connection omits dns/connect/ssl and floors blocked at sendStart', () => {
    expect(cdpTimingToHar(REUSED_CONNECTION, 60)).toEqual({
      blocked: 5,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: 3,
      wait: 32,
      receive: 20,
    });
  });

  it('without a total, receive is deferred (-1) but other legs still resolve', () => {
    const t = cdpTimingToHar(FULL_TIMING, undefined);
    expect(t.receive).toBe(-1);
    expect(t.wait).toBe(65);
    expect(t.dns).toBe(10);
  });

  it('an empty timing yields all-not-applicable legs, never negatives', () => {
    expect(cdpTimingToHar({ requestTime: 1000 })).toEqual({
      blocked: -1,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: 0,
      wait: 0,
      receive: -1,
    });
  });
});

// ── stateful builder ────────────────────────────────────────────────

const TAB = 42;

function lastHarEntry(updates: readonly RequestLifecycleUpdate[]): InspectorHarEntry {
  const har = updates.filter((u) => u.kind === 'har-attached');
  const last = har.at(-1);
  if (last === undefined || last.kind !== 'har-attached') throw new Error('expected a har-attached update');
  return last.har;
}

describe('CdpHarBuilder — well-formed entry', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'rich' };

  function run(): { partial: InspectorHarEntry; refined: InspectorHarEntry } {
    const builder = new CdpHarBuilder();
    builder.observe(
      cdpStart(ctx, {
        request: {
          url: 'https://api.openheaders.io/users?team=core&page=2',
          method: 'GET',
          headers: { Cookie: 'sid=abc; theme=dark' },
        },
        wallTime: 1_700_000_000,
      }),
    );
    const partial = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: {
            url: 'https://api.openheaders.io/users?team=core&page=2',
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'a=1; Path=/\nb=2; HttpOnly',
            },
            remoteIPAddress: '203.0.113.7',
            protocol: 'h2',
            mimeType: 'application/json',
            timing: FULL_TIMING,
          },
        }),
      ),
    );
    const refined = lastHarEntry(
      builder.observe(cdpFinished(ctx, { encodedDataLength: 4096, timestamp: FULL_TIMING.requestTime + 0.25 })),
    );
    return { partial, refined };
  }

  it('parses request cookies and query string from the request', () => {
    const { refined } = run();
    expect(refined.request?.cookies).toEqual([
      { name: 'sid', value: 'abc' },
      { name: 'theme', value: 'dark' },
    ]);
    expect(refined.request?.queryString).toEqual([
      { name: 'team', value: 'core' },
      { name: 'page', value: '2' },
    ]);
  });

  it('parses response cookies (Set-Cookie split on the CDP newline join)', () => {
    const { refined } = run();
    expect(refined.response?.cookies).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });

  it('projects server IP, protocol, mime type, and ISO start', () => {
    const { refined } = run();
    expect(refined.serverIPAddress).toBe('203.0.113.7');
    expect(refined.response?.httpVersion).toBe('h2');
    expect(refined.response?.content.mimeType).toBe('application/json');
    expect(refined.startedDateTime).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('refines from a partial (no transfer/receive) to a complete entry on loadingFinished', () => {
    const { partial, refined } = run();
    // Partial emitted at responseReceived: headers/status known, but the
    // body has not finished — transfer size and receive leg deferred.
    expect(partial.response?._transferSize).toBeUndefined();
    expect(partial.time).toBeUndefined();
    expect(partial.timings?.receive).toBe(-1);
    // Refined at loadingFinished: wire bytes + total + receive resolved.
    expect(refined.response?._transferSize).toBe(4096);
    expect(refined.time).toBe(250);
    expect(refined.timings?.receive).toBe(150);
  });

  it('marks header/body byte sizes unavailable (-1) on request and response (HAR sentinel)', () => {
    const { refined } = run();
    expect(refined.request?.headersSize).toBe(-1);
    expect(refined.request?.bodySize).toBe(-1);
    expect(refined.response?.headersSize).toBe(-1);
    expect(refined.response?.bodySize).toBe(-1);
  });
});

// ── *ExtraInfo on-the-wire header merge ─────────────────────────────

const RESPONSE = {
  url: 'https://api.openheaders.io/x',
  status: 200,
  statusText: 'OK',
  headers: { 'X-Cooked': 'base', 'Set-Cookie': 'cooked=1' },
};

describe('CdpHarBuilder — *ExtraInfo header merge', () => {
  it('extra-before-base: the wire header sets supersede the cooked ones at responseReceived', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'extra-first' };
    const builder = new CdpHarBuilder();
    // The common Chrome ordering: ExtraInfo precedes its base event.
    expect(builder.observe(cdpRequestExtra(ctx, { Cookie: 'sid=wire; hidden=1', 'X-Browser-Added': 'yes' }))).toEqual(
      [],
    );
    expect(builder.observe(cdpResponseExtra(ctx, { 'X-On-Wire': 'real', 'Set-Cookie': 'sess=raw; HttpOnly' }))).toEqual(
      [],
    );
    builder.observe(
      cdpStart(ctx, { request: { url: RESPONSE.url, method: 'GET', headers: { Cookie: 'sid=cooked' } } }),
    );
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx, { response: RESPONSE })));

    // Request headers + cookies come from the wire set, wholesale.
    expect(entry.request?.headers).toEqual([
      { name: 'Cookie', value: 'sid=wire; hidden=1' },
      { name: 'X-Browser-Added', value: 'yes' },
    ]);
    expect(entry.request?.cookies).toEqual([
      { name: 'sid', value: 'wire' },
      { name: 'hidden', value: '1' },
    ]);
    // Response headers replaced wholesale; the cooked `X-Cooked` is gone.
    expect(entry.response?.headers).toContainEqual({ name: 'X-On-Wire', value: 'real' });
    expect(entry.response?.headers).not.toContainEqual({ name: 'X-Cooked', value: 'base' });
    // Set-Cookie parsed from the wire response headers, not the cooked ones.
    expect(entry.response?.cookies).toEqual([{ name: 'sess', value: 'raw' }]);
  });

  it('base-before-extra: a late ExtraInfo re-emits a refined har-attached', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'base-first' };
    const builder = new CdpHarBuilder();
    builder.observe(
      cdpStart(ctx, { request: { url: RESPONSE.url, method: 'GET', headers: { Cookie: 'sid=cooked' } } }),
    );
    const partial = lastHarEntry(builder.observe(cdpResponse(ctx, { response: RESPONSE })));
    // Before the extras land, the cooked headers stand.
    expect(partial.request?.cookies).toEqual([{ name: 'sid', value: 'cooked' }]);
    expect(partial.response?.cookies).toEqual([{ name: 'cooked', value: '1' }]);

    // A request-extra arriving after the response re-emits immediately.
    const reqUpdates = builder.observe(cdpRequestExtra(ctx, { Cookie: 'sid=wire' }));
    expect(reqUpdates).toHaveLength(1);
    expect(lastHarEntry(reqUpdates).request?.cookies).toEqual([{ name: 'sid', value: 'wire' }]);

    // A response-extra likewise supersedes the response section.
    const refined = lastHarEntry(
      builder.observe(cdpResponseExtra(ctx, { 'Set-Cookie': 'wire=2', 'X-On-Wire': 'real' })),
    );
    expect(refined.response?.cookies).toEqual([{ name: 'wire', value: '2' }]);
    expect(refined.response?.headers).not.toContainEqual({ name: 'X-Cooked', value: 'base' });
    expect(refined.response?._transferSize).toBeUndefined(); // still pre-finish: enrichment level preserved
  });

  it('a pre-base extra survives the base requestWillBeSent (stub adoption, no reset)', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'stub' };
    const builder = new CdpHarBuilder();
    builder.observe(cdpRequestExtra(ctx, { Cookie: 'sid=wire' }));
    expect(builder.size()).toBe(1); // a hop-less stub holds the stash
    builder.observe(cdpStart(ctx));
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx, { response: RESPONSE })));
    expect(entry.request?.cookies).toEqual([{ name: 'sid', value: 'wire' }]);
  });

  it('targets the right hop: each hop carries its own wire Set-Cookie', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'redir-extra' };
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { wallTime: 1000 }));
    // hop 0's response Set-Cookie rides only the response-extra (the
    // redirectResponse base event omits it).
    builder.observe(cdpResponseExtra(ctx, { 'Set-Cookie': 'hop0=a; Path=/' }));
    const hop0 = builder.observe(
      cdpRedirect(
        ctx,
        {
          url: 'https://api.openheaders.io/users',
          status: 301,
          statusText: 'Moved Permanently',
          timing: { requestTime: 999, sendStart: 0, sendEnd: 2, receiveHeadersEnd: 20 },
        },
        'https://api.openheaders.io/v2/users',
        { timestamp: 999.1, wallTime: 1000.1 },
      ),
    );
    const u0 = hop0.at(-1);
    if (u0?.kind !== 'har-attached') throw new Error('expected har-attached for hop 0');
    expect(u0.hopIndex).toBe(0);
    expect(u0.har.response?.cookies).toEqual([{ name: 'hop0', value: 'a' }]);

    builder.observe(cdpResponseExtra(ctx, { 'Set-Cookie': 'hop1=b' }));
    builder.observe(
      cdpResponse(ctx, {
        response: { url: 'https://api.openheaders.io/v2/users', status: 200, statusText: 'OK' },
        timestamp: 999.6,
      }),
    );
    const hop1 = builder.observe(cdpFinished(ctx, { timestamp: 999.7, encodedDataLength: 512 }));
    const u1 = hop1.at(-1);
    if (u1?.kind !== 'har-attached') throw new Error('expected har-attached for hop 1');
    expect(u1.hopIndex).toBe(1);
    expect(u1.har.response?.cookies).toEqual([{ name: 'hop1', value: 'b' }]);
  });

  it('does not re-emit while the hop has no response yet (extra between start and response)', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'mid' };
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    // Hop exists but no response: nothing to refine yet, applied later.
    expect(builder.observe(cdpResponseExtra(ctx, { 'Set-Cookie': 'late=1' }))).toEqual([]);
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx, { response: RESPONSE })));
    expect(entry.response?.cookies).toEqual([{ name: 'late', value: '1' }]);
  });
});

describe('CdpHarBuilder — initiator chain', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'init' };

  it('forwards the Network.Initiator (incl. the call-frame stack) onto _initiator', () => {
    const builder = new CdpHarBuilder();
    const initiator = {
      type: 'script' as const,
      url: 'https://app.openheaders.io/main.js',
      lineNumber: 41,
      columnNumber: 7,
      stack: {
        callFrames: [
          {
            functionName: 'loadUsers',
            scriptId: '7',
            url: 'https://app.openheaders.io/main.js',
            lineNumber: 41,
            columnNumber: 7,
          },
        ],
      },
    };
    builder.observe(cdpStart(ctx, { initiator }));
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(entry._initiator).toEqual(initiator);
  });

  it('omits _initiator when the request carried no initiator', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { initiator: undefined }));
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(entry._initiator).toBeUndefined();
  });
});

describe('CdpHarBuilder — redirect hops', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'redir' };

  it('synthesizes the prior hop HAR from redirectResponse at its own hopIndex', () => {
    const builder = new CdpHarBuilder();
    expect(builder.observe(cdpStart(ctx, { wallTime: 1000 }))).toEqual([]);

    const hop0 = builder.observe(
      cdpRedirect(
        ctx,
        {
          url: 'https://api.openheaders.io/users',
          status: 301,
          statusText: 'Moved Permanently',
          remoteIPAddress: '203.0.113.1',
          timing: { requestTime: 999, sendStart: 0, sendEnd: 2, receiveHeadersEnd: 20 },
        },
        'https://api.openheaders.io/v2/users',
        { timestamp: 999.1, wallTime: 1000.1 },
      ),
    );
    expect(hop0).toHaveLength(1);
    const u0 = hop0[0];
    if (u0?.kind !== 'har-attached') throw new Error('expected har-attached for hop 0');
    expect(u0.hopIndex).toBe(0);
    expect(u0.har.response?.status).toBe(301);
    expect(u0.har.serverIPAddress).toBe('203.0.113.1');
    // total = (nextRequest 999.1 - priorRequestTime 999) * 1000 = 100ms.
    expect(u0.har.time).toBe(100);

    builder.observe(
      cdpResponse(ctx, {
        response: {
          url: 'https://api.openheaders.io/v2/users',
          status: 200,
          statusText: 'OK',
          timing: { requestTime: 999.2, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 10 },
        },
        timestamp: 999.6,
      }),
    );
    const hop1 = builder.observe(cdpFinished(ctx, { timestamp: 999.7, encodedDataLength: 512 }));
    const u1 = hop1.at(-1);
    if (u1?.kind !== 'har-attached') throw new Error('expected har-attached for hop 1');
    expect(u1.hopIndex).toBe(1);
    expect(u1.har.response?.status).toBe(200);
    expect(u1.har.response?._transferSize).toBe(512);
  });
});

// ── decoded content size (dataReceived) + request payload ───────────

describe('CdpHarBuilder — decoded content size', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'sized' };

  it('sums dataReceived chunks into response.content.size at loadingFinished', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const partial = lastHarEntry(builder.observe(cdpResponse(ctx)));
    // No body chunks yet → decoded size is 0 (the regression that read as
    // "0 B resources" when it never refined).
    expect(partial.response?.content.size).toBe(0);

    builder.observe(cdpData(ctx, 1000));
    builder.observe(cdpData(ctx, 2345));
    const refined = lastHarEntry(builder.observe(cdpFinished(ctx, { encodedDataLength: 1024 })));
    expect(refined.response?.content.size).toBe(3345);
    // Transfer (wire) size stays independent of decoded size.
    expect(refined.response?._transferSize).toBe(1024);
  });

  it('ignores a dataReceived for an unknown request (no hop) without throwing', () => {
    const builder = new CdpHarBuilder();
    expect(builder.observe(cdpData(ctx, 512))).toEqual([]);
    expect(builder.size()).toBe(0);
  });

  it('attributes body chunks to the final hop of a redirect chain', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { wallTime: 1000 }));
    builder.observe(
      cdpRedirect(
        ctx,
        { url: 'https://api.openheaders.io/users', status: 301, statusText: 'Moved Permanently' },
        'https://api.openheaders.io/v2/users',
        { timestamp: 100.1, wallTime: 1000.1 },
      ),
    );
    builder.observe(
      cdpResponse(ctx, { response: { url: 'https://api.openheaders.io/v2/users', status: 200, statusText: 'OK' } }),
    );
    builder.observe(cdpData(ctx, 4096));
    const updates = builder.observe(cdpFinished(ctx, { encodedDataLength: 600 }));
    const u1 = updates.at(-1);
    if (u1?.kind !== 'har-attached') throw new Error('expected har-attached for the final hop');
    expect(u1.hopIndex).toBe(1);
    expect(u1.har.response?.content.size).toBe(4096);
  });

  it('falls back to Content-Length when no body streams (canceled 206 media / cache hit)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    // A `<video>` range probe: 206 with the full size in headers, then the
    // element aborts it — no dataReceived, no loadingFinished. The size
    // must still come through (the "0 B resources" miss on media/cache).
    const entry = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: {
            url: 'https://cdn.openheaders.io/clip.mp4',
            status: 206,
            statusText: 'Partial Content',
            headers: { 'Content-Length': '1081684', 'Content-Range': 'bytes 0-1081683/1081684' },
          },
        }),
      ),
    );
    expect(entry.response?.content.size).toBe(1081684);
    // The trailing abort finalizes the responded hop: it re-emits with
    // `_error` set and the already-projected size intact.
    const aborted = lastHarEntry(builder.observe(cdpFailed(ctx, { errorText: 'net::ERR_ABORTED', canceled: true })));
    expect(aborted.response?._error).toBe('net::ERR_ABORTED');
    expect(aborted.response?.content.size).toBe(1081684);
  });

  it('prefers the streamed dataReceived sum over a smaller (encoded) Content-Length', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    builder.observe(
      cdpResponse(ctx, {
        response: {
          url: 'https://api.openheaders.io/big.json',
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Length': '2000', 'Content-Encoding': 'gzip' },
        },
      }),
    );
    builder.observe(cdpData(ctx, 8000));
    const entry = lastHarEntry(builder.observe(cdpFinished(ctx, { encodedDataLength: 2000 })));
    // Decoded (8000) beats the compressed Content-Length (2000).
    expect(entry.response?.content.size).toBe(8000);
  });
});

describe('CdpHarBuilder — request payload', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'payload' };

  function entryWith(request: { url: string; method: string; headers?: Record<string, string>; postData?: string }) {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { request }));
    return lastHarEntry(builder.observe(cdpResponse(ctx)));
  }

  it('projects an inline request body onto request.postData (text + Content-Type mime)', () => {
    const entry = entryWith({
      url: 'https://api.openheaders.io/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      postData: '{"name":"core"}',
    });
    expect(entry.request?.postData).toEqual({ mimeType: 'application/json', text: '{"name":"core"}' });
  });

  it('splits a form-urlencoded body into params (Payload-tab parity with the heuristic HAR)', () => {
    const entry = entryWith({
      url: 'https://api.openheaders.io/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      postData: 'user=ada&team=core',
    });
    expect(entry.request?.postData?.params).toEqual([
      { name: 'user', value: 'ada' },
      { name: 'team', value: 'core' },
    ]);
    expect(entry.request?.postData?.text).toBe('user=ada&team=core');
  });

  it('omits postData when the request carried no body', () => {
    const entry = entryWith({ url: 'https://api.openheaders.io/users', method: 'GET' });
    expect(entry.request?.postData).toBeUndefined();
  });
});

// ── failed-terminal finalization ────────────────────────────────────

describe('CdpHarBuilder — failed-terminal finalization', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'aborted-media' };

  it('finalizes an aborted-but-responded hop: transfer size, time, _error, _resourceType', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { type: 'Media', timestamp: 1000 }));
    // Headers arrived with a wire-byte floor (encodedDataLength) and
    // connection timing, then the <video> element aborts mid-body — no
    // loadingFinished, just loadingFailed.
    builder.observe(
      cdpResponse(ctx, {
        type: 'Media',
        response: {
          url: 'https://cdn.openheaders.io/clip.mp4',
          status: 206,
          statusText: 'Partial Content',
          encodedDataLength: 434,
          timing: { requestTime: 1000, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 5 },
        },
      }),
    );
    const failed = lastHarEntry(
      builder.observe(cdpFailed(ctx, { type: 'Media', errorText: 'net::ERR_ABORTED', timestamp: 1000.654 })),
    );
    // The responseReceived floor carries through (loadingFailed has no size).
    expect(failed.response?._transferSize).toBe(434);
    expect(failed.response?._error).toBe('net::ERR_ABORTED');
    expect(failed._resourceType).toBe('media');
    // Time computed from the failure timestamp against the timing base.
    expect(failed.time).toBe(654);
  });

  it('returns no update for a failure with no response (blocked status-0 beacon)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    expect(builder.observe(cdpFailed(ctx, { errorText: 'net::ERR_BLOCKED_BY_CLIENT' }))).toEqual([]);
  });

  it('ignores a failure for an unknown request (no state) without throwing', () => {
    const builder = new CdpHarBuilder();
    expect(builder.observe(cdpFailed({ tabId: TAB, requestId: 'ghost' }))).toEqual([]);
  });
});

describe('CdpHarBuilder — lifecycle bookkeeping', () => {
  it('forgetTab drops all state for the tab', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart({ tabId: TAB, requestId: 'a' }));
    builder.observe(cdpStart({ tabId: TAB, requestId: 'b' }));
    expect(builder.size()).toBe(2);
    builder.forgetTab(TAB);
    expect(builder.size()).toBe(0);
  });

  it('retains finalized state briefly, then gc-sweeps it on a later tick', () => {
    const builder = new CdpHarBuilder();
    const ctx: TraceCtx = { tabId: TAB, requestId: 'gc' };
    builder.observe(cdpStart(ctx, { timestamp: 100 }));
    builder.observe(cdpResponse(ctx, { timestamp: 100.5 }));
    builder.observe(cdpFinished(ctx, { timestamp: 101 }));
    expect(builder.size()).toBe(1); // retained right after terminal
    // A later event on the same tab, well past the retention window,
    // sweeps the finalized request.
    builder.observe(cdpStart({ tabId: TAB, requestId: 'next' }, { timestamp: 200 }));
    expect(builder.size()).toBe(1); // only the new request remains
  });
});

// ── store round-trip (invariants hold) ──────────────────────────────

describe('CdpCorrelator → RequestLifecycleStore — HAR lands per hop with zero rejections', () => {
  const ctx: TraceCtx = { tabId: 55, requestId: 'cdp-har-rt', sessionId: PAGE_SESSION };

  it('redirect trace populates lifecycle.har[0] and har[1] and leaves invariants intact', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    correlator.subscribe((u) => store.apply(u));
    correlator.attachTab(ctx.tabId);

    const trace: CdpNetworkEvent[] = [
      cdpStart(ctx, { wallTime: 1000, timestamp: 100 }),
      cdpRedirect(
        ctx,
        {
          url: 'https://api.openheaders.io/users',
          status: 301,
          statusText: 'Moved Permanently',
          timing: { requestTime: 100, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 5 },
        },
        'https://api.openheaders.io/v2/users',
        { timestamp: 100.1, wallTime: 1000.1 },
      ),
      cdpResponse(ctx, {
        timestamp: 100.5,
        response: {
          url: 'https://api.openheaders.io/v2/users',
          status: 200,
          statusText: 'OK',
          timing: FULL_TIMING,
        },
      }),
      cdpData(ctx, 8192),
      cdpFinished(ctx, { timestamp: FULL_TIMING.requestTime + 0.25, encodedDataLength: 2048 }),
    ];
    for (const event of trace) source.emit(event);

    const lc = store.get(ctx.tabId, cdpStoreRequestId(ctx.sessionId ?? PAGE_SESSION, ctx.requestId));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(onReject).not.toHaveBeenCalled();
    expect(lc.phase).toBe('completed');
    expect(lc.redirectHopCount).toBe(1);
    // Synthesized HAR landed in both hop slots, dense and non-null.
    expect(lc.har).toHaveLength(2);
    expect(lc.har[0]?.response?.status).toBe(301);
    expect(lc.har[1]?.response?.status).toBe(200);
    expect(lc.har[1]?.response?._transferSize).toBe(2048);
    expect(lc.har[1]?.response?.content.size).toBe(8192);
    expect(lc.har[1]?.timings?.receive).toBe(150);

    correlator.dispose();
  });

  it('a trace interleaving *ExtraInfo lands the wire headers in lifecycle.har with zero rejections', () => {
    const ctxLocal: TraceCtx = { tabId: 56, requestId: 'cdp-extra-rt', sessionId: PAGE_SESSION };
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    correlator.subscribe((u) => store.apply(u));
    correlator.attachTab(ctxLocal.tabId);

    const trace: CdpNetworkEvent[] = [
      cdpRequestExtra(ctxLocal, { Cookie: 'sid=wire' }),
      cdpStart(ctxLocal, { request: { url: RESPONSE.url, method: 'GET', headers: { Cookie: 'sid=cooked' } } }),
      cdpResponseExtra(ctxLocal, { 'Set-Cookie': 'sess=raw; HttpOnly' }),
      cdpResponse(ctxLocal, { response: RESPONSE }),
      cdpFinished(ctxLocal, { encodedDataLength: 256 }),
    ];
    for (const event of trace) source.emit(event);

    const lc = store.get(ctxLocal.tabId, cdpStoreRequestId(PAGE_SESSION, ctxLocal.requestId));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(onReject).not.toHaveBeenCalled();
    expect(lc.phase).toBe('completed');
    expect(lc.har).toHaveLength(1);
    expect(lc.har[0]?.request?.cookies).toEqual([{ name: 'sid', value: 'wire' }]);
    expect(lc.har[0]?.response?.cookies).toEqual([{ name: 'sess', value: 'raw' }]);
    expect(lc.har[0]?.response?._transferSize).toBe(256);

    correlator.dispose();
  });

  it('a failed-after-response trace lands _error/time/_transferSize with zero rejections', () => {
    const ctxLocal: TraceCtx = { tabId: 57, requestId: 'cdp-failed-rt', sessionId: PAGE_SESSION };
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    correlator.subscribe((u) => store.apply(u));
    correlator.attachTab(ctxLocal.tabId);

    const trace: CdpNetworkEvent[] = [
      cdpStart(ctxLocal, { type: 'Media', wallTime: 1000, timestamp: 1000 }),
      cdpResponse(ctxLocal, {
        timestamp: 1000.1,
        type: 'Media',
        response: {
          url: 'https://cdn.openheaders.io/clip.mp4',
          status: 206,
          statusText: 'Partial Content',
          encodedDataLength: 434,
          timing: { requestTime: 1000, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 5 },
        },
      }),
      cdpFailed(ctxLocal, { type: 'Media', errorText: 'net::ERR_ABORTED', timestamp: 1000.654 }),
    ];
    for (const event of trace) source.emit(event);

    const lc = store.get(ctxLocal.tabId, cdpStoreRequestId(PAGE_SESSION, ctxLocal.requestId));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(onReject).not.toHaveBeenCalled();
    expect(lc.phase).toBe('failed');
    expect(lc.har).toHaveLength(1);
    expect(lc.har[0]?.response?._error).toBe('net::ERR_ABORTED');
    expect(lc.har[0]?.response?._transferSize).toBe(434);
    expect(lc.har[0]?._resourceType).toBe('media');
    expect(lc.har[0]?.time).toBe(654);

    correlator.dispose();
  });
});

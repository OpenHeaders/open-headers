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
import { cdpRawTiming, cdpTimingToHar } from '../../src/correlator-cdp/cdp-har-synth';
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
    // No issue time supplied → not queued; Chrome folds the queue (-1 here)
    // into blocked, so blocked = -1 + earliest-activity offset (dnsStart 0).
    const t = cdpTimingToHar(FULL_TIMING, 250);
    expect(t.blocked).toBe(-1);
    expect(t.dns).toBe(10);
    expect(t.ssl).toBe(15); // ssl precedes connect, matching Chrome's key order
    // connect re-anchors to min(dnsEnd, blockedStart) = 0 (not connectStart),
    // so it spans 0..connectEnd and overlaps dns — host-exact (Log.ts:310).
    expect(t.connect).toBe(30);
    expect(t.send).toBe(5);
    // wait/receive are derived as deltas off requestTime (host-exact), so they
    // carry the same IEEE-754 noise the host emits — assert to µs, not bit-exact.
    expect(t.wait).toBeCloseTo(65, 6); // receiveHeadersEnd - highestTime (sendEnd)
    expect(t.receive).toBeCloseTo(150, 6); // totalMs - waitEnd
    expect(t._blocked_queueing).toBe(-1);
    expect(t._workerStart).toBe(-1);
    expect(t._workerReady).toBe(-1);
    expect(t._workerFetchStart).toBe(-1);
    expect(t._workerRespondWithSettled).toBe(-1);
  });

  it('reused connection omits dns/connect/ssl and floors blocked at sendStart', () => {
    // Not queued (-1) + earliest offset (sendStart 5) → blocked = 4.
    const t = cdpTimingToHar(REUSED_CONNECTION, 60);
    expect(t.blocked).toBe(4);
    expect(t.dns).toBe(-1);
    expect(t.ssl).toBe(-1);
    expect(t.connect).toBe(-1);
    expect(t.send).toBe(3);
    expect(t.wait).toBeCloseTo(32, 6);
    expect(t.receive).toBeCloseTo(20, 6);
    expect(t._blocked_queueing).toBe(-1);
    expect(t._workerStart).toBe(-1);
    expect(t._workerReady).toBe(-1);
    expect(t._workerFetchStart).toBe(-1);
    expect(t._workerRespondWithSettled).toBe(-1);
  });

  it('without a total, receive is deferred (-1) but other legs still resolve', () => {
    const t = cdpTimingToHar(FULL_TIMING, undefined);
    expect(t.receive).toBe(-1);
    expect(t.wait).toBeCloseTo(65, 6);
    expect(t.dns).toBe(10);
  });

  it('an empty timing yields all-not-applicable legs, never negatives', () => {
    expect(cdpTimingToHar({ requestTime: 1000 })).toEqual({
      blocked: -1,
      dns: -1,
      ssl: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: -1,
      _blocked_queueing: -1,
      _workerStart: -1,
      _workerReady: -1,
      _workerFetchStart: -1,
      _workerRespondWithSettled: -1,
    });
  });

  it('derives _blocked_queueing from the issue time and a proxy leg from proxyStart/proxyEnd', () => {
    // issuedSec 999.95 → requestTime 1000 is 50ms of queueing; proxy 2..7 = 5ms.
    const t = cdpTimingToHar({ requestTime: 1000, proxyStart: 2, proxyEnd: 7, sendStart: 10, sendEnd: 12 }, 50, 999.95);
    expect(t._blocked_queueing).toBeCloseTo(50, 6);
    expect(t._blocked_proxy).toBe(5);
  });

  it('omits _blocked_proxy when no proxy leg ran and floors queueing at -1 for a same-instant issue', () => {
    const t = cdpTimingToHar(FULL_TIMING, 250, FULL_TIMING.requestTime);
    expect(t._blocked_queueing).toBe(-1); // issuedSec === requestTime → not queued
    expect(t._blocked_proxy).toBeUndefined();
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
        timestamp: FULL_TIMING.requestTime, // issue == network start (no queue)
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
    expect(refined.response?.httpVersion).toBe('http/2.0'); // Chrome maps h2 → http/2.0
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
    // time sums [blocked,dns,connect,send,wait,receive] = 0+10+30+5+65+150.
    // It exceeds the 250ms span because connect overlaps dns — Chrome's HAR
    // time double-counts the DNS leg the same way (Log.ts:96-100). The
    // wait/receive float noise cancels in the sum, so time is exact.
    expect(refined.time).toBeCloseTo(260, 6);
    expect(refined.timings?.receive).toBeCloseTo(150, 6);
  });

  it('marks header byte sizes unavailable (-1) and request.bodySize 0 for a bodyless GET', () => {
    const { refined } = run();
    expect(refined.request?.headersSize).toBe(-1);
    expect(refined.request?.bodySize).toBe(0); // no post data → 0, matching Chrome
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

    // A request-extra arriving after the response both promotes the lifecycle
    // request headers to the wire set (clearing provisional) and re-emits the
    // refined HAR.
    const reqUpdates = builder.observe(cdpRequestExtra(ctx, { Cookie: 'sid=wire' }));
    expect(reqUpdates).toHaveLength(2);
    expect(reqUpdates[0]).toMatchObject({ kind: 'phase', patch: { requestHeadersProvisional: false } });
    expect(lastHarEntry(reqUpdates).request?.cookies).toEqual([{ name: 'sid', value: 'wire' }]);

    // A response-extra likewise supersedes the response section.
    const refined = lastHarEntry(
      builder.observe(cdpResponseExtra(ctx, { 'Set-Cookie': 'wire=2', 'X-On-Wire': 'real' })),
    );
    expect(refined.response?.cookies).toEqual([{ name: 'wire', value: '2' }]);
    expect(refined.response?.headers).not.toContainEqual({ name: 'X-Cooked', value: 'base' });
    expect(refined.response?._transferSize).toBeUndefined(); // still pre-finish: enrichment level preserved
  });

  it('stamps the request section effective once its wire set landed; a wire response never upgrades', () => {
    const ctx: TraceCtx = { tabId: TAB, requestId: 'capture-stamp' };
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { request: { url: RESPONSE.url, method: 'GET', headers: {} } }));
    // Cooked sets only: both sections are pre-rewrite captures.
    const cooked = lastHarEntry(builder.observe(cdpResponse(ctx, { response: RESPONSE })));
    expect(cooked._ohHeaderCapture).toEqual({ request: 'raw', response: 'raw' });
    // The request wire set lands: only the request section upgrades.
    const reqWire = lastHarEntry(builder.observe(cdpRequestExtra(ctx, { Cookie: 'sid=wire' })));
    expect(reqWire._ohHeaderCapture).toEqual({ request: 'effective', response: 'raw' });
    // The response wire set lands but stays `raw`: the fire-evidence probe
    // ground-truthed `responseReceivedExtraInfo` as PRE-rewrite (it held the
    // server's original header while the page received the DNR-rewritten
    // value), so response claims must never be judged against it.
    const bothWire = lastHarEntry(builder.observe(cdpResponseExtra(ctx, { 'X-On-Wire': 'real' })));
    expect(bothWire._ohHeaderCapture).toEqual({ request: 'effective', response: 'raw' });
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
    // The redirect emits hop 0's finalized HAR plus hop 1's request-header
    // patch; pick out the har-attached.
    const u0 = hop0.find((u) => u.kind === 'har-attached');
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

  it('projects the Network.Initiator onto _initiator, dropping top-level columnNumber (Chrome shape)', () => {
    const builder = new CdpHarBuilder();
    const stack = {
      callFrames: [
        {
          functionName: 'loadUsers',
          scriptId: '7',
          url: 'https://app.openheaders.io/main.js',
          lineNumber: 41,
          columnNumber: 7,
        },
      ],
    };
    builder.observe(
      cdpStart(ctx, {
        initiator: {
          type: 'script',
          url: 'https://app.openheaders.io/main.js',
          lineNumber: 41,
          columnNumber: 7,
          stack,
        },
      }),
    );
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx)));
    // Chrome's exporter keeps type/url/lineNumber/stack but omits the
    // top-level columnNumber (the call-frame columnNumber inside stack stays).
    expect(entry._initiator).toEqual({
      type: 'script',
      url: 'https://app.openheaders.io/main.js',
      lineNumber: 41,
      stack,
    });
  });

  it('emits _initiator: null when the request carried no initiator (Chrome always emits)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { initiator: undefined }));
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(entry._initiator).toBeNull();
  });
});

describe('CdpHarBuilder — redirect hops', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'redir' };

  it('synthesizes the prior hop HAR from redirectResponse at its own hopIndex', () => {
    const builder = new CdpHarBuilder();
    // issue at the timing base (999) so the hop isn't reported as queued.
    // `requestWillBeSent` surfaces the hop's cooked (provisional) request headers.
    expect(builder.observe(cdpStart(ctx, { wallTime: 1000, timestamp: 999 }))).toMatchObject([
      { kind: 'phase', patch: { requestHeadersProvisional: true } },
    ]);

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
    // hop 0's finalized HAR plus hop 1's cooked request-header patch.
    expect(hop0).toHaveLength(2);
    const u0 = hop0.find((u) => u.kind === 'har-attached');
    if (u0?.kind !== 'har-attached') throw new Error('expected har-attached for hop 0');
    expect(u0.hopIndex).toBe(0);
    expect(u0.har.response?.status).toBe(301);
    expect(u0.har.serverIPAddress).toBe('203.0.113.1');
    // total = (nextRequest 999.1 - priorRequestTime 999) * 1000 = 100ms.
    expect(u0.har.time).toBeCloseTo(100, 6);

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

  it('emits an in-flight progress patch per body chunk (running bytes + wall last-activity)', () => {
    // Injected resolver proves the monotonic→wall conversion is wired through
    // the constructor (offset +7 so the assertion can only pass via toWallMs).
    const builder = new CdpHarBuilder((_tabId, _sessionId, _requestId, sec) => sec * 1000 + 7);
    builder.observe(cdpStart(ctx));
    builder.observe(cdpResponse(ctx));
    const id = cdpStoreRequestId(PAGE_SESSION, 'sized');

    const first = builder.observe(cdpData(ctx, 1000, { encodedDataLength: 1100, timestamp: 200 }));
    expect(first).toHaveLength(1);
    const u1 = first[0];
    if (u1.kind !== 'phase') throw new Error('expected an in-flight progress phase patch');
    expect(u1.requestId).toBe(id);
    // Decoded bytes are a pure running sum (no response floor); wall instant
    // comes from the injected resolver, not the raw monotonic timestamp.
    expect(u1.patch.bytesReceivedSoFar).toBe(1000);
    expect(u1.patch.lastActivityAtMs).toBe(200 * 1000 + 7);
    const transferred1 = u1.patch.bytesTransferredSoFar ?? 0;

    const second = builder.observe(cdpData(ctx, 500, { encodedDataLength: 600, timestamp: 201 }));
    const u2 = second[0];
    if (u2?.kind !== 'phase') throw new Error('expected a second progress patch');
    // Both running counts advance; the patch carries no phase change.
    expect(u2.patch.phase).toBeUndefined();
    expect(u2.patch.bytesReceivedSoFar).toBe(1500);
    expect((u2.patch.bytesTransferredSoFar ?? 0) - transferred1).toBe(600);
    expect(u2.patch.lastActivityAtMs).toBe(201 * 1000 + 7);
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

// ── always-present per-entry fields (Chrome Log.ts parity) ──────────

describe('CdpHarBuilder — always-present per-entry fields', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'parity' };

  it('emits cache:{} and a redirectURL on every entry (Location header or "")', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const plain = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(plain.cache).toEqual({});
    expect(plain.response?.redirectURL).toBe('');

    const redirCtx: TraceCtx = { tabId: TAB, requestId: 'parity-redir' };
    builder.observe(cdpStart(redirCtx));
    const redir = lastHarEntry(
      builder.observe(
        cdpResponse(redirCtx, {
          response: {
            url: 'https://api.openheaders.io/old',
            status: 302,
            statusText: 'Found',
            headers: { Location: 'https://api.openheaders.io/new' },
          },
        }),
      ),
    );
    expect(redir.response?.redirectURL).toBe('https://api.openheaders.io/new');
  });

  it('always projects _fetchedViaServiceWorker as a boolean (true when fromServiceWorker)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const plain = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(plain.response?._fetchedViaServiceWorker).toBe(false);

    const swCtx: TraceCtx = { tabId: TAB, requestId: 'parity-sw' };
    builder.observe(cdpStart(swCtx));
    const sw = lastHarEntry(
      builder.observe(
        cdpResponse(swCtx, {
          response: { url: 'https://api.openheaders.io/sw', status: 200, statusText: 'OK', fromServiceWorker: true },
        }),
      ),
    );
    expect(sw.response?._fetchedViaServiceWorker).toBe(true);
  });

  it("flags _fromCache 'disk' for a disk-cache hit with nothing on the wire", () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    builder.observe(
      cdpResponse(ctx, {
        response: { url: 'https://api.openheaders.io/cached.js', status: 200, statusText: 'OK', fromDiskCache: true },
      }),
    );
    const entry = lastHarEntry(builder.observe(cdpFinished(ctx, { encodedDataLength: 0 })));
    expect(entry._fromCache).toBe('disk');
    // The served (cooked) set carries the engine's re-applied rewrite —
    // the response section of a cache read is a post-rewrite capture.
    expect(entry._ohHeaderCapture).toEqual({ request: 'raw', response: 'effective' });
  });

  it('a cache-read response with a superseding wire ExtraInfo set stays raw', () => {
    const wireCtx: TraceCtx = { tabId: TAB, requestId: 'cache-extra' };
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(wireCtx));
    builder.observe(
      cdpResponse(wireCtx, {
        response: { url: 'https://api.openheaders.io/cached.js', status: 200, statusText: 'OK', fromDiskCache: true },
      }),
    );
    builder.observe(cdpResponseExtra(wireCtx, { 'X-On-Wire': 'real' }));
    const entry = lastHarEntry(builder.observe(cdpFinished(wireCtx, { encodedDataLength: 0 })));
    expect(entry._ohHeaderCapture?.response).toBe('raw');
  });

  it('computes request.bodySize as the UTF-8 byte length (multi-byte body)', () => {
    const builder = new CdpHarBuilder();
    // '😀' is two UTF-16 code units (.length 2) but four UTF-8 bytes.
    builder.observe(
      cdpStart(ctx, { request: { url: 'https://api.openheaders.io/x', method: 'POST', postData: '😀' } }),
    );
    const withBody = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(withBody.request?.bodySize).toBe(4);

    const noBodyCtx: TraceCtx = { tabId: TAB, requestId: 'parity-nobody' };
    builder.observe(cdpStart(noBodyCtx, { request: { url: 'https://api.openheaders.io/x', method: 'GET' } }));
    const noBody = lastHarEntry(builder.observe(cdpResponse(noBodyCtx)));
    expect(noBody.request?.bodySize).toBe(0);
  });

  it('round-trips _priority, connection, and _connectionId from the new CDP fields', () => {
    const builder = new CdpHarBuilder();
    builder.observe(
      cdpStart(ctx, {
        request: { url: 'https://api.openheaders.io/x', method: 'GET', initialPriority: 'VeryHigh' },
      }),
    );
    const entry = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: {
            url: 'https://api.openheaders.io/x',
            status: 200,
            statusText: 'OK',
            remotePort: 443,
            connectionId: 17,
          },
        }),
      ),
    );
    expect(entry._priority).toBe('VeryHigh');
    expect(entry.connection).toBe('443');
    expect(entry._connectionId).toBe('17');
  });

  it('omits _connectionId for connection id 0 (no socket, e.g. a cache hit)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const entry = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: { url: 'https://api.openheaders.io/x', status: 200, statusText: 'OK', connectionId: 0 },
        }),
      ),
    );
    expect(entry._connectionId).toBeUndefined();
  });

  it("normalizes serverIPAddress verbatim to Chrome's exporter (only empty [] stripped)", () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const v4 = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: {
            url: 'https://api.openheaders.io/x',
            status: 200,
            statusText: 'OK',
            remoteIPAddress: '203.0.113.7',
          },
        }),
      ),
    );
    expect(v4.serverIPAddress).toBe('203.0.113.7');

    // Chrome's exporter regex (`/\[\]/g`) removes only an empty bracket pair;
    // a populated IPv6 address passes through unchanged — we match it byte-for-byte.
    const v6Ctx: TraceCtx = { tabId: TAB, requestId: 'parity-v6' };
    builder.observe(cdpStart(v6Ctx));
    const v6 = lastHarEntry(
      builder.observe(
        cdpResponse(v6Ctx, {
          response: {
            url: 'https://api.openheaders.io/x',
            status: 200,
            statusText: 'OK',
            remoteIPAddress: '[2606:4700::1]',
          },
        }),
      ),
    );
    expect(v6.serverIPAddress).toBe('[2606:4700::1]');
  });

  it('drops the URL #fragment from request.url and the query string', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { request: { url: 'https://api.openheaders.io/x?a=1#section', method: 'GET' } }));
    const entry = lastHarEntry(builder.observe(cdpResponse(ctx)));
    expect(entry.request?.url).toBe('https://api.openheaders.io/x?a=1');
    expect(entry.request?.queryString).toEqual([{ name: 'a', value: '1' }]);
  });

  it('derives timings._blocked_queueing from the issue→network-start gap', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { timestamp: 100 }));
    const entry = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          response: {
            url: 'https://api.openheaders.io/x',
            status: 200,
            statusText: 'OK',
            timing: { requestTime: 100.05, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 5 },
          },
        }),
      ),
    );
    expect(entry.timings?._blocked_queueing).toBeCloseTo(50, 6);
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
    expect(failed.time).toBeCloseTo(654, 6);
  });

  it('accumulates _transferSize from dataReceived wire bytes when a hop aborts mid-body', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { type: 'Media', timestamp: 1000 }));
    builder.observe(
      cdpResponse(ctx, {
        type: 'Media',
        response: {
          url: 'https://cdn.openheaders.io/clip.mp4',
          status: 206,
          statusText: 'Partial Content',
          encodedDataLength: 433, // header floor reported at responseReceived
          timing: { requestTime: 1000, sendStart: 0, sendEnd: 1, receiveHeadersEnd: 5 },
        },
      }),
    );
    // ~87 kB of wire bytes streamed (141765 decoded) before the <video> aborts;
    // no loadingFinished arrives, so the summed chunks are the transfer size.
    builder.observe(cdpData(ctx, 141765, { encodedDataLength: 89116 }));
    const failed = lastHarEntry(
      builder.observe(cdpFailed(ctx, { type: 'Media', errorText: 'net::ERR_ABORTED', timestamp: 1000.654 })),
    );
    expect(failed.response?._transferSize).toBe(89549); // 433 floor + 89116 streamed
    expect(failed.response?.content.size).toBe(141765);
  });

  it('synthesizes a full status-0 entry for a failure with no response (blocked beacon)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { type: 'Ping', timestamp: 100 }));
    // Blocked before any response — Chrome still exports a full entry.
    const entry = lastHarEntry(
      builder.observe(cdpFailed(ctx, { type: 'Ping', errorText: 'net::ERR_BLOCKED_BY_CLIENT', timestamp: 100.7 })),
    );
    expect(entry.response?.status).toBe(0);
    expect(entry.response?._error).toBe('net::ERR_BLOCKED_BY_CLIENT');
    expect(entry.response?.content).toEqual({ size: 0, mimeType: 'x-unknown' });
    expect(entry.response?._transferSize).toBe(0);
    expect(entry._resourceType).toBe('ping');
    // Whole span attributed to blocked (failed 100.7 − issued 100 = 700ms).
    expect(entry.time).toBeCloseTo(700, 6);
    // blocked = (failed − issued) * 1000 carries raw float noise (host-exact);
    // every other leg is the no-response branch's fixed sentinel.
    expect(entry.timings?.blocked).toBeCloseTo(700, 6);
    expect(entry.timings).toMatchObject({
      dns: -1,
      ssl: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: 0,
      _blocked_queueing: -1,
    });
    expect(entry.request?.url).toBe('https://api.openheaders.io/users');
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

describe('CdpHarBuilder — bodyContext (the body-fetch plan)', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'plan' };
  const storeId = cdpStoreRequestId(PAGE_SESSION, ctx.requestId);

  it('reads in-flight with no decode hints before the response', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    const plan = builder.bodyContext(TAB, storeId);
    expect(plan).toMatchObject({ rawRequestId: 'plan', sessionId: PAGE_SESSION, inFlight: true });
    expect(plan?.mimeType).toBeUndefined();
    expect(plan?.charset).toBeUndefined();
  });

  it('carries the response MIME type + charset once headers land, still in flight', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    builder.observe(
      cdpResponse(ctx, {
        response: {
          url: 'https://api.openheaders.io/users',
          status: 200,
          statusText: 'OK',
          mimeType: 'text/html',
          charset: 'utf-8',
        },
      }),
    );
    expect(builder.bodyContext(TAB, storeId)).toMatchObject({
      inFlight: true,
      mimeType: 'text/html',
      charset: 'utf-8',
    });
  });

  it('reads finished after a success terminal', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    builder.observe(cdpResponse(ctx));
    builder.observe(cdpFinished(ctx));
    expect(builder.bodyContext(TAB, storeId)?.inFlight).toBe(false);
  });

  it('reads finished after a failure terminal', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx));
    builder.observe(cdpFailed(ctx));
    expect(builder.bodyContext(TAB, storeId)?.inFlight).toBe(false);
  });

  it('reads finished for a retention-swept request whose ref survives', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { timestamp: 100 }));
    builder.observe(cdpResponse(ctx, { timestamp: 100.5 }));
    builder.observe(cdpFinished(ctx, { timestamp: 101 }));
    // Sweep the finalized HAR state; the body ref outlives it.
    builder.observe(cdpStart({ tabId: TAB, requestId: 'next' }, { timestamp: 200 }));
    const plan = builder.bodyContext(TAB, storeId);
    expect(plan).toMatchObject({ rawRequestId: 'plan', inFlight: false });
  });

  it('is undefined for an unknown request', () => {
    const builder = new CdpHarBuilder();
    expect(builder.bodyContext(TAB, 'session-page::missing')).toBeUndefined();
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
    expect(lc.har[1]?.timings?.receive).toBeCloseTo(150, 6);

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
    expect(lc.har[0]?.time).toBeCloseTo(654, 6);

    correlator.dispose();
  });
});

describe('CdpHarBuilder — raw timing instants (`_rawTiming`)', () => {
  const ctx: TraceCtx = { tabId: TAB, requestId: 'raw' };

  function builderWithResponse(timing: CdpResourceTiming | undefined, responseSec = 1000.5) {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { timestamp: 999.9985 })); // issued 1.5 ms before requestTime
    const partial = lastHarEntry(
      builder.observe(
        cdpResponse(ctx, {
          timestamp: responseSec,
          response: {
            url: 'https://api.openheaders.io/users',
            status: 200,
            statusText: 'OK',
            ...(timing !== undefined ? { timing } : {}),
          },
        }),
      ),
    );
    return { builder, partial };
  }

  it('carries the unfolded offsets verbatim plus the issue/response instants on the partial', () => {
    const { partial } = builderWithResponse(FULL_TIMING);
    expect(partial._rawTiming).toEqual({
      issuedSec: 999.9985,
      requestTimeSec: 1000,
      dnsStart: 0,
      dnsEnd: 10,
      connectStart: 10,
      connectEnd: 30,
      sslStart: 15,
      sslEnd: 30,
      sendStart: 30,
      sendEnd: 35,
      receiveHeadersEnd: 100,
      responseReceivedSec: 1000.5,
      // no endSec yet — still streaming
    });
  });

  it('adds the terminal instant on loadingFinished', () => {
    const { builder } = builderWithResponse(FULL_TIMING);
    const refined = lastHarEntry(builder.observe(cdpFinished(ctx, { timestamp: 1000.25 })));
    expect(refined._rawTiming?.endSec).toBe(1000.25);
    expect(refined._rawTiming?.responseReceivedSec).toBe(1000.5);
  });

  it('adds the terminal instant on loadingFailed (canceled mid-body keeps its raw block)', () => {
    const { builder } = builderWithResponse(FULL_TIMING);
    const refined = lastHarEntry(builder.observe(cdpFailed(ctx, { errorText: 'net::ERR_ABORTED', timestamp: 1000.3 })));
    expect(refined._rawTiming?.endSec).toBe(1000.3);
    expect(refined.response?._error).toBe('net::ERR_ABORTED');
  });

  it('a redirect hop gets its raw block with the next request as the terminal (no response event instant)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { timestamp: 999.9985 }));
    const updates = builder.observe(
      cdpRedirect(
        ctx,
        {
          url: 'https://api.openheaders.io/users',
          status: 302,
          statusText: 'Found',
          headers: { Location: 'https://api.openheaders.io/v2/users' },
          timing: FULL_TIMING,
          encodedDataLength: 300,
        },
        'https://api.openheaders.io/v2/users',
        { timestamp: 1000.2 },
      ),
    );
    const hop0 = updates.find((u) => u.kind === 'har-attached');
    if (hop0 === undefined || hop0.kind !== 'har-attached') throw new Error('expected hop-0 har');
    expect(hop0.har._rawTiming?.endSec).toBe(1000.2);
    expect(hop0.har._rawTiming?.responseReceivedSec).toBeUndefined();
    expect(hop0.har._rawTiming?.requestTimeSec).toBe(1000);
  });

  it('a failed-before-response hop has no raw block (no instants to unfold)', () => {
    const builder = new CdpHarBuilder();
    builder.observe(cdpStart(ctx, { timestamp: 999.9985 }));
    const updates = builder.observe(cdpFailed(ctx, { errorText: 'net::ERR_BLOCKED_BY_CLIENT', timestamp: 1000.1 }));
    const har = lastHarEntry(updates);
    expect(har._rawTiming).toBeUndefined();
    expect(har.response?.status).toBe(0);
  });
});

describe('cdpRawTiming — pure projection', () => {
  it('omits absent offsets instead of forwarding -1', () => {
    const raw = cdpRawTiming(REUSED_CONNECTION, 999.9985, 1000.05, 1000.06);
    expect(raw).toEqual({
      issuedSec: 999.9985,
      requestTimeSec: 1000,
      sendStart: 5,
      sendEnd: 8,
      receiveHeadersEnd: 40,
      responseReceivedSec: 1000.05,
      endSec: 1000.06,
    });
    expect(raw).not.toHaveProperty('dnsStart');
    expect(raw).not.toHaveProperty('connectStart');
  });
});

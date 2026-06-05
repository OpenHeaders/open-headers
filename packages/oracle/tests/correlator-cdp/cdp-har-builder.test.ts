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
import type { CdpNetworkEvent, CdpResourceTiming } from '../../src/correlator-cdp/events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';

import { cdpFinished, cdpRedirect, cdpResponse, cdpStart, PAGE_SESSION, type TraceCtx } from './builders';
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
      cdpFinished(ctx, { timestamp: FULL_TIMING.requestTime + 0.25, encodedDataLength: 2048 }),
    ];
    for (const event of trace) source.emit(event);

    const lc = store.get(ctx.tabId, ctx.requestId);
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(onReject).not.toHaveBeenCalled();
    expect(lc.phase).toBe('completed');
    expect(lc.redirectHopCount).toBe(1);
    // Synthesized HAR landed in both hop slots, dense and non-null.
    expect(lc.har).toHaveLength(2);
    expect(lc.har[0]?.response?.status).toBe(301);
    expect(lc.har[1]?.response?.status).toBe(200);
    expect(lc.har[1]?.response?._transferSize).toBe(2048);
    expect(lc.har[1]?.timings?.receive).toBe(150);

    correlator.dispose();
  });
});

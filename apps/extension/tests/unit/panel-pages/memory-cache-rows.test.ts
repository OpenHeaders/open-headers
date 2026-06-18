/**
 * Memory-cache row synthesis — the panel-local reconciliation that turns
 * Resource Timing entries with no matching real row into synthetic
 * `(memory cache)` lifecycles. Pure: entries + real lifecycles in,
 * synthetic lifecycles out.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { COLUMN_DEFS } from '@openheaders/ui/panel/components/traffic/columns';
import { synthesizeMemoryCacheLifecycles } from '@openheaders/ui/panel/data/memory-cache-rows';
import { classifyRequestState } from '@openheaders/ui/panel/data/request-state';
import { getSizeInfo } from '@openheaders/ui/panel/data/size-info';
import { describe, expect, it } from 'vitest';

function entry(name: string, overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    startTime: 0,
    duration: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 0,
    ...overrides,
  };
}

function realLifecycle(url: string): RequestLifecycle {
  return {
    tabId: 1,
    requestId: `real-${url}`,
    url,
    method: 'GET',
    resourceType: 'script',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    completedAtMs: 1100,
    har: [],
    harBodyByHop: [],
  };
}

const TAB = 1;

describe('synthesizeMemoryCacheLifecycles', () => {
  it('returns nothing when the time origin is unknown', () => {
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry('https://openheaders.io/a.js')],
      timeOriginMs: null,
      realLifecycles: [],
      tabId: TAB,
    });
    expect(out).toEqual([]);
  });

  it('returns nothing for an empty buffer', () => {
    const out = synthesizeMemoryCacheLifecycles({
      entries: [],
      timeOriginMs: 1000,
      realLifecycles: [],
      tabId: TAB,
    });
    expect(out).toEqual([]);
  });

  it('does not synthesize when every RT entry has a matching real row', () => {
    const url = 'https://openheaders.io/app.js';
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry(url, { transferSize: 5000 })],
      timeOriginMs: 1000,
      realLifecycles: [realLifecycle(url)],
      tabId: TAB,
    });
    expect(out).toEqual([]);
  });

  it('synthesizes one memory-cache lifecycle for an RT entry with no real row', () => {
    const url = 'https://openheaders.io/cached.js';
    const out = synthesizeMemoryCacheLifecycles({
      entries: [
        entry(url, {
          initiatorType: 'img',
          startTime: 250,
          duration: 4,
          decodedBodySize: 2048,
          encodedBodySize: 900,
          nextHopProtocol: 'h2',
          deliveryType: 'cache',
        }),
      ],
      timeOriginMs: 1000,
      realLifecycles: [],
      tabId: TAB,
    });

    expect(out).toHaveLength(1);
    const lc = out[0];
    expect(lc.url).toBe(url);
    expect(lc.tabId).toBe(TAB);
    expect(lc.startedAtMs).toBe(1250);
    expect(lc.completedAtMs).toBe(1254);
    expect(lc.resourceType).toBe('image');
    expect(lc.statusCode).toBe(200);
    expect(lc.fromCache).toBe(true);
    expect(lc.requestId.startsWith('oh-mem:')).toBe(true);
    const har = lc.har[0];
    expect(har?._fromCache).toBe('memory');
    expect(har?.response?._transferSize).toBe(0);
    expect(har?.response?.content.size).toBe(2048);
  });

  it('subtracts real rows from the RT count per URL (fetched once, cached twice → 1 synthetic)', () => {
    const url = 'https://openheaders.io/icon.svg';
    const out = synthesizeMemoryCacheLifecycles({
      entries: [
        entry(url, { transferSize: 1200 }),
        entry(url, { transferSize: 0, deliveryType: 'cache', startTime: 50 }),
      ],
      timeOriginMs: 1000,
      realLifecycles: [realLifecycle(url)],
      tabId: TAB,
    });
    expect(out).toHaveLength(1);
    // The cache-shaped entry is the one synthesized, not the network fetch.
    expect(out[0].startedAtMs).toBe(1050);
  });

  it('does not synthesize a phantom for a redirected request (RT names the pre-redirect URL)', () => {
    // The page fetched `source`; a DNR query-param rule rewrote it to `final`
    // via a 307 internal redirect, so the one real lifecycle's `url` is `final`
    // while Resource Timing names the entry by `source`. Keying the dedup on
    // the chain root (the redirect's sourceUrl) must cancel the RT entry.
    const source = 'https://openheaders.io/echo?test=qp&run=1';
    const final = 'https://openheaders.io/echo?test=qp&run=1&added=yes';
    const real: RequestLifecycle = {
      ...realLifecycle(final),
      requestId: 'real-redir',
      redirectHopCount: 1,
      redirectHops: [{ sourceUrl: source, redirectUrl: final, statusCode: 307, timestampMs: 1000 }],
    };
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry(source, { transferSize: 1500 })],
      timeOriginMs: 1000,
      realLifecycles: [real],
      tabId: TAB,
    });
    expect(out).toEqual([]);
  });

  it('still synthesizes a genuine cache hit of a redirect source URL (surplus accounting holds)', () => {
    // Same source fetched twice: once redirected (real lifecycle, root = source),
    // once served from cache. RT has two entries named `source`; the redirected
    // lifecycle cancels one, leaving exactly one synthetic for the real hit.
    const source = 'https://openheaders.io/echo?test=qp&run=1';
    const final = 'https://openheaders.io/echo?test=qp&run=1&added=yes';
    const real: RequestLifecycle = {
      ...realLifecycle(final),
      requestId: 'real-redir',
      redirectHopCount: 1,
      redirectHops: [{ sourceUrl: source, redirectUrl: final, statusCode: 307, timestampMs: 1000 }],
    };
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry(source, { transferSize: 1500 }), entry(source, { deliveryType: 'cache', startTime: 50 })],
      timeOriginMs: 1000,
      realLifecycles: [real],
      tabId: TAB,
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe(source);
    expect(out[0].startedAtMs).toBe(1050);
  });

  it('assigns distinct requestIds when a URL is hit from cache more than once', () => {
    const url = 'https://openheaders.io/dup.png';
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry(url, { deliveryType: 'cache' }), entry(url, { deliveryType: 'cache', startTime: 10 })],
      timeOriginMs: 1000,
      realLifecycles: [],
      tabId: TAB,
    });
    expect(out).toHaveLength(2);
    expect(new Set(out.map((lc) => lc.requestId)).size).toBe(2);
  });

  it('produces a lifecycle the request-state classifier reads as a memory-cache hit', () => {
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry('https://openheaders.io/a.js', { decodedBodySize: 1000, deliveryType: 'cache' })],
      timeOriginMs: 1000,
      realLifecycles: [],
      tabId: TAB,
    });
    const state = classifyRequestState(out[0]);
    expect(state.kind).toBe('cached');
    if (state.kind !== 'cached') throw new Error('expected cached');
    expect(state.source).toBe('memory');
    // → the Size cell renders the `(memory cache)` label.
    expect(getSizeInfo(out[0], state)).toEqual({ kind: 'cached', source: 'memory' });
  });

  it('renders the Time column as "0 ms" for an instant cache hit (not blank)', () => {
    const out = synthesizeMemoryCacheLifecycles({
      entries: [entry('https://openheaders.io/a.js', { duration: 0, deliveryType: 'cache' })],
      timeOriginMs: 1000,
      realLifecycles: [],
      tabId: TAB,
    });
    const row = { lifecycle: out[0], displayId: 1, consolidatedRetryOf: [], fires: [] };
    expect(COLUMN_DEFS.time.extract(row)).toBe('0 ms');
  });
});

/**
 * `mainFrameRequestIdsMatchingCommit` — pure projection of a tab's
 * lifecycle snapshot + committed URL onto the set of main-frame
 * requestIds whose chain contains that URL. Replaces tab-telemetry's
 * deleted `mainFrameChains` reverse-lookup.
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { mainFrameRequestIdsMatchingCommit } from '@/background/tab-telemetry-source/main-frame-chain';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://openheaders.io/',
    method: 'GET',
    resourceType: 'main_frame',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

// Heuristic (webRequest) lifecycles are tagged `main_frame` and never
// consult the predicate; the CDP cases pass an explicit resolver.
const noCdpDocs = () => false;

describe('mainFrameRequestIdsMatchingCommit', () => {
  it('returns empty when no lifecycles match', () => {
    expect(mainFrameRequestIdsMatchingCommit([], 'https://openheaders.io/', noCdpDocs).size).toBe(0);
  });

  it('matches a single main-frame lifecycle by its final URL', () => {
    const lc = makeLifecycle({ requestId: 'mf-1', url: 'https://openheaders.io/page' });
    const matches = mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/page', noCdpDocs);
    expect([...matches]).toEqual(['mf-1']);
  });

  it('matches via any earlier hop in the redirect chain (sourceUrl)', () => {
    const lc = makeLifecycle({
      requestId: 'mf-1',
      url: 'https://openheaders.io/final',
      redirectHopCount: 2,
      redirectHops: [
        { sourceUrl: 'https://openheaders.io/start', redirectUrl: 'https://openheaders.io/middle', statusCode: 301, timestampMs: 1_100 },
        { sourceUrl: 'https://openheaders.io/middle', redirectUrl: 'https://openheaders.io/final', statusCode: 302, timestampMs: 1_200 },
      ],
    });
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/start', noCdpDocs)]).toEqual(['mf-1']);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/middle', noCdpDocs)]).toEqual(['mf-1']);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/final', noCdpDocs)]).toEqual(['mf-1']);
  });

  it('ignores non-main-frame lifecycles', () => {
    const xhr = makeLifecycle({ requestId: 'xhr-1', resourceType: 'xmlhttprequest', url: 'https://openheaders.io/api' });
    expect(mainFrameRequestIdsMatchingCommit([xhr], 'https://openheaders.io/api', noCdpDocs).size).toBe(0);
  });

  it('returns every matching main-frame requestId (multiple concurrent navs)', () => {
    const a = makeLifecycle({ requestId: 'mf-a', url: 'https://openheaders.io/shared' });
    const b = makeLifecycle({ requestId: 'mf-b', url: 'https://openheaders.io/shared' });
    const matches = mainFrameRequestIdsMatchingCommit([a, b], 'https://openheaders.io/shared', noCdpDocs);
    expect([...matches].sort()).toEqual(['mf-a', 'mf-b']);
  });

  it('normalizes the committed URL (fragments stripped) before matching', () => {
    const lc = makeLifecycle({ requestId: 'mf-1', url: 'https://openheaders.io/page' });
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/page#section', noCdpDocs)]).toEqual([
      'mf-1',
    ]);
  });

  it('returns empty when commit lands on an extension URL (transient intermediate)', () => {
    const lc = makeLifecycle({
      requestId: 'mf-1',
      url: 'chrome-extension://abc/delay.html',
      redirectHopCount: 1,
      redirectHops: [
        { sourceUrl: 'https://openheaders.io/start', redirectUrl: 'chrome-extension://abc/delay.html', statusCode: 302, timestampMs: 1_100 },
      ],
    });
    expect(mainFrameRequestIdsMatchingCommit([lc], 'chrome-extension://abc/delay.html', noCdpDocs).size).toBe(0);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/start', noCdpDocs)]).toEqual(['mf-1']);
  });

  // CDP-owned tabs tag navigations `document` (the same tag iframes carry);
  // the registry-backed predicate resolves the main-frame split, mirroring
  // how the rule-engine driver buffered the fire. Without this branch a
  // CDP-owned navigation loses its rule attribution (no blue row).
  it('matches a CDP main-frame document via the predicate', () => {
    const lc = makeLifecycle({
      requestId: 'cdp-1',
      resourceType: 'document',
      frameId: 'frame-main',
      url: 'https://openheaders.io/page',
    });
    const isMainFrameDoc = (l: RequestLifecycle) => l.frameId === 'frame-main';
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/page', isMainFrameDoc)]).toEqual([
      'cdp-1',
    ]);
  });

  it('ignores a CDP sub-frame document (predicate false)', () => {
    const iframe = makeLifecycle({
      requestId: 'cdp-iframe',
      resourceType: 'document',
      frameId: 'frame-child',
      url: 'https://openheaders.io/embed',
    });
    const isMainFrameDoc = (l: RequestLifecycle) => l.frameId === 'frame-main';
    expect(mainFrameRequestIdsMatchingCommit([iframe], 'https://openheaders.io/embed', isMainFrameDoc).size).toBe(0);
  });
});

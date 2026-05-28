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

describe('mainFrameRequestIdsMatchingCommit', () => {
  it('returns empty when no lifecycles match', () => {
    expect(mainFrameRequestIdsMatchingCommit([], 'https://openheaders.io/').size).toBe(0);
  });

  it('matches a single main-frame lifecycle by its final URL', () => {
    const lc = makeLifecycle({ requestId: 'mf-1', url: 'https://openheaders.io/page' });
    const matches = mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/page');
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
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/start')]).toEqual(['mf-1']);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/middle')]).toEqual(['mf-1']);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/final')]).toEqual(['mf-1']);
  });

  it('ignores non-main-frame lifecycles', () => {
    const xhr = makeLifecycle({ requestId: 'xhr-1', resourceType: 'xmlhttprequest', url: 'https://openheaders.io/api' });
    expect(mainFrameRequestIdsMatchingCommit([xhr], 'https://openheaders.io/api').size).toBe(0);
  });

  it('returns every matching main-frame requestId (multiple concurrent navs)', () => {
    const a = makeLifecycle({ requestId: 'mf-a', url: 'https://openheaders.io/shared' });
    const b = makeLifecycle({ requestId: 'mf-b', url: 'https://openheaders.io/shared' });
    const matches = mainFrameRequestIdsMatchingCommit([a, b], 'https://openheaders.io/shared');
    expect([...matches].sort()).toEqual(['mf-a', 'mf-b']);
  });

  it('normalizes the committed URL (fragments stripped) before matching', () => {
    const lc = makeLifecycle({ requestId: 'mf-1', url: 'https://openheaders.io/page' });
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/page#section')]).toEqual(['mf-1']);
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
    expect(mainFrameRequestIdsMatchingCommit([lc], 'chrome-extension://abc/delay.html').size).toBe(0);
    expect([...mainFrameRequestIdsMatchingCommit([lc], 'https://openheaders.io/start')]).toEqual(['mf-1']);
  });
});

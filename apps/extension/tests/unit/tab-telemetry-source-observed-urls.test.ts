/**
 * `deriveObservedUrls` — pure projection of a tab's lifecycle snapshot
 * onto the normalized URL set that test-runner's session-end static
 * arbitration consumes. Replaces tab-telemetry's deleted `observedUrls`
 * Set. Tested in isolation: feed in plain `RequestLifecycle[]`, assert
 * the derived set.
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { deriveObservedUrls } from '@/background/tab-telemetry-source/observed-urls';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
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

describe('deriveObservedUrls', () => {
  it('returns an empty set when given no lifecycles', () => {
    expect(deriveObservedUrls([]).size).toBe(0);
  });

  it('extracts the final URL of a non-redirected lifecycle', () => {
    const urls = deriveObservedUrls([makeLifecycle({ url: 'https://openheaders.io/x' })]);
    expect([...urls]).toEqual(['https://openheaders.io/x']);
  });

  it('extracts every URL across a redirect chain via sourceUrl + final url', () => {
    const lifecycle = makeLifecycle({
      url: 'https://openheaders.io/c',
      redirectHopCount: 2,
      redirectHops: [
        { sourceUrl: 'https://openheaders.io/a', redirectUrl: 'https://openheaders.io/b', statusCode: 301, timestampMs: 1_100 },
        { sourceUrl: 'https://openheaders.io/b', redirectUrl: 'https://openheaders.io/c', statusCode: 302, timestampMs: 1_200 },
      ],
    });
    const urls = deriveObservedUrls([lifecycle]);
    expect([...urls].sort()).toEqual([
      'https://openheaders.io/a',
      'https://openheaders.io/b',
      'https://openheaders.io/c',
    ]);
  });

  it('unions URLs across multiple lifecycles, deduping shared hops', () => {
    const a = makeLifecycle({ requestId: 'r1', url: 'https://openheaders.io/x' });
    const b = makeLifecycle({ requestId: 'r2', url: 'https://openheaders.io/x' });
    const c = makeLifecycle({ requestId: 'r3', url: 'https://openheaders.io/y' });
    expect([...deriveObservedUrls([a, b, c])].sort()).toEqual([
      'https://openheaders.io/x',
      'https://openheaders.io/y',
    ]);
  });

  it('filters non-trackable schemes (chrome://, chrome-extension://, etc.)', () => {
    const lifecycle = makeLifecycle({
      url: 'https://openheaders.io/end',
      redirectHopCount: 1,
      redirectHops: [
        { sourceUrl: 'chrome-extension://abc/delay.html', redirectUrl: 'https://openheaders.io/end', statusCode: 302, timestampMs: 1_100 },
      ],
    });
    const urls = deriveObservedUrls([lifecycle]);
    expect([...urls]).toEqual(['https://openheaders.io/end']);
  });

  it('normalizes URLs (strips fragments) to match DNR-tracking semantics', () => {
    const a = makeLifecycle({ requestId: 'r1', url: 'https://openheaders.io/page#section-1' });
    const b = makeLifecycle({ requestId: 'r2', url: 'https://openheaders.io/page#section-2' });
    expect([...deriveObservedUrls([a, b])]).toEqual(['https://openheaders.io/page']);
  });
});

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

export function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
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

/** A terminal HAR entry whose body text must NEVER survive retention. */
export function makeHarEntry(
  overrides: { size?: number; transferSize?: number; bodyText?: string } = {},
): InspectorHarEntry {
  return {
    startedDateTime: '2026-08-02T10:00:00.000Z',
    time: 42,
    request: {
      method: 'GET',
      url: 'https://api.openheaders.io/users',
      headers: [{ name: 'X-OH-Probe', value: 'har-request-header' }],
      queryString: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      content: {
        size: overrides.size ?? 512,
        mimeType: 'application/json',
        text: overrides.bodyText ?? 'OH-SECRET-BODY-MUST-NOT-BE-RETAINED',
      },
      _transferSize: overrides.transferSize ?? 640,
    },
  };
}

/** Padding value used to drive the ring's byte ceiling in tests. */
export function padding(bytes: number): string {
  return 'x'.repeat(bytes);
}

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { buildInitiatorIndex } from '@openheaders/ui/panel/data/initiator/initiator-index';
import { describe, expect, it } from 'vitest';

function harWithInitiator(url: string, initiatorUrl: string | null): InspectorHarEntry {
  return {
    startedDateTime: new Date(0).toISOString(),
    time: 0,
    request: {
      method: 'GET',
      url,
      httpVersion: '',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    ...(initiatorUrl ? { _initiator: { type: 'script', url: initiatorUrl } } : {}),
  } as InspectorHarEntry;
}

function lifecycle(requestId: string, url: string, initiatorUrl: string | null): RequestLifecycle {
  return {
    tabId: 1,
    requestId,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    har: [harWithInitiator(url, initiatorUrl)],
    harBodyByHop: [],
  };
}

describe('buildInitiatorIndex', () => {
  it('returns empty for empty input', () => {
    expect(buildInitiatorIndex([])).toEqual(new Map());
  });

  it('inverts initiator attribution into parent → children list', () => {
    const parent = 'https://openheaders.io/app.js';
    const idx = buildInitiatorIndex([
      lifecycle('a', 'https://openheaders.io/x', parent),
      lifecycle('b', 'https://openheaders.io/y', parent),
    ]);
    expect(idx.get(parent)).toEqual(['a', 'b']);
  });

  it('skips lifecycles missing hop 0 har', () => {
    const lc: RequestLifecycle = { ...lifecycle('a', 'https://openheaders.io/x', null), har: [] };
    expect(buildInitiatorIndex([lc])).toEqual(new Map());
  });

  it('skips self-loops (initiator URL == own URL)', () => {
    const url = 'https://openheaders.io/x';
    expect(buildInitiatorIndex([lifecycle('a', url, url)])).toEqual(new Map());
  });

  it('skips entries with no initiator', () => {
    expect(buildInitiatorIndex([lifecycle('a', 'https://openheaders.io/x', null)])).toEqual(new Map());
  });
});

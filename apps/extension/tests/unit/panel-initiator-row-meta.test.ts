import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeInitiatorRowMeta } from '@openheaders/ui/panel/data/initiator-row-meta';
import { describe, expect, it } from 'vitest';

let _seq = 0;
function lifecycle(
  url: string,
  opts: {
    bodySize?: number;
    duration?: number;
    status?: number;
    resourceType?: string;
    initiatorType?: string;
  } = {},
): RequestLifecycle {
  const startedAtMs = ++_seq * 100;
  const har: InspectorHarEntry = {
    startedDateTime: new Date(startedAtMs).toISOString(),
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: {
      status: opts.status ?? 200,
      statusText: 'OK',
      headers: [],
      bodySize: opts.bodySize ?? 0,
      content: { size: 0, mimeType: 'text/plain' },
    },
    ...(opts.initiatorType ? { _initiator: { type: opts.initiatorType } } : {}),
  } as InspectorHarEntry;
  return {
    tabId: 1,
    requestId: `r-${_seq}`,
    url,
    method: 'GET',
    resourceType: opts.resourceType ?? '',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    ...(opts.duration != null ? { completedAtMs: startedAtMs + opts.duration } : {}),
    statusCode: opts.status ?? 200,
    har: [har],
    harBodyByHop: [],
  };
}

describe('computeInitiatorRowMeta', () => {
  it('extracts resource type lowercased', () => {
    const m = computeInitiatorRowMeta(lifecycle('https://openheaders.io/a', { resourceType: 'Script' }), null);
    expect(m.resourceType).toBe('script');
  });

  it('normalizes initiator type (xmlhttprequest → xhr)', () => {
    const m = computeInitiatorRowMeta(
      lifecycle('https://openheaders.io/a', { initiatorType: 'xmlhttprequest' }),
      null,
    );
    expect(m.initiatorType).toBe('xhr');
  });

  it('passes through known initiator types', () => {
    expect(computeInitiatorRowMeta(lifecycle('https://openheaders.io/a', { initiatorType: 'parser' }), null).initiatorType).toBe(
      'parser',
    );
    expect(computeInitiatorRowMeta(lifecycle('https://openheaders.io/b', { initiatorType: 'preload' }), null).initiatorType).toBe(
      'preload',
    );
    expect(
      computeInitiatorRowMeta(lifecycle('https://openheaders.io/c', { initiatorType: 'redirect' }), null).initiatorType,
    ).toBe('redirect');
  });

  it('falls back to "other" for unknown initiator types', () => {
    expect(
      computeInitiatorRowMeta(lifecycle('https://openheaders.io/d', { initiatorType: 'magic' }), null).initiatorType,
    ).toBe('other');
  });

  it('marks third-party when origin differs from pageOrigin', () => {
    expect(
      computeInitiatorRowMeta(lifecycle('https://cdn.example.com/a'), 'https://openheaders.io').isThirdParty,
    ).toBe(true);
    expect(
      computeInitiatorRowMeta(lifecycle('https://openheaders.io/a'), 'https://openheaders.io').isThirdParty,
    ).toBe(false);
  });

  it('treats requests as same-origin when pageOrigin is unknown', () => {
    expect(computeInitiatorRowMeta(lifecycle('https://cdn.example.com/a'), null).isThirdParty).toBe(false);
  });

  it('flags failure for 4xx/5xx statuses', () => {
    expect(computeInitiatorRowMeta(lifecycle('https://openheaders.io/x', { status: 500 }), null).isFailed).toBe(true);
    expect(computeInitiatorRowMeta(lifecycle('https://openheaders.io/x', { status: 200 }), null).isFailed).toBe(false);
  });

  it('picks bodySize when available', () => {
    const m = computeInitiatorRowMeta(lifecycle('https://openheaders.io/a', { bodySize: 4096 }), null);
    expect(m.sizeBytes).toBe(4096);
  });

  it('derives duration from completedAtMs - startedAtMs', () => {
    const m = computeInitiatorRowMeta(lifecycle('https://openheaders.io/x', { duration: 250 }), null);
    expect(m.durationMs).toBe(250);
  });
});

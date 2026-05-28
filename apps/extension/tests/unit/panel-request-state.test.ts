import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { classifyRequestState, isErrorState, statusText } from '@openheaders/ui/panel/data/request-state';
import { describe, expect, it } from 'vitest';

function makeLifecycle(
  opts: Omit<Partial<RequestLifecycle>, 'har'> & { har?: Partial<InspectorHarEntry> } = {},
): RequestLifecycle {
  const url = opts.url ?? 'https://api.openheaders.io/x';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-17T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    ...(opts.har ?? {}),
  } as InspectorHarEntry;
  const { har: _ignored, ...rest } = opts;
  return {
    tabId: 1,
    requestId: 'req-1',
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 200,
    statusText: 'OK',
    har: [har],
    harBodyByHop: [],
    ...rest,
  };
}

describe('classifyRequestState', () => {
  it('pending when no response is observed yet', () => {
    const lc = makeLifecycle({
      phase: 'pending',
      statusCode: undefined,
      statusText: undefined,
      har: { response: undefined },
    });
    expect(classifyRequestState(lc).kind).toBe('pending');
  });

  it('blocked when status code is 0 and text says blocked', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_BLOCKED_BY_CLIENT' });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('blocked');
    if (s.kind === 'blocked') expect(s.reason).toContain('BLOCKED');
  });

  it('failed when status code is 0 and the text is a non-blocked net error', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_NAME_NOT_RESOLVED' });
    expect(classifyRequestState(lc).kind).toBe('failed');
  });

  it('failed for TLS / cert errors with status code 0', () => {
    const lc = makeLifecycle({ statusCode: 0, statusText: 'net::ERR_CERT_AUTHORITY_INVALID' });
    expect(classifyRequestState(lc).kind).toBe('failed');
  });

  it('cached (disk) when har._fromCache is "disk"', () => {
    const lc = makeLifecycle({
      har: {
        _fromCache: 'disk',
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('disk');
  });

  it('cached (memory) when har._servedFromCache is true without _fromCache', () => {
    const lc = makeLifecycle({
      har: {
        _servedFromCache: true,
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('memory');
  });

  it('cached (service-worker) when har._fetchedViaServiceWorker is true — even over other cache flags', () => {
    const lc = makeLifecycle({
      har: {
        _fetchedViaServiceWorker: true,
        _fromCache: 'disk',
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('service-worker');
  });

  it('cached (memory) when lifecycle.fromCache is true without HAR cache flags', () => {
    const lc = makeLifecycle({ fromCache: true });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('memory');
  });

  it('redirect when status is 3xx with a redirectURL', () => {
    const lc = makeLifecycle({
      statusCode: 302,
      statusText: 'Found',
      har: {
        response: {
          status: 302,
          statusText: 'Found',
          redirectURL: 'https://elsewhere.example/',
          headers: [],
          content: { size: 0, mimeType: '' },
        },
      },
    });
    const s = classifyRequestState(lc);
    expect(s.kind).toBe('redirect');
    if (s.kind === 'redirect') {
      expect(s.status).toBe(302);
      expect(s.location).toBe('https://elsewhere.example/');
    }
  });

  it('success for a plain 200', () => {
    const s = classifyRequestState(makeLifecycle());
    expect(s.kind).toBe('success');
    if (s.kind === 'success') expect(s.status).toBe(200);
  });

  it('blocked precedence: blocked beats cached', () => {
    const lc = makeLifecycle({
      statusCode: 0,
      statusText: 'net::ERR_BLOCKED_BY_CLIENT',
      har: { _fromCache: 'disk', response: undefined },
    });
    expect(classifyRequestState(lc).kind).toBe('blocked');
  });

  it('isErrorState true for blocked + failed + httpError, false otherwise', () => {
    expect(isErrorState({ kind: 'blocked', reason: '' })).toBe(true);
    expect(isErrorState({ kind: 'failed', reason: '' })).toBe(true);
    expect(isErrorState({ kind: 'httpError', status: 500 })).toBe(true);
    expect(isErrorState({ kind: 'pending' })).toBe(false);
    expect(isErrorState({ kind: 'success', status: 200 })).toBe(false);
    expect(isErrorState({ kind: 'cached', source: 'disk', status: 200 })).toBe(false);
  });

  it('statusText surfaces the right string for each state', () => {
    expect(statusText({ kind: 'pending' }, makeLifecycle())).toBe('(pending)');
    expect(
      statusText(
        { kind: 'blocked', reason: 'net::ERR_BLOCKED' },
        makeLifecycle({ statusText: 'net::ERR_BLOCKED' }),
      ),
    ).toBe('(net::ERR_BLOCKED)');
    expect(
      statusText({ kind: 'failed', reason: 'net::ERR_FAILED' }, makeLifecycle({ statusText: 'net::ERR_FAILED' })),
    ).toBe('(net::ERR_FAILED)');
    expect(statusText({ kind: 'success', status: 200 }, makeLifecycle())).toBe('200');
    expect(statusText({ kind: 'redirect', status: 302, location: null }, makeLifecycle())).toBe('302');
    expect(statusText({ kind: 'cached', source: 'disk', status: 200 }, makeLifecycle())).toBe('200');
  });
});

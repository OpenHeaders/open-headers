import { classifyRequestState, isErrorState, statusText } from '@openheaders/ui/panel/data/request-state';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

function entry(opts: Partial<InspectorRequest> & { har?: Partial<InspectorHarEntry> } = {}): InspectorRequest {
  const url = opts.url ?? 'https://api.openheaders.io/x';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-17T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    ...(opts.har ?? {}),
  };
  return {
    id: url,
    harEntry: har,
    method: 'GET',
    url,
    timestamp: 0,
    statusCode: 200,
    statusText: 'OK',
    fires: [],
    arrivalIndex: 0,
    displayId: 1,
    ...opts,
  };
}

describe('classifyRequestState', () => {
  it('pending when no response is observed yet', () => {
    // No response field on HAR; no statusCode on the request.
    const e = entry({ statusCode: undefined, statusText: undefined, har: { response: undefined } });
    expect(classifyRequestState(e).kind).toBe('pending');
  });

  it('blocked when status code is 0 and text says blocked', () => {
    const e = entry({ statusCode: 0, statusText: 'net::ERR_BLOCKED_BY_CLIENT' });
    const s = classifyRequestState(e);
    expect(s.kind).toBe('blocked');
    if (s.kind === 'blocked') expect(s.reason).toContain('BLOCKED');
  });

  it('failed when status code is 0 and the text is a non-blocked net error', () => {
    const e = entry({ statusCode: 0, statusText: 'net::ERR_NAME_NOT_RESOLVED' });
    const s = classifyRequestState(e);
    expect(s.kind).toBe('failed');
  });

  it('failed for TLS / cert errors with status code 0', () => {
    const e = entry({ statusCode: 0, statusText: 'net::ERR_CERT_AUTHORITY_INVALID' });
    expect(classifyRequestState(e).kind).toBe('failed');
  });

  it('cached (disk) when _fromCache is "disk"', () => {
    const e = entry({
      har: {
        _fromCache: 'disk',
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(e);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('disk');
  });

  it('cached (memory) when _servedFromCache is true without _fromCache', () => {
    const e = entry({
      har: {
        _servedFromCache: true,
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(e);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('memory');
  });

  it('cached (service-worker) when _fetchedViaServiceWorker is true — even over other cache flags', () => {
    const e = entry({
      har: {
        _fetchedViaServiceWorker: true,
        _fromCache: 'disk',
        response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      },
    });
    const s = classifyRequestState(e);
    expect(s.kind).toBe('cached');
    if (s.kind === 'cached') expect(s.source).toBe('service-worker');
  });

  it('redirect when status is 3xx with a redirectURL', () => {
    const e = entry({
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
    const s = classifyRequestState(e);
    expect(s.kind).toBe('redirect');
    if (s.kind === 'redirect') {
      expect(s.status).toBe(302);
      expect(s.location).toBe('https://elsewhere.example/');
    }
  });

  it('success for a plain 200', () => {
    const s = classifyRequestState(entry());
    expect(s.kind).toBe('success');
    if (s.kind === 'success') expect(s.status).toBe(200);
  });

  it('blocked precedence: blocked beats cached', () => {
    const e = entry({
      statusCode: 0,
      statusText: 'net::ERR_BLOCKED_BY_CLIENT',
      har: { _fromCache: 'disk', response: undefined },
    });
    expect(classifyRequestState(e).kind).toBe('blocked');
  });

  it('isErrorState true for blocked + failed, false otherwise', () => {
    expect(isErrorState({ kind: 'blocked', reason: '' })).toBe(true);
    expect(isErrorState({ kind: 'failed', reason: '' })).toBe(true);
    expect(isErrorState({ kind: 'pending' })).toBe(false);
    expect(isErrorState({ kind: 'success', status: 200 })).toBe(false);
    expect(isErrorState({ kind: 'cached', source: 'disk', status: 200 })).toBe(false);
  });

  it('statusText surfaces the right string for each state', () => {
    expect(statusText({ kind: 'pending' }, entry())).toBe('(pending)');
    expect(statusText({ kind: 'blocked', reason: 'net::ERR_BLOCKED' }, entry({ statusText: 'net::ERR_BLOCKED' }))).toBe(
      '(net::ERR_BLOCKED)',
    );
    expect(statusText({ kind: 'failed', reason: 'net::ERR_FAILED' }, entry({ statusText: 'net::ERR_FAILED' }))).toBe(
      '(net::ERR_FAILED)',
    );
    expect(statusText({ kind: 'success', status: 200 }, entry())).toBe('200');
    expect(statusText({ kind: 'redirect', status: 302, location: null }, entry())).toBe('302');
    expect(statusText({ kind: 'cached', source: 'disk', status: 200 }, entry())).toBe('200');
  });
});

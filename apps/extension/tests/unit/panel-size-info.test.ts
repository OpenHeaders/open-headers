import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import type { RequestState } from '@openheaders/ui/panel/data/request-state';
import { formatSizeInfo, getSizeInfo, sortValueOf } from '@openheaders/ui/panel/data/size-info';
import { describe, expect, it } from 'vitest';

function makeLifecycle(harOverrides: Partial<InspectorHarEntry> = {}): RequestLifecycle {
  const url = 'https://api.openheaders.io/x';
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-17T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    ...harOverrides,
  } as InspectorHarEntry;
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
    har: new Map([[0, har]]),
    harBodyByHop: new Map(),
  };
}

const S200: RequestState = { kind: 'success', status: 200 };
const PENDING: RequestState = { kind: 'pending' };

describe('getSizeInfo', () => {
  it('pending state produces a pending SizeInfo', () => {
    expect(getSizeInfo(makeLifecycle(), PENDING)).toEqual({ kind: 'pending' });
  });

  it('cached state forwards the cache source', () => {
    const state: RequestState = { kind: 'cached', source: 'service-worker', status: 200 };
    expect(getSizeInfo(makeLifecycle(), state)).toEqual({ kind: 'cached', source: 'service-worker' });
  });

  it('extracts transferred (bodySize) and resource (content.size) from HAR', () => {
    const lc = makeLifecycle({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [],
        bodySize: 4200,
        content: { size: 12000, mimeType: 'text/css' },
      },
    });
    expect(getSizeInfo(lc, S200)).toEqual({ kind: 'bytes', transferred: 4200, resource: 12000 });
  });

  it('returns null when HAR bodySize is missing or -1', () => {
    const lc = makeLifecycle({
      response: { status: 200, statusText: 'OK', headers: [], bodySize: -1, content: { size: 4200, mimeType: '' } },
    });
    expect(getSizeInfo(lc, S200)).toEqual({ kind: 'bytes', transferred: null, resource: 4200 });
  });

  it('returns null for both values when nothing is known', () => {
    const lc = makeLifecycle({
      response: { status: 200, statusText: 'OK', headers: [], content: { size: -1, mimeType: '' } },
    });
    expect(getSizeInfo(lc, S200)).toEqual({ kind: 'bytes', transferred: null, resource: null });
  });
});

describe('formatSizeInfo', () => {
  it('pending', () => {
    expect(formatSizeInfo({ kind: 'pending' })).toBe('Pending');
  });

  it.each([
    ['disk', '(disk cache)'],
    ['memory', '(memory cache)'],
    ['service-worker', '(ServiceWorker)'],
  ] as const)('cached %s → %s', (source, label) => {
    expect(formatSizeInfo({ kind: 'cached', source })).toBe(label);
  });

  it('shows both transferred and resource when compressed', () => {
    expect(formatSizeInfo({ kind: 'bytes', transferred: 4200, resource: 12000 })).toBe('4.1 kB / 11.7 kB');
  });

  it('shows a single size when transferred equals resource', () => {
    expect(formatSizeInfo({ kind: 'bytes', transferred: 4200, resource: 4200 })).toBe('4.1 kB');
  });

  it('falls back to whichever number is known', () => {
    expect(formatSizeInfo({ kind: 'bytes', transferred: 1024, resource: null })).toBe('1.0 kB');
    expect(formatSizeInfo({ kind: 'bytes', transferred: null, resource: 2048 })).toBe('2.0 kB');
  });

  it('empty string when both are null', () => {
    expect(formatSizeInfo({ kind: 'bytes', transferred: null, resource: null })).toBe('');
  });
});

describe('sortValueOf', () => {
  it('prefers transferred, then resource, then -1', () => {
    expect(sortValueOf({ kind: 'bytes', transferred: 4200, resource: 12000 })).toBe(4200);
    expect(sortValueOf({ kind: 'bytes', transferred: null, resource: 12000 })).toBe(12000);
    expect(sortValueOf({ kind: 'bytes', transferred: null, resource: null })).toBe(-1);
    expect(sortValueOf({ kind: 'pending' })).toBe(-1);
    expect(sortValueOf({ kind: 'cached', source: 'disk' })).toBe(-1);
  });
});

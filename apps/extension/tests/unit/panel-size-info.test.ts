import type { RequestState } from '@openheaders/ui/panel/data/request-state';
import { formatSizeInfo, getSizeInfo, sortValueOf } from '@openheaders/ui/panel/data/size-info';
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
    fires: [],
    arrivalIndex: 0,
    displayId: 1,
    ...opts,
  };
}

const S200: RequestState = { kind: 'success', status: 200 };
const PENDING: RequestState = { kind: 'pending' };

describe('getSizeInfo', () => {
  it('pending state produces a pending SizeInfo', () => {
    expect(getSizeInfo(entry(), PENDING)).toEqual({ kind: 'pending' });
  });

  it('cached state forwards the cache source', () => {
    const state: RequestState = { kind: 'cached', source: 'service-worker', status: 200 };
    expect(getSizeInfo(entry(), state)).toEqual({ kind: 'cached', source: 'service-worker' });
  });

  it('extracts transferred (bodySize) and resource (content.size) from HAR', () => {
    const e = entry({
      har: {
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          bodySize: 4200,
          content: { size: 12000, mimeType: 'text/css' },
        },
      },
    });
    expect(getSizeInfo(e, S200)).toEqual({ kind: 'bytes', transferred: 4200, resource: 12000 });
  });

  it('falls back to entry.responseSize when HAR bodySize is missing or -1', () => {
    const e = entry({
      responseSize: 4200,
      har: {
        response: { status: 200, statusText: 'OK', headers: [], bodySize: -1, content: { size: 4200, mimeType: '' } },
      },
    });
    expect(getSizeInfo(e, S200)).toEqual({ kind: 'bytes', transferred: 4200, resource: 4200 });
  });

  it('returns null for both values when nothing is known', () => {
    const e = entry({
      responseSize: undefined,
      har: { response: { status: 200, statusText: 'OK', headers: [], content: { size: -1, mimeType: '' } } },
    });
    expect(getSizeInfo(e, S200)).toEqual({ kind: 'bytes', transferred: null, resource: null });
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

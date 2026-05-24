import type { InspectorHarEntry, InspectorRequestError } from '@openheaders/core/types';
import { InspectorStore } from '@openheaders/ui/panel/data/inspector-store';
import { isErrorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

function makeError(overrides: Partial<InspectorRequestError> = {}): InspectorRequestError {
  return {
    requestId: 'req-1',
    url: 'https://blocked.openheaders.io/ad.js',
    method: 'GET',
    resourceType: 'script',
    timestamp: '2026-05-24T10:00:00.000Z',
    error: 'net::ERR_BLOCKED_BY_CLIENT',
    fromCache: false,
    ...overrides,
  };
}

function makeHar(url: string, startedDateTime = '2026-05-24T10:00:01.000Z'): InspectorHarEntry {
  return {
    startedDateTime,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  };
}

describe('InspectorStore.ingestRequestError', () => {
  it('appends a synthetic error row with reason looked up from the code', () => {
    const store = new InspectorStore();
    store.ingestRequestError(makeError());
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    const row = entries[0];
    expect(isErrorRequest(row)).toBe(true);
    expect(row.url).toBe('https://blocked.openheaders.io/ad.js');
    expect(row.statusCode).toBe(0);
    expect(row.error?.code).toBe('net::ERR_BLOCKED_BY_CLIENT');
    expect(row.error?.reason).toBe('blocked');
  });

  it('tags the error row with the current pageref', () => {
    const store = new InspectorStore();
    store.onNavigated('https://openheaders.io/');
    store.ingestRequestError(makeError());
    const { entries, pages } = store.getSnapshot();
    expect(pages).toHaveLength(1);
    expect(entries[0].pageref).toBe(pages[0].id);
  });

  it('drops an error when a HAR row already exists for the same requestId', () => {
    const store = new InspectorStore();
    store.ingestHarEntry(makeHar('https://api.openheaders.io/a'), 'req-1');
    store.ingestRequestError(makeError({ requestId: 'req-1' }));
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(isErrorRequest(entries[0])).toBe(false);
  });

  it('synthesizes a Firefox NS_ERROR_* code into the failed bucket', () => {
    const store = new InspectorStore();
    store.ingestRequestError(makeError({ error: 'NS_ERROR_NET_RESET' }));
    const { entries } = store.getSnapshot();
    expect(entries[0].error?.reason).toBe('failed');
  });
});

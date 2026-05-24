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

  it('consolidates retries of the same (method, url) onto one row', () => {
    const store = new InspectorStore();
    // First attempt: Chrome's net stack reports a generic failure.
    store.ingestRequestError(
      makeError({
        requestId: 'req-1',
        timestamp: '2026-05-24T10:00:00.000Z',
        error: 'net::ERR_FAILED',
      }),
    );
    // Retry on a NEW requestId roughly 300ms later: now blocked by the
    // ad blocker. Chrome's UI consolidates these to one row — so should we.
    store.ingestRequestError(
      makeError({
        requestId: 'req-2',
        timestamp: '2026-05-24T10:00:00.300Z',
        error: 'net::ERR_BLOCKED_BY_CLIENT',
      }),
    );
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    // Latest attempt wins — `(blocked)` supersedes `(failed)`.
    expect(entries[0].error?.code).toBe('net::ERR_BLOCKED_BY_CLIENT');
    expect(entries[0].error?.reason).toBe('blocked');
    // Display position is stable across the supersession.
    expect(entries[0].displayId).toBe(1);
  });

  it('treats errors outside the dedup window as separate rows', () => {
    const store = new InspectorStore();
    store.ingestRequestError(
      makeError({ requestId: 'req-1', timestamp: '2026-05-24T10:00:00.000Z' }),
    );
    store.ingestRequestError(
      makeError({
        requestId: 'req-2',
        timestamp: '2026-05-24T10:00:30.000Z',
        error: 'net::ERR_BLOCKED_BY_CLIENT',
      }),
    );
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(2);
  });

  it('keeps two HAR entries that share startedDateTime but have distinct requestIds', () => {
    // Real Chrome HAR exports occasionally contain two genuine
    // concurrent fetches that start within the same millisecond
    // (observed on price-api.crypto.com polling). Both rows must
    // survive the replay-dedup; their unique `id`s keep React keys
    // stable.
    const store = new InspectorStore();
    const url = 'https://price-api.crypto.com/meta/v2/all-tokens';
    const startedDateTime = '2026-05-24T21:04:54.656Z';
    store.ingestHarEntry(makeHar(url, startedDateTime), 'req-a');
    store.ingestHarEntry(makeHar(url, startedDateTime), 'req-b');
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[0].chromeRequestId).toBe('req-a');
    expect(entries[1].chromeRequestId).toBe('req-b');
  });

  it('still dedupes true replays (same requestId, same key) on flush', () => {
    const store = new InspectorStore();
    const har = makeHar('https://api.openheaders.io/a', '2026-05-24T10:00:00.000Z');
    store.ingestHarEntry(har, 'req-1');
    // Simulate the port flush replaying the same entry.
    store.ingestHarEntry(har, 'req-1');
    expect(store.getSnapshot().entries).toHaveLength(1);
  });

  it('supersedes an existing error row when a HAR arrives for the same requestId', () => {
    const store = new InspectorStore();
    store.ingestRequestError(makeError({ requestId: 'req-1' }));
    // Now the HAR pipeline emits a complete entry for the same request.
    store.ingestHarEntry(makeHar('https://blocked.openheaders.io/ad.js'), 'req-1');
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0].error).toBeUndefined();
    expect(entries[0].statusCode).toBe(200);
    expect(entries[0].displayId).toBe(1);
  });
});

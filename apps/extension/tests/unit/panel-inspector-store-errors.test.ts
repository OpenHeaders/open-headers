import type {
  InspectorHarEntry,
  InspectorRequestCompleted,
  InspectorRequestError,
  InspectorRequestStarted,
} from '@openheaders/core/types';
import { InspectorStore } from '@openheaders/ui/panel/data/inspector-store';
import { isErrorRequest, isPendingRequest } from '@openheaders/ui/panel/data/types';
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

function makeStart(overrides: Partial<InspectorRequestStarted> = {}): InspectorRequestStarted {
  return {
    requestId: 'req-1',
    url: 'https://api.openheaders.io/data',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    timestamp: '2026-05-24T10:00:00.000Z',
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

describe('InspectorStore pending lifecycle', () => {
  it('mints a pending row from a request-started event', () => {
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart());
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(isPendingRequest(entries[0])).toBe(true);
    expect(entries[0].chromeRequestId).toBe('req-1');
    expect(entries[0].statusCode).toBeUndefined();
  });

  it('supersedes a pending row in place when its HAR arrives', () => {
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-9' }));
    store.ingestHarEntry(makeHar('https://api.openheaders.io/data'), 'req-9');
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(isPendingRequest(entries[0])).toBe(false);
    expect(entries[0].statusCode).toBe(200);
    // Display position preserved across supersession.
    expect(entries[0].displayId).toBe(1);
  });

  it('supersedes a pending row in place when an error arrives', () => {
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-9' }));
    store.ingestRequestError(
      makeError({ requestId: 'req-9', url: 'https://api.openheaders.io/data' }),
    );
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(isPendingRequest(entries[0])).toBe(false);
    expect(isErrorRequest(entries[0])).toBe(true);
    expect(entries[0].displayId).toBe(1);
  });

  it('promotes still-pending rows to "(unknown)" on the next navigation', () => {
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-a' }));
    store.ingestRequestStarted(
      makeStart({ requestId: 'req-b', url: 'https://api.openheaders.io/other' }),
    );
    store.onNavigated('https://openheaders.io/page2');
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(2);
    for (const e of entries) {
      expect(isPendingRequest(e)).toBe(false);
      expect(isErrorRequest(e)).toBe(true);
      expect(e.error?.reason).toBe('unknown');
      expect(e.error?.code).toBe('oh:abandoned');
    }
  });

  it('upgrades a nav-promoted (unknown) row in place when the real error code arrives late', () => {
    // Real-world ordering: user navigates while subresources are in
    // flight. The `nav` message arrives first and flips pending rows
    // to `(unknown)`; the corresponding `onErrorOccurred` events
    // (typically `net::ERR_ABORTED`) arrive a beat later. We must
    // upgrade the existing row in place — without this, the row goes
    // (unknown) AND a duplicate `(canceled)` row appears at a later
    // displayId, after the new page's nav row.
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-x', timestamp: '2026-05-25T00:00:00.000Z' }));
    const beforeNav = store.getSnapshot().entries[0];
    store.onNavigated('https://example.org/');
    // Pending row is now (unknown).
    expect(store.getSnapshot().entries[0].error?.code).toBe('oh:abandoned');
    // Now the late error arrives.
    store.ingestRequestError(
      makeError({
        requestId: 'req-x',
        error: 'net::ERR_ABORTED',
        timestamp: '2026-05-25T00:00:01.000Z',
      }),
    );
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0].error?.code).toBe('net::ERR_ABORTED');
    expect(entries[0].error?.reason).toBe('canceled');
    // Display position preserved.
    expect(entries[0].displayId).toBe(beforeNav.displayId);
    // Timestamp preserved (request-start, not error event time) so the
    // row sorts before any post-nav activity.
    expect(entries[0].timestamp).toBe(beforeNav.timestamp);
  });

  it('promotes pending rows to (unknown) on nav even if onCompleted set a statusCode', () => {
    // Real-world: page's polling JS fires a request that the network
    // stack completes (onCompleted returns 200) BUT the devtools HAR
    // pipeline never resolves it — the page was being unloaded. Chrome
    // labels this `(unknown)`; we must too, because without a HAR
    // there's no response body to render (Preview shows an infinite
    // skeleton) — showing 200 misleads the user.
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-poll' }));
    store.ingestRequestCompleted({
      requestId: 'req-poll',
      url: 'https://api.openheaders.io/data',
      method: 'GET',
      resourceType: 'xmlhttprequest',
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      timestamp: '2026-05-25T00:00:00.500Z',
      fromCache: false,
    });
    // Row currently shows 200 (synthetic, pending: true).
    expect(store.getSnapshot().entries[0].statusCode).toBe(200);
    // User navigates away — the response was never delivered to the page.
    store.onNavigated('https://example.org/');
    const { entries } = store.getSnapshot();
    expect(entries[0].statusCode).toBe(0);
    expect(entries[0].error?.reason).toBe('unknown');
    expect(isPendingRequest(entries[0])).toBe(false);
  });

  it('drops the start event when a HAR already exists for the requestId', () => {
    const store = new InspectorStore();
    store.ingestHarEntry(makeHar('https://api.openheaders.io/data'), 'req-1');
    store.ingestRequestStarted(makeStart({ requestId: 'req-1' }));
    expect(store.getSnapshot().entries).toHaveLength(1);
  });

  it('resolves a stale pending row via webRequest.onCompleted when no HAR arrives', () => {
    // Real-world scenario: lazy-loaded modulepreload chunk that
    // chrome.devtools.network.onRequestFinished silently drops, but
    // webRequest.onCompleted still fires for. The row stays in the
    // panel with its real status code instead of being permanently
    // stuck on "(pending)".
    const store = new InspectorStore();
    store.ingestRequestStarted(makeStart({ requestId: 'req-lazy' }));
    const completed: InspectorRequestCompleted = {
      requestId: 'req-lazy',
      url: 'https://api.openheaders.io/data',
      method: 'GET',
      resourceType: 'xmlhttprequest',
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      timestamp: '2026-05-24T10:00:01.000Z',
      fromCache: false,
    };
    store.ingestRequestCompleted(completed);
    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(isPendingRequest(entries[0])).toBe(false);
    expect(entries[0].statusCode).toBe(200);
    expect(entries[0].statusText).toBe('OK');
    expect(entries[0].displayId).toBe(1);
  });

  it('ignores onCompleted when the row already has a real HAR', () => {
    const store = new InspectorStore();
    store.ingestHarEntry(makeHar('https://api.openheaders.io/data'), 'req-x');
    const before = store.getSnapshot().entries[0];
    store.ingestRequestCompleted({
      requestId: 'req-x',
      url: 'https://api.openheaders.io/data',
      method: 'GET',
      resourceType: 'xmlhttprequest',
      statusCode: 500,
      statusLine: 'HTTP/1.1 500 Internal Server Error',
      timestamp: '2026-05-24T10:00:02.000Z',
      fromCache: false,
    });
    // Status from the real HAR (200) is preserved — the secondary
    // signal must not overwrite authoritative data.
    expect(store.getSnapshot().entries[0]).toBe(before);
  });
});

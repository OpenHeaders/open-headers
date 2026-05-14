import { DEFAULT_FILTER_CONFIG } from '@openheaders/ui/panel/data/filter-engine';
import { SearchClient } from '@openheaders/ui/panel/data/search-client';
import type { SearchGroup, SearchProgress } from '@openheaders/ui/panel/data/search-engine';
import { createInlineTransport, type SearchTransport } from '@openheaders/ui/panel/data/search-transport';
import type { MainToWorker, WorkerToMain } from '@openheaders/ui/panel/data/search-worker-protocol';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

/** Fake transport with a `fireError()` trigger for crash-recovery tests. */
function fakeCrashableTransport(): SearchTransport & { fireError(): void } {
  const messageListeners = new Set<(msg: WorkerToMain) => void>();
  const errorListeners = new Set<(err: Error) => void>();
  const sent: MainToWorker[] = [];
  return {
    send: (msg) => {
      sent.push(msg);
    },
    onMessage: (fn) => {
      messageListeners.add(fn);
      return () => messageListeners.delete(fn);
    },
    onError: (fn) => {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn);
    },
    terminate: () => {
      messageListeners.clear();
      errorListeners.clear();
    },
    fireError() {
      for (const fn of errorListeners) fn(new Error('simulated worker crash'));
    },
  };
}

function makeRequest(id: string, responseBody: string, displayId = 1): InspectorRequest {
  const url = `https://api.openheaders.io/${id}`;
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'application/json' } },
  };
  return {
    id,
    harEntry: har,
    method: 'GET',
    url,
    timestamp: 0,
    statusCode: 200,
    responseBody,
    fires: [],
    arrivalIndex: 0,
    displayId,
  };
}

async function drain() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

interface Collected {
  groups: SearchGroup[];
  progressLast: SearchProgress | null;
  done: SearchProgress | null;
}

function collector(): { cbs: Parameters<SearchClient['submit']>[3]; out: Collected } {
  const out: Collected = { groups: [], progressLast: null, done: null };
  return {
    out,
    cbs: {
      onGroup: (g) => out.groups.push(g),
      onProgress: (p) => {
        out.progressLast = p;
      },
      onDone: (p) => {
        out.done = p;
      },
    },
  };
}

describe('SearchClient (over inline transport)', () => {
  it('runs a search end-to-end and delivers grouped results + done', async () => {
    const client = new SearchClient(createInlineTransport());
    const entries = [
      makeRequest('a', 'hello world', 1),
      makeRequest('b', 'nothing here', 2),
      makeRequest('c', 'hello again', 3),
    ];
    const { cbs, out } = collector();
    client.submit(entries, 'hello', DEFAULT_FILTER_CONFIG, cbs);
    await drain();

    expect(out.groups.map((g) => g.entryId).sort()).toEqual(['a', 'c']);
    expect(out.done).not.toBeNull();
    expect(out.done?.done).toBe(3);
  });

  it('a new submit preempts the previous one — only the new session delivers', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100); // ~4 MB
    const many = Array.from({ length: 20 }, (_, i) => makeRequest(`big-${i}`, bigBody, i + 1));
    const small = [makeRequest('small', 'needle', 1)];

    const first = collector();
    const firstHandle = client.submit(many, 'needle', DEFAULT_FILTER_CONFIG, first.cbs);
    await Promise.resolve();

    const second = collector();
    const secondHandle = client.submit(small, 'needle', DEFAULT_FILTER_CONFIG, second.cbs);

    expect(secondHandle.sessionId).not.toBe(firstHandle.sessionId);
    await drain();

    // Second run completes.
    expect(second.out.done).not.toBeNull();
    expect(second.out.done?.done).toBe(1);

    // First run was aborted — no onDone.
    expect(first.out.done).toBeNull();
  });

  it('abort() stops further callbacks for that session', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const many = Array.from({ length: 20 }, (_, i) => makeRequest(`e-${i}`, bigBody, i + 1));

    const c = collector();
    const handle = client.submit(many, 'needle', DEFAULT_FILTER_CONFIG, c.cbs);
    await Promise.resolve();
    handle.abort();
    await drain();

    expect(c.out.done).toBeNull();
  });

  it('uses monotonic session ids', () => {
    const client = new SearchClient(createInlineTransport());
    const entries = [makeRequest('a', 'x', 1)];
    const h1 = client.submit(entries, 'xx', DEFAULT_FILTER_CONFIG, collector().cbs);
    const h2 = client.submit(entries, 'xx', DEFAULT_FILTER_CONFIG, collector().cbs);
    const h3 = client.submit(entries, 'xx', DEFAULT_FILTER_CONFIG, collector().cbs);
    expect(h2.sessionId).toBeGreaterThan(h1.sessionId);
    expect(h3.sessionId).toBeGreaterThan(h2.sessionId);
  });

  it('terminate() stops everything', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const many = Array.from({ length: 20 }, (_, i) => makeRequest(`e-${i}`, bigBody, i + 1));
    const c = collector();
    client.submit(many, 'needle', DEFAULT_FILTER_CONFIG, c.cbs);
    await Promise.resolve();
    client.terminate();
    await drain();
    expect(c.out.done).toBeNull();
  });

  it('on transport error — unblocks active session with synthetic onDone and marks client dead', async () => {
    const transport = fakeCrashableTransport();
    const client = new SearchClient(transport);
    const c = collector();
    client.submit([makeRequest('a', 'needle', 1)], 'needle', DEFAULT_FILTER_CONFIG, c.cbs);
    expect(client.isDead()).toBe(false);

    transport.fireError();

    expect(client.isDead()).toBe(true);
    // Caller received a synthetic onDone, so its state machine can
    // exit 'running'. Results stay empty since the worker never
    // delivered any real groups in this test.
    expect(c.out.done).toEqual({ done: 0, total: 0, elapsedMs: 0 });
  });

  it('submit after a crash synthesises an immediate onDone instead of hanging', async () => {
    const transport = fakeCrashableTransport();
    const client = new SearchClient(transport);
    client.submit([makeRequest('a', 'needle', 1)], 'needle', DEFAULT_FILTER_CONFIG, collector().cbs);
    transport.fireError();

    const c = collector();
    client.submit([makeRequest('b', 'needle', 1)], 'needle', DEFAULT_FILTER_CONFIG, c.cbs);
    await drain();
    expect(c.out.done).toEqual({ done: 0, total: 0, elapsedMs: 0 });
  });
});

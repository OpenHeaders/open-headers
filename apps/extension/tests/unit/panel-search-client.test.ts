import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import { networkDocInputs } from '@openheaders/ui/panel/data/search/network-search-docs';
import { SearchClient, type SearchSubmission } from '@openheaders/ui/panel/data/search/search-client';
import type { SearchDocInput } from '@openheaders/ui/panel/data/search/search-doc';
import type { SearchGroup, SearchProgress } from '@openheaders/ui/panel/data/search/search-engine';
import { createInlineTransport, type SearchTransport } from '@openheaders/ui/panel/data/search/search-transport';
import type { MainToWorker, WorkerToMain } from '@openheaders/ui/panel/data/search/search-worker-protocol';
import { DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function fakeRecordingTransport(): SearchTransport & { sent: MainToWorker[]; fireError(): void } {
  const messageListeners = new Set<(msg: WorkerToMain) => void>();
  const errorListeners = new Set<(err: Error) => void>();
  const sent: MainToWorker[] = [];
  return {
    sent,
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

function row(id: string, responseBody: string, displayId = 1): InspectorRow {
  const url = `https://api.openheaders.io/${id}`;
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'application/json' } },
  } as InspectorHarEntry;
  const body: InspectorHarBody = {
    method: 'GET',
    url,
    startedDateTime: '2026-04-16T00:00:00.000Z',
    content: responseBody,
    encoding: '',
  };
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: id,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 200,
    har: [har],
    harBodyByHop: [body],
  };
  return { lifecycle: lc, displayId, consolidatedRetryOf: [] };
}

function submission(
  rows: readonly InspectorRow[],
  query: string,
  extra: Partial<SearchSubmission> = {},
): SearchSubmission {
  return {
    docs: networkDocInputs(rows),
    coveredSources: ['network'],
    query,
    config: DEFAULT_TEXT_MATCH_CONFIG,
    sources: ['network'],
    ...extra,
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

function collector(): { cbs: Parameters<SearchClient['submit']>[1]; out: Collected } {
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
    const rows = [row('a', 'hello world', 1), row('b', 'nothing here', 2), row('c', 'hello again', 3)];
    const { cbs, out } = collector();
    client.submit(submission(rows, 'hello'), cbs);
    await drain();

    expect(out.groups.map((g) => g.docId).sort()).toEqual(['net:a', 'net:c']);
    expect(out.done).not.toBeNull();
    expect(out.done?.done).toBe(3);
  });

  it('a new submit preempts the previous one — only the new session delivers', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const many = Array.from({ length: 20 }, (_, i) => row(`big-${i}`, bigBody, i + 1));

    const first = collector();
    const firstHandle = client.submit(submission(many, 'needle'), first.cbs);
    await Promise.resolve();

    // The second submit's row set shrank to one small row — the sync
    // removes the big docs, so the new session finishes fast.
    const second = collector();
    const secondHandle = client.submit(submission([row('small', 'needle', 1)], 'needle'), second.cbs);

    expect(secondHandle.sessionId).not.toBe(firstHandle.sessionId);
    await drain();

    expect(second.out.done).not.toBeNull();
    expect(second.out.done?.done).toBe(1);

    expect(first.out.done).toBeNull();
  });

  it('abort() stops further callbacks for that session', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const many = Array.from({ length: 20 }, (_, i) => row(`e-${i}`, bigBody, i + 1));

    const c = collector();
    const handle = client.submit(submission(many, 'needle'), c.cbs);
    await Promise.resolve();
    handle.abort();
    await drain();

    expect(c.out.done).toBeNull();
  });

  it('uses monotonic session ids', () => {
    const client = new SearchClient(createInlineTransport());
    const rows = [row('a', 'x', 1)];
    const h1 = client.submit(submission(rows, 'xx'), collector().cbs);
    const h2 = client.submit(submission(rows, 'xx'), collector().cbs);
    const h3 = client.submit(submission(rows, 'xx'), collector().cbs);
    expect(h2.sessionId).toBeGreaterThan(h1.sessionId);
    expect(h3.sessionId).toBeGreaterThan(h2.sessionId);
  });

  it('terminate() stops everything', async () => {
    const client = new SearchClient(createInlineTransport());
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const many = Array.from({ length: 20 }, (_, i) => row(`e-${i}`, bigBody, i + 1));
    const c = collector();
    client.submit(submission(many, 'needle'), c.cbs);
    await Promise.resolve();
    client.terminate();
    await drain();
    expect(c.out.done).toBeNull();
  });

  it('on transport error — unblocks active session with synthetic onDone and marks client dead', async () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    const c = collector();
    client.submit(submission([row('a', 'needle', 1)], 'needle'), c.cbs);
    expect(client.isDead()).toBe(false);

    transport.fireError();

    expect(client.isDead()).toBe(true);
    expect(c.out.done).toEqual({ done: 0, total: 0, elapsedMs: 0 });
  });

  it('submit after a crash synthesises an immediate onDone instead of hanging', async () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    client.submit(submission([row('a', 'needle', 1)], 'needle'), collector().cbs);
    transport.fireError();

    const c = collector();
    client.submit(submission([row('b', 'needle', 1)], 'needle'), c.cbs);
    await drain();
    expect(c.out.done).toEqual({ done: 0, total: 0, elapsedMs: 0 });
  });
});

describe('SearchClient — version-diffed doc sync', () => {
  function syncMessages(sent: MainToWorker[]): Array<Extract<MainToWorker, { type: 'sync' }>> {
    return sent.filter((m): m is Extract<MainToWorker, { type: 'sync' }> => m.type === 'sync');
  }

  it('ships every doc on the first submit, nothing on an identical repeat', () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    const rows = [row('a', 'hello', 1), row('b', 'world', 2)];

    client.submit(submission(rows, 'hello'), collector().cbs);
    client.submit(submission(rows, 'world'), collector().cbs);

    const syncs = syncMessages(transport.sent);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].upserts.map((d) => d.docId).sort()).toEqual(['net:a', 'net:b']);
    // Both searches still went out.
    expect(transport.sent.filter((m) => m.type === 'search')).toHaveLength(2);
  });

  it('re-ships only the row whose lifecycle identity changed', () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    const stable = row('a', 'hello', 1);

    client.submit(submission([stable, row('b', 'world', 2)], 'hello'), collector().cbs);
    // Same id `b`, fresh lifecycle object — the reducer's "data changed" signal.
    client.submit(submission([stable, row('b', 'world v2', 2)], 'hello'), collector().cbs);

    const syncs = syncMessages(transport.sent);
    expect(syncs).toHaveLength(2);
    expect(syncs[1].upserts.map((d) => d.docId)).toEqual(['net:b']);
    expect(syncs[1].removedIds).toEqual([]);
  });

  it('removes docs of covered sources that vanished from the submit', () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    const a = row('a', 'hello', 1);
    const b = row('b', 'world', 2);

    client.submit(submission([a, b], 'hello'), collector().cbs);
    client.submit(submission([a], 'hello'), collector().cbs);

    const syncs = syncMessages(transport.sent);
    expect(syncs).toHaveLength(2);
    expect(syncs[1].upserts).toEqual([]);
    expect(syncs[1].removedIds).toEqual(['net:b']);
  });

  it('keeps docs of sources the submit did not cover', () => {
    const transport = fakeRecordingTransport();
    const client = new SearchClient(transport);
    const rows = [row('a', 'hello', 1)];
    const storageInput: SearchDocInput = {
      docId: 'st:cookies',
      source: 'storage',
      version: 'session=1',
      build: () => ({
        docId: 'st:cookies',
        source: 'storage',
        target: { kind: 'storage', reveal: { kind: 'cookies' } },
        displayId: null,
        filename: 'Cookies',
        origin: 'openheaders.io',
        timestamp: 0,
        sections: [{ name: 'Cookies', text: 'session=1' }],
      }),
    };

    client.submit(
      submission(rows, 'hello', {
        docs: [...networkDocInputs(rows), storageInput],
        coveredSources: ['network', 'storage'],
        sources: ['network', 'storage'],
      }),
      collector().cbs,
    );
    // Next submit covers network only — the cached storage doc survives.
    client.submit(submission(rows, 'hello'), collector().cbs);

    const syncs = syncMessages(transport.sent);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].upserts.map((d) => d.docId).sort()).toEqual(['net:a', 'st:cookies']);
  });
});

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { DEFAULT_FILTER_CONFIG } from '@openheaders/ui/panel/data/filter-engine';
import type { InspectorRow } from '@openheaders/ui/panel/data/inspector-facet';
import { createSearchHandler } from '@openheaders/ui/panel/data/search-worker-handler';
import type { MainToWorker, WorkerToMain } from '@openheaders/ui/panel/data/search-worker-protocol';
import { describe, expect, it } from 'vitest';

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

function collect() {
  const posted: WorkerToMain[] = [];
  const handler = createSearchHandler({ post: (msg) => posted.push(msg) });
  return { posted, handler };
}

async function drain() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('createSearchHandler', () => {
  it('runs a search and posts group + progress + done with matching sessionId', async () => {
    const { posted, handler } = collect();
    const rows = [row('a', 'hello world', 1), row('b', 'nothing here', 2), row('c', 'hello again', 3)];
    const msg: MainToWorker = {
      type: 'search',
      sessionId: 42,
      query: 'hello',
      config: DEFAULT_FILTER_CONFIG,
      rows,
    };
    handler.handle(msg);
    await drain();

    for (const p of posted) expect(p.sessionId).toBe(42);

    const groups = posted.filter((p) => p.type === 'group');
    const dones = posted.filter((p) => p.type === 'done');
    expect(groups.length).toBe(2);
    expect(dones.length).toBe(1);
    expect(dones[0].type === 'done' && dones[0].progress.done).toBe(3);
  });

  it('a new search aborts the previous one — no further messages for the old session', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const rows = Array.from({ length: 20 }, (_, i) => row(`big-${i}`, bigBody, i + 1));

    handler.handle({
      type: 'search',
      sessionId: 1,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      rows,
    });

    await Promise.resolve();

    handler.handle({
      type: 'search',
      sessionId: 2,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      rows: [row('small', 'needle here', 1)],
    });

    await drain();

    const session2Done = posted.find((p) => p.sessionId === 2 && p.type === 'done');
    expect(session2Done).toBeDefined();

    const session1Done = posted.find((p) => p.sessionId === 1 && p.type === 'done');
    expect(session1Done).toBeUndefined();
  });

  it('abort message only aborts the matching sessionId — stale aborts are ignored', async () => {
    const { posted, handler } = collect();
    const rows = [row('a', 'needle', 1)];

    handler.handle({
      type: 'search',
      sessionId: 5,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      rows,
    });

    handler.handle({ type: 'abort', sessionId: 4 });

    await drain();

    const done = posted.find((p) => p.type === 'done' && p.sessionId === 5);
    expect(done).toBeDefined();
  });

  it('dispose aborts the in-flight run', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const rows = Array.from({ length: 20 }, (_, i) => row(`e-${i}`, bigBody, i + 1));

    handler.handle({
      type: 'search',
      sessionId: 9,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      rows,
    });
    await Promise.resolve();
    handler.dispose();
    await drain();

    const done = posted.find((p) => p.type === 'done');
    expect(done).toBeUndefined();
  });
});

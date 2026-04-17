import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';
import { DEFAULT_FILTER_CONFIG } from '@/panel/data/filter-engine';
import { createSearchHandler } from '@/panel/data/search-worker-handler';
import type { MainToWorker, WorkerToMain } from '@/panel/data/search-worker-protocol';
import type { InspectorRequest } from '@/panel/data/types';

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

function collect() {
  const posted: WorkerToMain[] = [];
  const handler = createSearchHandler({ post: (msg) => posted.push(msg) });
  return { posted, handler };
}

/** Flush microtasks so runSearch's async work settles. */
async function drain() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('createSearchHandler', () => {
  it('runs a search and posts group + progress + done with matching sessionId', async () => {
    const { posted, handler } = collect();
    const entries = [
      makeRequest('a', 'hello world', 1),
      makeRequest('b', 'nothing here', 2),
      makeRequest('c', 'hello again', 3),
    ];
    const msg: MainToWorker = {
      type: 'search',
      sessionId: 42,
      query: 'hello',
      config: DEFAULT_FILTER_CONFIG,
      entries,
    };
    handler.handle(msg);
    await drain();

    // Every posted message carries sessionId 42.
    for (const p of posted) expect(p.sessionId).toBe(42);

    const groups = posted.filter((p) => p.type === 'group');
    const dones = posted.filter((p) => p.type === 'done');
    expect(groups.length).toBe(2); // a and c match
    expect(dones.length).toBe(1);
    expect(dones[0].type === 'done' && dones[0].progress.done).toBe(3);
  });

  it('a new search aborts the previous one — no further messages for the old session', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100); // ~4 MB
    const entries = Array.from({ length: 20 }, (_, i) => makeRequest(`big-${i}`, bigBody, i + 1));

    handler.handle({
      type: 'search',
      sessionId: 1,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      entries,
    });

    // Yield once so the worker gets past entry #1.
    await Promise.resolve();

    handler.handle({
      type: 'search',
      sessionId: 2,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      entries: [makeRequest('small', 'needle here', 1)],
    });

    await drain();

    // Session 2 must have completed (done message).
    const session2Done = posted.find((p) => p.sessionId === 2 && p.type === 'done');
    expect(session2Done).toBeDefined();

    // Session 1 must NOT have a done message — it was aborted.
    const session1Done = posted.find((p) => p.sessionId === 1 && p.type === 'done');
    expect(session1Done).toBeUndefined();
  });

  it('abort message only aborts the matching sessionId — stale aborts are ignored', async () => {
    const { posted, handler } = collect();
    const entries = [makeRequest('a', 'needle', 1)];

    handler.handle({
      type: 'search',
      sessionId: 5,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      entries,
    });

    // Stale abort for a prior session — must be ignored.
    handler.handle({ type: 'abort', sessionId: 4 });

    await drain();

    // Session 5 completes normally.
    const done = posted.find((p) => p.type === 'done' && p.sessionId === 5);
    expect(done).toBeDefined();
  });

  it('dispose aborts the in-flight run', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    const entries = Array.from({ length: 20 }, (_, i) => makeRequest(`e-${i}`, bigBody, i + 1));

    handler.handle({
      type: 'search',
      sessionId: 9,
      query: 'needle',
      config: DEFAULT_FILTER_CONFIG,
      entries,
    });
    await Promise.resolve();
    handler.dispose();
    await drain();

    // No done message because dispose aborted the run before completion.
    const done = posted.find((p) => p.type === 'done');
    expect(done).toBeUndefined();
  });
});

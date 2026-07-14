import type { SearchDoc } from '@openheaders/ui/panel/data/search/search-doc';
import { createSearchHandler } from '@openheaders/ui/panel/data/search/search-worker-handler';
import type { MainToWorker, WorkerToMain } from '@openheaders/ui/panel/data/search/search-worker-protocol';
import { DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function doc(id: string, responseBody: string, displayId = 1): SearchDoc {
  const url = `https://api.openheaders.io/${id}`;
  return {
    docId: `net:${id}`,
    source: 'network',
    target: { kind: 'request', requestId: id },
    displayId,
    filename: id,
    origin: `api.openheaders.io/${id}`,
    timestamp: displayId,
    sections: [
      { name: 'General', text: `${url}\nGET 200 OK` },
      { name: 'Response', text: responseBody },
    ],
  };
}

function storageDoc(id: string, text: string): SearchDoc {
  return {
    docId: `st:${id}`,
    source: 'storage',
    target: { kind: 'storage', reveal: { kind: 'cookies' } },
    displayId: null,
    filename: id,
    origin: 'openheaders.io',
    timestamp: 0,
    sections: [{ name: 'Entries', text }],
  };
}

function collect() {
  const posted: WorkerToMain[] = [];
  const handler = createSearchHandler({ post: (msg) => posted.push(msg) });
  return { posted, handler };
}

function search(sessionId: number, query: string, sources: Array<'network' | 'storage' | 'console'>): MainToWorker {
  return { type: 'search', sessionId, query, config: DEFAULT_TEXT_MATCH_CONFIG, sources };
}

async function drain() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('createSearchHandler', () => {
  it('scans the synced doc cache and posts group + progress + done with matching sessionId', async () => {
    const { posted, handler } = collect();
    handler.handle({
      type: 'sync',
      upserts: [doc('a', 'hello world', 1), doc('b', 'nothing here', 2), doc('c', 'hello again', 3)],
      removedIds: [],
    });
    handler.handle(search(42, 'hello', ['network']));
    await drain();

    for (const p of posted) expect(p.sessionId).toBe(42);

    const groups = posted.filter((p) => p.type === 'group');
    const dones = posted.filter((p) => p.type === 'done');
    expect(groups.length).toBe(2);
    expect(dones.length).toBe(1);
    expect(dones[0].type === 'done' && dones[0].progress.done).toBe(3);
  });

  it('a repeat search needs no re-sync — the doc cache persists across sessions', async () => {
    const { posted, handler } = collect();
    handler.handle({ type: 'sync', upserts: [doc('a', 'hello world', 1)], removedIds: [] });
    handler.handle(search(1, 'hello', ['network']));
    await drain();
    handler.handle(search(2, 'world', ['network']));
    await drain();

    const session2Groups = posted.filter((p) => p.sessionId === 2 && p.type === 'group');
    expect(session2Groups.length).toBe(1);
  });

  it('sync removals drop docs from the cache', async () => {
    const { posted, handler } = collect();
    handler.handle({ type: 'sync', upserts: [doc('a', 'needle', 1), doc('b', 'needle', 2)], removedIds: [] });
    handler.handle({ type: 'sync', upserts: [], removedIds: ['net:a'] });
    handler.handle(search(1, 'needle', ['network']));
    await drain();

    const groups = posted.filter((p) => p.type === 'group');
    expect(groups.length).toBe(1);
    expect(groups[0].type === 'group' && groups[0].group.docId).toBe('net:b');
  });

  it('search scans only the requested sources', async () => {
    const { posted, handler } = collect();
    handler.handle({
      type: 'sync',
      upserts: [doc('a', 'needle', 1), storageDoc('cookies', 'session=needle')],
      removedIds: [],
    });
    handler.handle(search(1, 'needle', ['storage']));
    await drain();

    const groups = posted.filter((p) => p.type === 'group');
    expect(groups.length).toBe(1);
    expect(groups[0].type === 'group' && groups[0].group.source).toBe('storage');
  });

  it('a new search aborts the previous one — no further messages for the old session', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    handler.handle({
      type: 'sync',
      upserts: Array.from({ length: 20 }, (_, i) => doc(`big-${i}`, bigBody, i + 1)),
      removedIds: [],
    });

    handler.handle(search(1, 'needle', ['network']));
    await Promise.resolve();
    // The cache shrinks to one small doc before the new session — the
    // preempting search finishes fast while session 1 dies mid-scan.
    handler.handle({
      type: 'sync',
      upserts: [doc('small', 'needle here', 1)],
      removedIds: Array.from({ length: 20 }, (_, i) => `net:big-${i}`),
    });
    handler.handle(search(2, 'needle', ['network']));
    await drain();

    const session2Done = posted.find((p) => p.sessionId === 2 && p.type === 'done');
    expect(session2Done).toBeDefined();

    const session1Done = posted.find((p) => p.sessionId === 1 && p.type === 'done');
    expect(session1Done).toBeUndefined();
  });

  it('abort message only aborts the matching sessionId — stale aborts are ignored', async () => {
    const { posted, handler } = collect();
    handler.handle({ type: 'sync', upserts: [doc('a', 'needle', 1)], removedIds: [] });

    handler.handle(search(5, 'needle', ['network']));
    handler.handle({ type: 'abort', sessionId: 4 });
    await drain();

    const done = posted.find((p) => p.type === 'done' && p.sessionId === 5);
    expect(done).toBeDefined();
  });

  it('dispose aborts the in-flight run', async () => {
    const { posted, handler } = collect();
    const bigBody = `${'x'.repeat(20_000)}needle${'y'.repeat(20_000)}`.repeat(100);
    handler.handle({
      type: 'sync',
      upserts: Array.from({ length: 20 }, (_, i) => doc(`e-${i}`, bigBody, i + 1)),
      removedIds: [],
    });

    handler.handle(search(9, 'needle', ['network']));
    await Promise.resolve();
    handler.dispose();
    await drain();

    const done = posted.find((p) => p.type === 'done');
    expect(done).toBeUndefined();
  });
});

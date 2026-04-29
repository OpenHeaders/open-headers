/**
 * Phase B — files cache subscribes to broadcast, re-projects to the
 * `FileRef[]` shape, and exposes a synchronous mirror. Unlike other
 * singleton caches the durable record lives in the platform `BlobStore`
 * IDB rather than `chrome.storage.local`, so the cache writes nothing
 * to storage on commit.
 */

import { addFileRef, type FileRefSlot, removeFileRef } from '@openheaders/core/sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createFilesCache } from '@/background/sync/files-cache';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const slot = (overrides: Partial<FileRefSlot> = {}): FileRefSlot => ({
  fileId: 'file:a',
  hash: 'sha256:aaa',
  filename: 'a.txt',
  mimeType: 'text/plain',
  size: 16,
  ...overrides,
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('FilesCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createFilesCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getSnapshot()).toEqual({ refs: [] });
    cache.dispose();
  });

  it('seeds the oracle from a persisted ref list and projects it back', async () => {
    const cache = createFilesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFiles([
      slot({ fileId: 'file:a', hash: 'sha256:a', filename: 'a.txt' }),
      slot({ fileId: 'file:b', hash: 'sha256:b', filename: 'b.bin', mimeType: undefined, size: 8 }),
    ]);
    const refs = cache.getSnapshot().refs;
    expect(refs.map((r) => r.fileId)).toEqual(['file:a', 'file:b']);
    expect(refs[1].mimeType).toBeUndefined();
    cache.dispose();
  });

  it('updates the cache when a new ref is added via the catalog', async () => {
    const cache = createFilesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFiles([]);

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const intent = addFileRef(ctxFactory(), { ref: slot({ fileId: 'file:new' }) });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().refs.map((r) => r.fileId)).toEqual(['file:new']);
    cache.dispose();
  });

  it('drops a ref on removeFileRef', async () => {
    const cache = createFilesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFiles([slot({ fileId: 'file:gone' })]);
    const intent = removeFileRef(ctxFactory(), { fileId: 'file:gone' });
    await oracle.apply(intent.batch, []);
    expect(cache.getSnapshot().refs).toEqual([]);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createFilesCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFiles([]);

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = addFileRef(ctxFactory(), { ref: slot({ fileId: 'file:x' }) });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});

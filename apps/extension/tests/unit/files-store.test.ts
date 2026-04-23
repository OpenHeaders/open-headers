/**
 * files-store wrapper — verifies workspace scoping + lock wrapping
 * over the (mocked) BlobStore surface. Full IDB round-trip lives in
 * the Phase 12 e2e spec.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({
  store: new Map<string, { workspaceId: string; hash: string; filename: string; size: number }>(),
}));

vi.mock('@/shared/files/blob-store', () => ({
  hashBlob: vi.fn(async () => `sha256:${'a'.repeat(64)}`),
  putBlob: vi.fn(async (workspaceId: string, input: { blob: Blob; filename: string; mimeType?: string }) => {
    const hash = `sha256:${(store.size + 1).toString().padStart(64, '0')}`;
    store.set(`${workspaceId}:${hash}`, {
      workspaceId,
      hash,
      filename: input.filename,
      size: input.blob.size,
    });
    return { hash, filename: input.filename, mimeType: input.mimeType, size: input.blob.size };
  }),
  getBlob: vi.fn(async () => null),
  listBlobs: vi.fn(async (workspaceId: string) => {
    const out: unknown[] = [];
    for (const v of store.values()) {
      if (v.workspaceId === workspaceId) out.push(v);
    }
    return out;
  }),
  deleteBlob: vi.fn(async (workspaceId: string, hash: string) => store.delete(`${workspaceId}:${hash}`)),
  clearWorkspaceBlobs: vi.fn(async (workspaceId: string) => {
    for (const [k, v] of store.entries()) {
      if (v.workspaceId === workspaceId) store.delete(k);
    }
  }),
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-files'),
}));

import { setLockRuntime } from '@/shared/coordination/with-lock';

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let filesStore: typeof import('@/background/modules/files-store');

beforeEach(async () => {
  store.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  filesStore = await import('@/background/modules/files-store');
});

afterEach(() => {
  setLockRuntime(null);
});

describe('files-store', () => {
  it('putFile returns a FileRef for the stored blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const ref = await filesStore.putFile({ blob, filename: 'hello.txt' });
    expect(ref.filename).toBe('hello.txt');
    expect(ref.size).toBe(5);
    expect(ref.hash).toMatch(/^sha256:/);
  });

  it('listFiles returns every blob in the active workspace', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    const files = await filesStore.listFiles();
    expect(files).toHaveLength(2);
    expect(files.map((f) => (f as { filename: string }).filename)).toEqual(['a.txt', 'b.txt']);
  });

  it('deleteFile removes + returns true; second call returns false', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['x']), filename: 'x.txt' });
    expect(await filesStore.deleteFile(ref.hash)).toBe(true);
    expect(await filesStore.deleteFile(ref.hash)).toBe(false);
  });

  it('purgeFilesForWorkspace drops every blob for the workspace', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    await filesStore.purgeFilesForWorkspace('ws-files');
    expect(await filesStore.listFiles()).toEqual([]);
  });

  it('serializes concurrent puts through the workspace lock (no lost updates)', async () => {
    const puts = Array.from({ length: 5 }, (_, i) =>
      filesStore.putFile({ blob: new Blob([`payload-${i}`]), filename: `file-${i}.bin` }),
    );
    await Promise.all(puts);
    const files = await filesStore.listFiles();
    expect(files).toHaveLength(5);
  });
});

describe('files-store — onFilesStoreChange (Phase 12.4b broadcast)', () => {
  it('fires the change listener after putFile', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('fires the change listener after successful deleteFile', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.deleteFile(ref.hash);
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does NOT fire the change listener when deleteFile removes nothing', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.deleteFile(`sha256:${'f'.repeat(64)}`);
    expect(spy).not.toHaveBeenCalled();
    unsub();
  });

  it('fires once per purge and never more', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.purgeFilesForWorkspace('ws-files');
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('unsubscribe stops future notifications', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    unsub();
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    expect(spy).not.toHaveBeenCalled();
  });
});

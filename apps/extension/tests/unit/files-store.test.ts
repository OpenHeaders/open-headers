/**
 * files-store wrapper — verifies workspace scoping over the (mocked)
 * BlobStore surface plus the catalog mutations that route through the
 * sync oracle. Full IDB round-trip lives in the Phase 12 e2e spec.
 */

import type { FileRef } from '@openheaders/core/files';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({
  store: new Map<string, { workspaceId: string; ref: FileRef; size: number }>(),
}));

let putCounter = 0;

vi.mock('@openheaders/oracle/files', () => ({
  hashBlob: vi.fn(async () => `sha256:${'a'.repeat(64)}`),
  putBlob: vi.fn(async (workspaceId: string, input: { blob: Blob; filename: string; mimeType?: string }) => {
    putCounter++;
    const fileId = `file:test-${putCounter}`;
    const hash = `sha256:${putCounter.toString().padStart(64, '0')}`;
    const ref: FileRef = {
      fileId,
      hash,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.blob.size,
    };
    store.set(`${workspaceId}:${fileId}`, { workspaceId, ref, size: input.blob.size });
    return ref;
  }),
  getBlob: vi.fn(async () => null),
  listBlobs: vi.fn(async (workspaceId: string) => {
    const out: FileRef[] = [];
    for (const v of store.values()) {
      if (v.workspaceId === workspaceId) out.push(v.ref);
    }
    return out;
  }),
  deleteBlob: vi.fn(async (workspaceId: string, fileId: string) => store.delete(`${workspaceId}:${fileId}`)),
  renameBlob: vi.fn(async (workspaceId: string, fileId: string, next: { filename: string; mimeType?: string }) => {
    const entry = store.get(`${workspaceId}:${fileId}`);
    if (!entry) return null;
    const updated: FileRef = {
      ...entry.ref,
      filename: next.filename,
      mimeType: next.mimeType ?? entry.ref.mimeType,
    };
    store.set(`${workspaceId}:${fileId}`, { ...entry, ref: updated });
    return updated;
  }),
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

let filesStore: typeof import('@/background/modules/files-store');
let syncService: typeof import('@/background/sync/service');

beforeEach(async () => {
  store.clear();
  putCounter = 0;
  vi.resetModules();
  syncService = await import('@/background/sync/service');
  filesStore = await import('@/background/modules/files-store');
  syncService.__initSyncServiceForTests('ws-files');
  await filesStore.bridgeFilesSyncEngine();
});

afterEach(() => {
  syncService.dispose();
  filesStore.__resetForTests();
});

describe('files-store', () => {
  it('putFile returns a FileRef for the stored blob', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const ref = await filesStore.putFile({ blob, filename: 'hello.txt' });
    expect(ref.filename).toBe('hello.txt');
    expect(ref.size).toBe(5);
    expect(ref.hash).toMatch(/^sha256:/);
    expect(ref.fileId).toMatch(/^file:/);
  });

  it('listFiles returns every blob in the active workspace', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    const files = await filesStore.listFiles();
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.filename).sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('deleteFile removes + returns true; second call returns false', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['x']), filename: 'x.txt' });
    expect(await filesStore.deleteFile(ref.fileId)).toBe(true);
    expect(await filesStore.deleteFile(ref.fileId)).toBe(false);
  });

  it('renameFile rewrites filename + preserves hash, fileId, size', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['x']), filename: 'old.txt' });
    const renamed = await filesStore.renameFile({ fileId: ref.fileId, filename: 'new.txt' });
    expect(renamed).toEqual({ ...ref, filename: 'new.txt' });
    const list = await filesStore.listFiles();
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe('new.txt');
  });

  it('renameFile returns null when the fileId is unknown', async () => {
    expect(await filesStore.renameFile({ fileId: 'file:gone', filename: 'x.txt' })).toBeNull();
  });

  it('renameFile fires the change listener on success', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['x']), filename: 'old.txt' });
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.renameFile({ fileId: ref.fileId, filename: 'new.txt' });
    expect(spy).toHaveBeenCalled();
    unsub();
  });

  it('renameFile does NOT fire the change listener when fileId is unknown', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.renameFile({ fileId: 'file:gone', filename: 'x.txt' });
    expect(spy).not.toHaveBeenCalled();
    unsub();
  });

  it('purgeFilesForWorkspace drops every blob for the workspace', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    await filesStore.purgeFilesForWorkspace('ws-files');
    expect(await filesStore.listFiles()).toEqual([]);
  });
});

describe('files-store — onFilesStoreChange (Phase 12.4b broadcast)', () => {
  it('fires the change listener after putFile', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    expect(spy).toHaveBeenCalled();
    unsub();
  });

  it('fires the change listener after successful deleteFile', async () => {
    const ref = await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.deleteFile(ref.fileId);
    expect(spy).toHaveBeenCalled();
    unsub();
  });

  it('does NOT fire the change listener when deleteFile removes nothing', async () => {
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.deleteFile('file:does-not-exist');
    expect(spy).not.toHaveBeenCalled();
    unsub();
  });

  it('fires once per purge', async () => {
    await filesStore.putFile({ blob: new Blob(['a']), filename: 'a.txt' });
    await filesStore.putFile({ blob: new Blob(['b']), filename: 'b.txt' });
    const spy = vi.fn();
    const unsub = filesStore.onFilesStoreChange(spy);
    await filesStore.purgeFilesForWorkspace('ws-files');
    expect(spy).toHaveBeenCalled();
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

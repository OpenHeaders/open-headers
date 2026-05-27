/**
 * IndexedDB-backed {@link BlobBackend} — the default impl shipped to
 * browser hosts (extension + web app). Lifted verbatim from the
 * pre-seam `blob-store.ts` free functions; the only structural change
 * is moving them into a class so the seam can swap implementations.
 *
 * Storage contract (ARCHITECTURE.md §6 + §8):
 *   • Database: `oh.files` (origin-scoped, shared across workspaces).
 *   • Object store: `blobs`. Key = `${workspaceId}:${fileId}` so every
 *     upload gets its own row — two uploads of the same bytes under
 *     different filenames are two SEPARATE entries.
 *   • Value shape: `{ workspaceId, fileId, hash, filename, mimeType,
 *     size, createdAt, blob: Blob }`.
 *
 * Why not `chrome.storage.local`? 10MB quota. Why not OPFS? OPFS is a
 * filesystem; blob bytes are opaque binary and IDB keeps the API
 * uniform with other per-workspace structured data + wins on
 * cross-browser support.
 *
 * Concurrency: BlobStore operations that MUTATE land inside
 * `withLock(entityLockName(workspaceId, 'files', 'singleton'))` so
 * concurrent renderer tabs can't race. Reads are lock-free (IDB
 * transactions are per-op atomic).
 *
 * Identities:
 *   • `fileId` — `file:<uuid>`, the primary key. Stable per-upload.
 *   • `hash`   — `sha256:<64-hex>` content digest, stored alongside
 *     for `{{file.X}}` template resolution and for the UI's "Missing"
 *     detection. Not unique — two entries with the same hash can
 *     coexist.
 */

import { type FileRef, newFileId } from '@openheaders/core/files';
import type { BlobBackend } from '@openheaders/oracle/files/blob-backend';
import { hashBlob } from '@openheaders/oracle/files/hash';

const DB_NAME = 'oh.files';
const DB_VERSION = 2;
const STORE_NAME = 'blobs';

interface StoredBlob {
  /** Composite key = `${workspaceId}:${fileId}`. */
  id: string;
  workspaceId: string;
  fileId: string;
  hash: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
}

const compositeKey = (workspaceId: string, fileId: string): string => `${workspaceId}:${fileId}`;

export class IdbBlobBackend implements BlobBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /** Test hook — drop the cached connection. */
  reset(): void {
    this.dbPromise = null;
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        const tx = req.transaction;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_workspace', 'workspaceId', { unique: false });
          store.createIndex('by_hash', 'hash', { unique: false });
          return;
        }
        // v1 → v2 upgrade: the old key shape was
        // `${workspaceId}:${hash}` and stored records had no `fileId`.
        // Walk every entry, synthesize a `fileId`, rewrite the key.
        if (e.oldVersion < 2 && tx) {
          const store = tx.objectStore(STORE_NAME);
          if (!store.indexNames.contains('by_hash')) {
            store.createIndex('by_hash', 'hash', { unique: false });
          }
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const rec = cursor.value as Partial<StoredBlob> & { workspaceId: string; hash: string };
            if (!rec.fileId) {
              const fresh = newFileId();
              const migrated: StoredBlob = {
                ...(rec as StoredBlob),
                fileId: fresh,
                id: `${rec.workspaceId}:${fresh}`,
              };
              store.delete(cursor.primaryKey);
              store.put(migrated);
            }
            cursor.continue();
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async put(
    workspaceId: string,
    input: { blob: Blob; filename: string; mimeType?: string },
  ): Promise<FileRef> {
    const hash = await hashBlob(input.blob);
    const size = input.blob.size;
    const mimeType = input.mimeType ?? input.blob.type ?? 'application/octet-stream';
    const fileId = newFileId();
    const id = compositeKey(workspaceId, fileId);
    const record: StoredBlob = {
      id,
      workspaceId,
      fileId,
      hash,
      filename: input.filename,
      mimeType,
      size,
      createdAt: new Date().toISOString(),
      blob: input.blob,
    };

    const db = await this.openDb();
    return new Promise<FileRef>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve({ fileId, hash, filename: input.filename, mimeType, size });
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(workspaceId: string, fileId: string): Promise<Blob | null> {
    const db = await this.openDb();
    const id = compositeKey(workspaceId, fileId);
    return new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(((req.result as StoredBlob | undefined)?.blob ?? null) as Blob | null);
      req.onerror = () => reject(req.error);
    });
  }

  async getByHash(workspaceId: string, hash: string): Promise<Blob | null> {
    const db = await this.openDb();
    return new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_hash');
      const req = index.openCursor(IDBKeyRange.only(hash));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(null);
          return;
        }
        const rec = cursor.value as StoredBlob;
        if (rec.workspaceId !== workspaceId) {
          cursor.continue();
          return;
        }
        resolve(rec.blob);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async list(workspaceId: string): Promise<FileRef[]> {
    const db = await this.openDb();
    return new Promise<FileRef[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_workspace');
      const req = index.getAll(IDBKeyRange.only(workspaceId));
      req.onsuccess = () => {
        const records = (req.result ?? []) as StoredBlob[];
        resolve(
          records.map((r) => ({
            fileId: r.fileId,
            hash: r.hash,
            filename: r.filename,
            mimeType: r.mimeType,
            size: r.size,
          })),
        );
      };
      req.onerror = () => reject(req.error);
    });
  }

  async delete(workspaceId: string, fileId: string): Promise<boolean> {
    const db = await this.openDb();
    const id = compositeKey(workspaceId, fileId);
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const existing = store.get(id);
      existing.onsuccess = () => {
        if (!existing.result) {
          tx.oncomplete = () => resolve(false);
          return;
        }
        store.delete(id);
        tx.oncomplete = () => resolve(true);
      };
      existing.onerror = () => reject(existing.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async rename(
    workspaceId: string,
    fileId: string,
    next: { filename: string; mimeType?: string },
  ): Promise<FileRef | null> {
    const db = await this.openDb();
    const id = compositeKey(workspaceId, fileId);
    return new Promise<FileRef | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const get = store.get(id);
      get.onsuccess = () => {
        const existing = get.result as StoredBlob | undefined;
        if (!existing) {
          tx.oncomplete = () => resolve(null);
          return;
        }
        const merged: StoredBlob = {
          ...existing,
          filename: next.filename,
          mimeType: next.mimeType ?? existing.mimeType,
        };
        store.put(merged);
        tx.oncomplete = () =>
          resolve({
            fileId: merged.fileId,
            hash: merged.hash,
            filename: merged.filename,
            mimeType: merged.mimeType,
            size: merged.size,
          });
      };
      get.onerror = () => reject(get.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await this.openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_workspace');
      const req = index.openKeyCursor(IDBKeyRange.only(workspaceId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

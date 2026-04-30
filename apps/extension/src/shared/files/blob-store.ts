/**
 * BlobStore — IndexedDB-backed file storage (ARCHITECTURE.md §6 + §8).
 *
 * Storage contract:
 *   • Database: `oh.files` (origin-scoped, shared across workspaces in
 *     the extension's single-origin IDB).
 *   • Object store: `blobs`. Key = `${workspaceId}:${fileId}` so every
 *     upload gets its own row — two uploads of the same bytes under
 *     different filenames are two SEPARATE entries. This matches the
 *     user's mental model (uploaded files are independent), at the
 *     cost of storing redundant bytes for true duplicates. Content
 *     dedup with reference-counted bytes is a v2 concern.
 *   • Value shape: `{ workspaceId, fileId, hash, filename, mimeType,
 *     size, createdAt, blob: Blob }`.
 *
 * Why not `chrome.storage.local`? 10MB quota (unlimitedStorage requires
 * store review). A single PDF invoice blows the quota. IDB's per-origin
 * quota is tens of GB on Chrome and half of free disk on Firefox — the
 * right fit per ARCHITECTURE.md §8.
 *
 * Why not OPFS? OPFS is a filesystem. File blobs are opaque binary;
 * structured-query capability isn't needed. IDB keeps the API uniform
 * with other per-workspace structured data and wins on cross-browser
 * support.
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

const DB_NAME = 'oh.files';
const DB_VERSION = 2;
const STORE_NAME = 'blobs';

interface StoredBlob {
  /** Composite key = `${workspaceId}:${fileId}` — see module header. */
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

// ── Connection management ──────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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
  return dbPromise;
}

/** Reset the cached connection — test harness hook. */
export function __resetBlobStoreForTests(): void {
  dbPromise = null;
}

// ── Hash computation ───────────────────────────────────────────────

/**
 * Compute the canonical `sha256:<hex>` digest of a blob. Uses the
 * WebCrypto subtle API — works in both the SW and the renderer
 * without a shim.
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

function compositeKey(workspaceId: string, fileId: string): string {
  return `${workspaceId}:${fileId}`;
}

// ── CRUD ───────────────────────────────────────────────────────────

/**
 * Put a blob into the store. Always creates a new row with a fresh
 * `fileId` — uploads are independent of each other even when the bytes
 * are identical. The returned FileRef carries both the new `fileId`
 * and the computed `hash` so callers can de-dupe by content when they
 * want (`byHash` lookup in the registry), but the storage identity is
 * strictly per-upload.
 */
export async function putBlob(
  workspaceId: string,
  input: {
    blob: Blob;
    filename: string;
    mimeType?: string;
  },
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

  const db = await openDb();
  return new Promise<FileRef>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve({ fileId, hash, filename: input.filename, mimeType, size });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve the blob bytes for a given fileId. Returns null when the
 * blob is not stored for this workspace. Callers that need bytes-by-
 * hash (e.g. `{{file.X}}` template resolution by content) can call
 * `getBlobByHash` instead.
 */
export async function getBlob(workspaceId: string, fileId: string): Promise<Blob | null> {
  const db = await openDb();
  const id = compositeKey(workspaceId, fileId);
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(((req.result as StoredBlob | undefined)?.blob ?? null) as Blob | null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve bytes by content hash — first row with a matching `hash`
 * wins. Useful for `{{file.X}}` resolution when the user references a
 * file by content rather than identity. Returns null when no entry in
 * the workspace carries the requested hash.
 */
export async function getBlobByHash(workspaceId: string, hash: string): Promise<Blob | null> {
  const db = await openDb();
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

/**
 * List every FileRef stored for the given workspace. The returned
 * metadata is suitable for rendering the Files panel or populating a
 * `FileRegistry`. Blob bytes are NOT included — use `getBlob` when
 * you need the actual content.
 */
export async function listBlobs(workspaceId: string): Promise<FileRef[]> {
  const db = await openDb();
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

/**
 * Delete the blob with the given `fileId` from the specified
 * workspace. Returns `true` if an entry was removed, `false` if no
 * such entry existed. Callers should check upstream references
 * (request bodies, imported-report drops) before calling — this
 * method does NOT cascade.
 */
export async function deleteBlob(workspaceId: string, fileId: string): Promise<boolean> {
  const db = await openDb();
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

/**
 * Rewrite the filename / mimeType for an existing blob in place.
 * Returns the updated `FileRef` shell, or `null` if no such entry
 * exists. Bytes + hash are untouched — content identity is preserved
 * across rename. Caller is expected to hold the files-singleton lock so
 * a concurrent rename and put/delete on the same fileId can't tear
 * (matches the discipline put / delete already follow).
 */
export async function renameBlob(
  workspaceId: string,
  fileId: string,
  next: { filename: string; mimeType?: string },
): Promise<FileRef | null> {
  const db = await openDb();
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

/**
 * Drop every blob owned by the given workspace. Used when a workspace
 * is deleted so the per-workspace-data-keys discipline stays honest
 * (see the orchestrator's `perWorkspaceDataKeys` list — this is the
 * IDB-side equivalent).
 */
export async function clearWorkspaceBlobs(workspaceId: string): Promise<void> {
  const db = await openDb();
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

/**
 * BlobStore — IndexedDB-backed, content-addressed file storage
 * (ARCHITECTURE.md §6 + §8).
 *
 * Storage contract:
 *   • Database: `oh.files` (origin-scoped, shared across workspaces in
 *     the extension's single-origin IDB).
 *   • Object store: `blobs`. Key = `${workspaceId}:${hash}` so two
 *     workspaces that upload the same bytes each keep their own copy
 *     — no cross-workspace blob sharing. Dedup within a workspace is
 *     preserved (same bytes → same hash → same key).
 *   • Value shape: `{ workspaceId, hash, filename, mimeType, size,
 *     createdAt, blob: Blob }`.
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
 * concurrent renderer tabs can't race a duplicate upload. Reads are
 * lock-free (IDB transactions are per-op atomic).
 *
 * Identity: sha256 over the blob's raw bytes, formatted as
 * `sha256:<64-hex>`. Computed via WebCrypto — works in both the SW
 * and the renderer.
 */

import type { FileRef } from '@openheaders/core/files';

const DB_NAME = 'oh.files';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

interface StoredBlob {
  /** Composite key = `${workspaceId}:${hash}` — see module header. */
  id: string;
  workspaceId: string;
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
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Secondary index so `list(workspaceId)` can scan without
        // pulling every blob blob.
        store.createIndex('by_workspace', 'workspaceId', { unique: false });
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

function compositeKey(workspaceId: string, hash: string): string {
  return `${workspaceId}:${hash}`;
}

// ── CRUD ───────────────────────────────────────────────────────────

/**
 * Put a blob into the store. Computes the sha256 hash, dedups within
 * the workspace (same bytes → same key → existing entry wins; we
 * preserve the original filename + createdAt to keep FileRef stability
 * across re-uploads). Returns the FileRef.
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
  const id = compositeKey(workspaceId, hash);

  const db = await openDb();
  return new Promise<FileRef>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Dedup check — if an entry with this hash already exists in this
    // workspace, keep the original filename + createdAt so existing
    // request body references remain stable.
    const existing = store.get(id);
    existing.onsuccess = () => {
      const prior = existing.result as StoredBlob | undefined;
      if (prior) {
        tx.oncomplete = () =>
          resolve({
            hash: prior.hash,
            filename: prior.filename,
            mimeType: prior.mimeType,
            size: prior.size,
          });
        return;
      }
      const record: StoredBlob = {
        id,
        workspaceId,
        hash,
        filename: input.filename,
        mimeType,
        size,
        createdAt: new Date().toISOString(),
        blob: input.blob,
      };
      store.put(record);
      tx.oncomplete = () =>
        resolve({
          hash,
          filename: input.filename,
          mimeType,
          size,
        });
    };
    tx.onerror = () => reject(tx.error);
    existing.onerror = () => reject(existing.error);
  });
}

/**
 * Retrieve the blob bytes for a hash. Returns null when the blob is
 * not stored for this workspace.
 */
export async function getBlob(workspaceId: string, hash: string): Promise<Blob | null> {
  const db = await openDb();
  const id = compositeKey(workspaceId, hash);
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(((req.result as StoredBlob | undefined)?.blob ?? null) as Blob | null);
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
 * Delete the blob with the given hash from the specified workspace.
 * Returns `true` if an entry was removed, `false` if no such entry
 * existed. Callers should check upstream references (request bodies,
 * imported-report drops) before calling — this method does NOT cascade.
 */
export async function deleteBlob(workspaceId: string, hash: string): Promise<boolean> {
  const db = await openDb();
  const id = compositeKey(workspaceId, hash);
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

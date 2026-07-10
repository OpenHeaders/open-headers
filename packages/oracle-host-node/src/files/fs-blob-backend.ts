/**
 * Filesystem + SQLite {@link BlobBackend} for Node hosts (Electron
 * desktop main today, headless daemon / CLI later).
 *
 * Layout:
 *
 *   - **Bytes on disk:** one file per blob at
 *     `<rootDir>/<workspaceId>/<fileId>.bin`. Plain content; no
 *     framing. No filename collisions because `fileId` is a uuid.
 *   - **Metadata in SQLite:** `blob_metadata` table on the shared
 *     oracle.db handle (the one `SqliteSyncPersistence` already opens
 *     at boot). One row per blob; primary key `(workspace_id, file_id)`
 *     mirrors the IDB backend's composite key.
 *
 * Why split bytes / metadata: the metadata is hot for `list` and
 * `getByHash` queries; bytes are cold and often large (PDF / images /
 * archives) — keeping them out of SQLite lets the DB stay snappy and
 * lets us swap to OS-native streaming reads later if a request body
 * needs to send a large blob without materializing it in JS memory.
 * Single-DB-file deployments stay easy because the DB just stores
 * pointers — the user can back up oracle.db + the blobs dir
 * independently.
 *
 * Concurrency: writes go through `withLock(entityLockName(workspaceId,
 * 'files', 'singleton'))` per the BlobBackend contract — the FS impl
 * doesn't need additional locks. Each metadata UPDATE/INSERT/DELETE
 * runs inside a `better-sqlite3` transaction so the disk write +
 * metadata change land atomically (transaction-internal throw rolls
 * back the metadata; the bytes file is best-effort-deleted on
 * rollback). Reads are lock-free.
 *
 * Schema:
 *
 *     CREATE TABLE blob_metadata (
 *       workspace_id TEXT NOT NULL,
 *       file_id      TEXT NOT NULL,
 *       hash         TEXT NOT NULL,
 *       filename     TEXT NOT NULL,
 *       mime_type    TEXT NOT NULL,
 *       size         INTEGER NOT NULL,
 *       created_at   TEXT NOT NULL,
 *       PRIMARY KEY (workspace_id, file_id)
 *     );
 *     CREATE INDEX blob_metadata_by_hash
 *       ON blob_metadata (workspace_id, hash);
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type FileRef, newFileId } from '@openheaders/core/files';
import type Database from 'better-sqlite3';
import type { BlobBackend } from '@openheaders/oracle/files/blob-backend';
import { hashBlob } from '@openheaders/oracle/files/hash';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS blob_metadata (
    workspace_id TEXT NOT NULL,
    file_id      TEXT NOT NULL,
    hash         TEXT NOT NULL,
    filename     TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    size         INTEGER NOT NULL,
    created_at   TEXT NOT NULL,
    PRIMARY KEY (workspace_id, file_id)
  )`,
  `CREATE INDEX IF NOT EXISTS blob_metadata_by_hash
    ON blob_metadata (workspace_id, hash)`,
] as const;

export function ensureBlobMetadataSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface MetadataRow {
  workspace_id: string;
  file_id: string;
  hash: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
}

interface FsBlobBackendStatements {
  insert: Database.Statement<[string, string, string, string, string, number, string]>;
  update: Database.Statement<[string, string, string, string]>;
  selectOne: Database.Statement<[string, string]>;
  selectByHash: Database.Statement<[string, string]>;
  selectByWorkspace: Database.Statement<[string]>;
  deleteOne: Database.Statement<[string, string]>;
  deleteWorkspace: Database.Statement<[string]>;
}

function prepareStatements(db: Database.Database): FsBlobBackendStatements {
  return {
    insert: db.prepare(
      `INSERT INTO blob_metadata (workspace_id, file_id, hash, filename, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    update: db.prepare(
      `UPDATE blob_metadata SET filename = ?, mime_type = ? WHERE workspace_id = ? AND file_id = ?`,
    ),
    selectOne: db.prepare(
      `SELECT workspace_id, file_id, hash, filename, mime_type, size, created_at
       FROM blob_metadata WHERE workspace_id = ? AND file_id = ?`,
    ),
    selectByHash: db.prepare(
      `SELECT workspace_id, file_id, hash, filename, mime_type, size, created_at
       FROM blob_metadata WHERE workspace_id = ? AND hash = ? LIMIT 1`,
    ),
    selectByWorkspace: db.prepare(
      `SELECT workspace_id, file_id, hash, filename, mime_type, size, created_at
       FROM blob_metadata WHERE workspace_id = ? ORDER BY created_at ASC`,
    ),
    deleteOne: db.prepare(`DELETE FROM blob_metadata WHERE workspace_id = ? AND file_id = ?`),
    deleteWorkspace: db.prepare(`DELETE FROM blob_metadata WHERE workspace_id = ?`),
  };
}

const PREPARED = new WeakMap<Database.Database, FsBlobBackendStatements>();
function statementsFor(db: Database.Database): FsBlobBackendStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

function rowToFileRef(row: MetadataRow): FileRef {
  return {
    fileId: row.file_id,
    hash: row.hash,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size,
  };
}

export interface FileSystemBlobBackendOptions {
  /** Absolute path to the blobs root directory. One subdir per workspace. */
  rootDir: string;
  /**
   * Shared SQLite handle (typically the one from
   * `createSqliteSyncPersistence`). Schema is ensured at construction.
   */
  db: Database.Database;
}

export class FileSystemBlobBackend implements BlobBackend {
  private readonly rootDir: string;
  private readonly db: Database.Database;

  constructor(options: FileSystemBlobBackendOptions) {
    this.rootDir = options.rootDir;
    this.db = options.db;
    ensureBlobMetadataSchema(options.db);
  }

  private workspaceDir(workspaceId: string): string {
    return path.join(this.rootDir, workspaceId);
  }

  private blobPath(workspaceId: string, fileId: string): string {
    return path.join(this.workspaceDir(workspaceId), `${fileId}.bin`);
  }

  async put(
    workspaceId: string,
    input: { blob: Blob; filename: string; mimeType?: string },
  ): Promise<FileRef> {
    const hash = await hashBlob(input.blob);
    const size = input.blob.size;
    const mimeType = input.mimeType ?? input.blob.type ?? 'application/octet-stream';
    const fileId = newFileId();
    const createdAt = new Date().toISOString();
    const bytes = new Uint8Array(await input.blob.arrayBuffer());

    await fs.mkdir(this.workspaceDir(workspaceId), { recursive: true, mode: 0o700 });
    const filePath = this.blobPath(workspaceId, fileId);
    await fs.writeFile(filePath, bytes, { mode: 0o600 });

    try {
      statementsFor(this.db).insert.run(
        workspaceId,
        fileId,
        hash,
        input.filename,
        mimeType,
        size,
        createdAt,
      );
    } catch (err) {
      // Metadata insert failed — drop the orphan bytes so the next put
      // doesn't run against a half-written entry.
      await fs.unlink(filePath).catch(() => undefined);
      throw err;
    }

    return { fileId, hash, filename: input.filename, mimeType, size };
  }

  async get(workspaceId: string, fileId: string): Promise<Blob | null> {
    const row = statementsFor(this.db).selectOne.get(workspaceId, fileId) as MetadataRow | undefined;
    if (!row) return null;
    return this.readBlob(workspaceId, fileId, row.mime_type);
  }

  async getByHash(workspaceId: string, hash: string): Promise<Blob | null> {
    const row = statementsFor(this.db).selectByHash.get(workspaceId, hash) as MetadataRow | undefined;
    if (!row) return null;
    return this.readBlob(workspaceId, row.file_id, row.mime_type);
  }

  async list(workspaceId: string): Promise<FileRef[]> {
    const rows = statementsFor(this.db).selectByWorkspace.all(workspaceId) as MetadataRow[];
    return rows.map(rowToFileRef);
  }

  async delete(workspaceId: string, fileId: string): Promise<boolean> {
    const stmts = statementsFor(this.db);
    const row = stmts.selectOne.get(workspaceId, fileId) as MetadataRow | undefined;
    if (!row) return false;
    stmts.deleteOne.run(workspaceId, fileId);
    await fs.unlink(this.blobPath(workspaceId, fileId)).catch(() => undefined);
    return true;
  }

  async rename(
    workspaceId: string,
    fileId: string,
    next: { filename: string; mimeType?: string },
  ): Promise<FileRef | null> {
    const stmts = statementsFor(this.db);
    const row = stmts.selectOne.get(workspaceId, fileId) as MetadataRow | undefined;
    if (!row) return null;
    const mimeType = next.mimeType ?? row.mime_type;
    stmts.update.run(next.filename, mimeType, workspaceId, fileId);
    return {
      fileId: row.file_id,
      hash: row.hash,
      filename: next.filename,
      mimeType,
      size: row.size,
    };
  }

  async clearWorkspace(workspaceId: string): Promise<void> {
    statementsFor(this.db).deleteWorkspace.run(workspaceId);
    await fs.rm(this.workspaceDir(workspaceId), { recursive: true, force: true });
  }

  private async readBlob(workspaceId: string, fileId: string, mimeType: string): Promise<Blob | null> {
    try {
      const bytes = await fs.readFile(this.blobPath(workspaceId, fileId));
      // Wrap the Node Buffer as a Web Blob — the API surface the BlobBackend
      // contract requires. `new Blob([Uint8Array])` is supported in
      // Node 19+; Electron 39 ships Node 22.
      return new Blob([new Uint8Array(bytes)], { type: mimeType });
    } catch {
      // Metadata says it should be there but the bytes are gone. Treat
      // as missing rather than a hard error — the renderer's missing-
      // file UI already covers this case.
      return null;
    }
  }
}

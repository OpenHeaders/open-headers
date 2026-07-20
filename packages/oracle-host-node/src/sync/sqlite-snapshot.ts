/**
 * One-call consistent copy of a SQLite database file via the online
 * backup API. Unlike a filesystem copy, the backup walks pages through
 * the connection, so it yields a single self-contained `.db` file that
 * folds in whatever lives in the WAL at that moment — including a
 * crash-leftover `-wal` the last writer never checkpointed. The daemon
 * backup command is the consumer; the snapshot itself is safe next to
 * other open handles, the offline gate around it exists for
 * cross-file consistency (`storage.json`/`blobs/`), not for SQLite.
 */

import { openSqliteDatabase } from './sqlite-database';

export async function snapshotSqliteDatabase(sourcePath: string, destPath: string): Promise<void> {
  const db = openSqliteDatabase(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}

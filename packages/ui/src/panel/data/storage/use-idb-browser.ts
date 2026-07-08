/**
 * State + fetch loop for the Storage tool window's IndexedDB section:
 * database/store enumeration, cursor-paged record reads, and the delete
 * ops (record / store clear / database) over the host seam. Mounted
 * alongside `useStorageInspector` and gated by `active` (hooks can't be
 * conditional); inactive means no fetches and no polling.
 *
 * Standard-plane IDB has no change events, so this polls while active —
 * on a slower cadence than DOM storage (enumeration opens every
 * database). Same poll-loop discipline as the rest of the tool window:
 * token-guarded fetches, structural dedupe before every `setState` (RPCs
 * return fresh identities), callbacks keyed on primitives.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdbDatabase, IdbRecordsPage } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const IDB_POLL_MS = 5000;
const IDB_PAGE_SIZE = 50;

function idbDatabasesEqual(a: ReadonlyArray<IdbDatabase>, b: ReadonlyArray<IdbDatabase>): boolean {
  if (a.length !== b.length) return false;
  return a.every((db, i) => {
    const o = b[i];
    return (
      db.name === o.name &&
      db.version === o.version &&
      db.objectStores.length === o.objectStores.length &&
      db.objectStores.every((s, j) => {
        const os = o.objectStores[j];
        return (
          s.name === os.name &&
          s.keyPath === os.keyPath &&
          s.autoIncrement === os.autoIncrement &&
          s.indexNames.length === os.indexNames.length &&
          s.indexNames.every((n, k) => n === os.indexNames[k])
        );
      })
    );
  });
}

function idbRecordsPageEqual(a: IdbRecordsPage, b: IdbRecordsPage): boolean {
  if (a.truncated !== b.truncated || a.records.length !== b.records.length) return false;
  return a.records.every((r, i) => {
    const o = b.records[i];
    return (
      r.keyPreview === o.keyPreview && r.primaryKeyPreview === o.primaryKeyPreview && r.valuePreview === o.valuePreview
    );
  });
}

export interface IdbSelection {
  database: string;
  store: string;
}

export interface IdbBrowserState {
  /** `null` until the first enumeration lands; with `loading` false it
   *  means the scope's IndexedDB can't be read. */
  databases: ReadonlyArray<IdbDatabase> | null;
  loading: boolean;
  selection: IdbSelection | null;
  selectStore: (database: string, store: string) => void;
  closeStore: () => void;
  page: number;
  setPage: (page: number) => void;
  /** `null` while the selected store's page is in flight. */
  recordsPage: IdbRecordsPage | null;
  refresh: () => void;
  /** Last delete/clear failed — cleared by the next successful one. */
  mutationFailed: boolean;
  /** Delete one record of the SELECTED store by its opaque wire key. */
  deleteRecord: (primaryKeyWire: string) => void;
  clearStore: (database: string, store: string) => void;
  deleteDatabase: (database: string) => void;
}

export function useIdbBrowser(active: boolean, frameId: number | null): IdbBrowserState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();

  const [databases, setDatabases] = useState<ReadonlyArray<IdbDatabase> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<IdbSelection | null>(null);
  const [page, setPage] = useState(0);
  const [recordsPage, setRecordsPage] = useState<IdbRecordsPage | null>(null);
  const [mutationFailed, setMutationFailed] = useState(false);
  const tokenRef = useRef(0);

  // Scope or activation change → drop everything from the old scope.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope identity is the reset trigger
  useEffect(() => {
    tokenRef.current++;
    setDatabases(null);
    setLoading(true);
    setSelection(null);
    setPage(0);
    setRecordsPage(null);
    setMutationFailed(false);
  }, [active, frameId]);

  const listDatabases = useCallback(async () => {
    if (!active || !host || tabId === null || frameId === null) return;
    const token = tokenRef.current;
    const next = await host.listIndexedDb(tabId, frameId);
    if (token !== tokenRef.current) return;
    setLoading(false);
    if (next === null) return; // transient failure — keep the last list
    setDatabases((prev) => (prev && idbDatabasesEqual(prev, next) ? prev : next));
  }, [active, host, tabId, frameId]);

  // Keyed on the selection PRIMITIVES so a databases re-list never mints
  // a new callback (and thereby resets the records grid) while the same
  // store stays selected.
  const database = selection?.database ?? null;
  const store = selection?.store ?? null;

  const readRecords = useCallback(async () => {
    if (!active || !host || tabId === null || frameId === null || database === null || store === null) return;
    const token = tokenRef.current;
    const result = await host.readIndexedDbRecords(tabId, frameId, database, store, page, IDB_PAGE_SIZE);
    if (token !== tokenRef.current) return;
    if (result === null) return; // transient failure — keep the last page
    setRecordsPage((prev) => (prev && idbRecordsPageEqual(prev, result) ? prev : result));
  }, [active, host, tabId, frameId, database, store, page]);

  // Selection or page change → drop the stale grid, read immediately.
  useEffect(() => {
    setRecordsPage(null);
    void readRecords();
  }, [readRecords]);

  // A re-list can drop the selected database/store (deleted page-side).
  useEffect(() => {
    if (!selection || !databases) return;
    const db = databases.find((d) => d.name === selection.database);
    if (!db?.objectStores.some((s) => s.name === selection.store)) {
      setSelection(null);
      setPage(0);
    }
  }, [databases, selection]);

  useEffect(() => {
    if (!active) return;
    void listDatabases();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void listDatabases();
      void readRecords();
    }, IDB_POLL_MS);
    return () => clearInterval(timer);
  }, [active, listDatabases, readRecords]);

  const selectStore = useCallback((db: string, storeName: string) => {
    setSelection({ database: db, store: storeName });
    setPage(0);
  }, []);

  const closeStore = useCallback(() => {
    setSelection(null);
    setPage(0);
  }, []);

  const refresh = useCallback(() => {
    void listDatabases();
    void readRecords();
  }, [listDatabases, readRecords]);

  // Every mutation refetches through the same read path (invalidation
  // discipline) — the grid never trusts a delete's local outcome.
  const deleteRecord = useCallback(
    (primaryKeyWire: string) => {
      if (!host || tabId === null || frameId === null || database === null || store === null) return;
      void host.deleteIndexedDbRecord(tabId, frameId, database, store, primaryKeyWire).then((ok) => {
        setMutationFailed(!ok);
        void readRecords();
      });
    },
    [host, tabId, frameId, database, store, readRecords],
  );

  const clearStore = useCallback(
    (db: string, storeName: string) => {
      if (!host || tabId === null || frameId === null) return;
      void host.clearIndexedDbStore(tabId, frameId, db, storeName).then((ok) => {
        setMutationFailed(!ok);
        void readRecords();
      });
    },
    [host, tabId, frameId, readRecords],
  );

  const deleteDatabase = useCallback(
    (db: string) => {
      if (!host || tabId === null || frameId === null) return;
      void host.deleteIndexedDbDatabase(tabId, frameId, db).then((ok) => {
        setMutationFailed(!ok);
        // The stale-selection effect prunes a selection inside the
        // deleted database once the re-list lands.
        void listDatabases();
      });
    },
    [host, tabId, frameId, listDatabases],
  );

  return {
    databases,
    loading,
    selection,
    selectStore,
    closeStore,
    page,
    setPage,
    recordsPage,
    refresh,
    mutationFailed,
    deleteRecord,
    clearStore,
    deleteDatabase,
  };
}

/**
 * Boot-time wiring: route the DevTools panel's storage inspector through
 * the SW-side handlers (`background/modules/storage-inspector/`).
 *
 * The panel page can't enumerate frames (`chrome.webNavigation`) or
 * inject readers (`chrome.scripting`) — both are background-only APIs —
 * so every method is an RPC to the SW.
 *
 * Imported once from `apps/extension/src/panel/index.tsx` at panel boot.
 */

import type {
  DomStorageArea,
  DomStorageFullValue,
  DomStorageSnapshot,
  IdbDatabase,
  IdbRecordsPage,
  StorageScope,
} from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

logger.info('StorageInspectorHost', 'installed');

setStorageInspectorHost({
  async listScopes(tabId: number): Promise<readonly StorageScope[] | null> {
    try {
      const res = await call('listStorageScopes', { tabId });
      return res?.scopes ?? null;
    } catch (err) {
      logger.info('StorageInspectorHost', `listScopes ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async readDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<DomStorageSnapshot | null> {
    try {
      const res = await call('getDomStorageEntries', { tabId, frameId, area });
      if (!res?.entries) return null;
      return { entries: res.entries, truncated: res.truncated ?? false };
    } catch (err) {
      logger.info('StorageInspectorHost', `readDomStorage ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async readDomStorageValue(
    tabId: number,
    frameId: number,
    area: DomStorageArea,
    key: string,
  ): Promise<DomStorageFullValue | null> {
    try {
      const res = await call('getDomStorageValue', { tabId, frameId, area, key });
      if (!res) return null;
      return { value: res.value, tooLarge: res.tooLarge ?? false };
    } catch (err) {
      logger.info('StorageInspectorHost', `readDomStorageValue ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async writeDomStorage(
    tabId: number,
    frameId: number,
    area: DomStorageArea,
    key: string,
    value: string,
  ): Promise<boolean> {
    try {
      const res = await call('setDomStorageItem', { tabId, frameId, area, key, value });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `writeDomStorage ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  async removeDomStorage(tabId: number, frameId: number, area: DomStorageArea, key: string): Promise<boolean> {
    try {
      const res = await call('removeDomStorageItem', { tabId, frameId, area, key });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `removeDomStorage ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  async clearDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<boolean> {
    try {
      const res = await call('clearDomStorage', { tabId, frameId, area });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `clearDomStorage ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  async listIndexedDb(tabId: number, frameId: number): Promise<readonly IdbDatabase[] | null> {
    try {
      const res = await call('listIndexedDbDatabases', { tabId, frameId });
      return res?.databases ?? null;
    } catch (err) {
      logger.info('StorageInspectorHost', `listIndexedDb ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async readIndexedDbRecords(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    page: number,
    pageSize: number,
  ): Promise<IdbRecordsPage | null> {
    try {
      const res = await call('getIndexedDbRecords', { tabId, frameId, database, store, page, pageSize });
      if (!res?.records) return null;
      return { records: res.records, truncated: res.truncated ?? false };
    } catch (err) {
      logger.info('StorageInspectorHost', `readIndexedDbRecords ✗ tab ${tabId}: ${(err as Error).message}`);
      return null;
    }
  },
  async deleteIndexedDbRecord(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    primaryKeyWire: string,
  ): Promise<boolean> {
    try {
      const res = await call('deleteIndexedDbRecord', { tabId, frameId, database, store, primaryKeyWire });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `deleteIndexedDbRecord ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  async clearIndexedDbStore(tabId: number, frameId: number, database: string, store: string): Promise<boolean> {
    try {
      const res = await call('clearIndexedDbStore', { tabId, frameId, database, store });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `clearIndexedDbStore ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  async deleteIndexedDbDatabase(tabId: number, frameId: number, database: string): Promise<boolean> {
    try {
      const res = await call('deleteIndexedDbDatabase', { tabId, frameId, database });
      return res?.ok === true;
    } catch (err) {
      logger.info('StorageInspectorHost', `deleteIndexedDbDatabase ✗ tab ${tabId}: ${(err as Error).message}`);
      return false;
    }
  },
  subscribeIdbInvalidations(tabId: number, listener: () => void): () => void {
    return subscribe('idbStorageInvalidated', (payload) => {
      if (payload.tabId === tabId) listener();
    });
  },
});

/** Storage tool-window RPCs — scope discovery + DOM storage reads/writes + IndexedDB reads/writes/deletes + Cache Storage reads + quota. */

import type { DomStorageAreaWire, SiteDataTypeWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import {
  clearDomStorage as clearDomStorageHandler,
  clearIndexedDbStore as clearIndexedDbStoreHandler,
  clearSiteData as clearSiteDataHandler,
  deleteCacheStorageCache as deleteCacheStorageCacheHandler,
  deleteCacheStorageEntry as deleteCacheStorageEntryHandler,
  deleteIndexedDbDatabase as deleteIndexedDbDatabaseHandler,
  deleteIndexedDbRecord as deleteIndexedDbRecordHandler,
  getCacheStorageEntries as getCacheStorageEntriesHandler,
  getCacheStorageEntryDocument as getCacheStorageEntryDocumentHandler,
  getDomStorageEntries as getDomStorageEntriesHandler,
  getDomStorageValue as getDomStorageValueHandler,
  getIndexedDbRecordDocument as getIndexedDbRecordDocumentHandler,
  getIndexedDbRecords as getIndexedDbRecordsHandler,
  getStorageQuota as getStorageQuotaHandler,
  listCacheStorageCaches as listCacheStorageCachesHandler,
  listIndexedDbDatabases as listIndexedDbDatabasesHandler,
  listStorageScopes as listStorageScopesHandler,
  putIndexedDbRecord as putIndexedDbRecordHandler,
  removeDomStorageItem as removeDomStorageItemHandler,
  renameDomStorageItem as renameDomStorageItemHandler,
  setDomStorageItem as setDomStorageItemHandler,
  setQuotaOverride as setQuotaOverrideHandler,
} from '../../storage-inspector';
import type { HandlerMap } from '../types';

export const storageInspectorHandlers: HandlerMap = {
  listStorageScopes: ({ message, respond }) => {
    listStorageScopesHandler(message.tabId as number)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageScopes', `handler threw: ${err.message}`);
        respond({ scopes: null });
      });
    return true;
  },

  getDomStorageEntries: ({ message, respond }) => {
    getDomStorageEntriesHandler(message.tabId as number, message.frameId as number, message.area as DomStorageAreaWire)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageRead', `handler threw: ${err.message}`);
        respond({ entries: null });
      });
    return true;
  },

  getDomStorageValue: ({ message, respond }) => {
    getDomStorageValueHandler(
      message.tabId as number,
      message.frameId as number,
      message.area as DomStorageAreaWire,
      message.key as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageRead', `handler threw: ${err.message}`);
        respond({ value: null });
      });
    return true;
  },

  setDomStorageItem: ({ message, respond }) => {
    setDomStorageItemHandler(
      message.tabId as number,
      message.frameId as number,
      message.area as DomStorageAreaWire,
      message.key as string,
      message.value as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageWrite', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  renameDomStorageItem: ({ message, respond }) => {
    renameDomStorageItemHandler(
      message.tabId as number,
      message.frameId as number,
      message.area as DomStorageAreaWire,
      message.key as string,
      message.newKey as string,
      message.value as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageWrite', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  removeDomStorageItem: ({ message, respond }) => {
    removeDomStorageItemHandler(
      message.tabId as number,
      message.frameId as number,
      message.area as DomStorageAreaWire,
      message.key as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageWrite', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  clearDomStorage: ({ message, respond }) => {
    clearDomStorageHandler(message.tabId as number, message.frameId as number, message.area as DomStorageAreaWire)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageWrite', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  listIndexedDbDatabases: ({ message, respond }) => {
    listIndexedDbDatabasesHandler(message.tabId as number, message.frameId as number)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ databases: null });
      });
    return true;
  },

  getIndexedDbRecords: ({ message, respond }) => {
    getIndexedDbRecordsHandler(
      message.tabId as number,
      message.frameId as number,
      message.database as string,
      message.store as string,
      message.page as number,
      message.pageSize as number,
      message.index as string | undefined,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ records: null });
      });
    return true;
  },

  getIndexedDbRecordDocument: ({ message, respond }) => {
    getIndexedDbRecordDocumentHandler(
      message.tabId as number,
      message.frameId as number,
      message.database as string,
      message.store as string,
      message.primaryKeyWire as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ document: null });
      });
    return true;
  },

  putIndexedDbRecord: ({ message, respond }) => {
    putIndexedDbRecordHandler(
      message.tabId as number,
      message.frameId as number,
      message.database as string,
      message.store as string,
      message.primaryKeyWire as string,
      message.valueText as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  deleteIndexedDbRecord: ({ message, respond }) => {
    deleteIndexedDbRecordHandler(
      message.tabId as number,
      message.frameId as number,
      message.database as string,
      message.store as string,
      message.primaryKeyWire as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  clearIndexedDbStore: ({ message, respond }) => {
    clearIndexedDbStoreHandler(
      message.tabId as number,
      message.frameId as number,
      message.database as string,
      message.store as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  deleteIndexedDbDatabase: ({ message, respond }) => {
    deleteIndexedDbDatabaseHandler(message.tabId as number, message.frameId as number, message.database as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  listCacheStorageCaches: ({ message, respond }) => {
    listCacheStorageCachesHandler(message.tabId as number, message.frameId as number)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageCaches', `handler threw: ${err.message}`);
        respond({ caches: null });
      });
    return true;
  },

  getCacheStorageEntries: ({ message, respond }) => {
    getCacheStorageEntriesHandler(
      message.tabId as number,
      message.frameId as number,
      message.cache as string,
      message.page as number,
      message.pageSize as number,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageCaches', `handler threw: ${err.message}`);
        respond({ entries: null });
      });
    return true;
  },

  getCacheStorageEntryDocument: ({ message, respond }) => {
    getCacheStorageEntryDocumentHandler(
      message.tabId as number,
      message.frameId as number,
      message.cache as string,
      message.url as string,
      message.method as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageCaches', `handler threw: ${err.message}`);
        respond({ document: null });
      });
    return true;
  },

  deleteCacheStorageCache: ({ message, respond }) => {
    deleteCacheStorageCacheHandler(message.tabId as number, message.frameId as number, message.cache as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageCaches', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  getStorageQuota: ({ message, respond }) => {
    getStorageQuotaHandler(message.tabId as number, message.frameId as number)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageQuota', `handler threw: ${err.message}`);
        respond({ quota: null });
      });
    return true;
  },

  clearSiteData: ({ message, respond }) => {
    clearSiteDataHandler(
      message.tabId as number,
      message.frameId as number,
      message.types as ReadonlyArray<SiteDataTypeWire> | undefined,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageQuota', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  setStorageQuotaOverride: ({ message, respond }) => {
    setQuotaOverrideHandler(
      message.tabId as number,
      message.frameId as number,
      message.quotaBytes as number | undefined,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageQuota', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  deleteCacheStorageEntry: ({ message, respond }) => {
    deleteCacheStorageEntryHandler(
      message.tabId as number,
      message.frameId as number,
      message.cache as string,
      message.url as string,
      message.method as string,
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageCaches', `handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },
};

/** Storage tool-window RPCs — scope discovery + DOM storage reads/writes + IndexedDB reads/deletes + Cache Storage reads. */

import type { DomStorageAreaWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import {
  clearDomStorage as clearDomStorageHandler,
  clearIndexedDbStore as clearIndexedDbStoreHandler,
  deleteIndexedDbDatabase as deleteIndexedDbDatabaseHandler,
  deleteIndexedDbRecord as deleteIndexedDbRecordHandler,
  getCacheStorageEntries as getCacheStorageEntriesHandler,
  getDomStorageEntries as getDomStorageEntriesHandler,
  getDomStorageValue as getDomStorageValueHandler,
  getIndexedDbRecords as getIndexedDbRecordsHandler,
  listCacheStorageCaches as listCacheStorageCachesHandler,
  listIndexedDbDatabases as listIndexedDbDatabasesHandler,
  listStorageScopes as listStorageScopesHandler,
  removeDomStorageItem as removeDomStorageItemHandler,
  setDomStorageItem as setDomStorageItemHandler,
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
    )
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('StorageIdb', `handler threw: ${err.message}`);
        respond({ records: null });
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
};

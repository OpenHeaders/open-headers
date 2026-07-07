/** Storage tool-window RPCs — scope discovery + DOM storage reads/writes + IndexedDB reads. */

import type { DomStorageAreaWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import {
  clearDomStorage as clearDomStorageHandler,
  getDomStorageEntries as getDomStorageEntriesHandler,
  getDomStorageValue as getDomStorageValueHandler,
  getIndexedDbRecords as getIndexedDbRecordsHandler,
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
};

/** Storage tool-window RPCs — scope discovery + DOM storage reads. */

import type { DomStorageAreaWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import {
  getDomStorageEntries as getDomStorageEntriesHandler,
  listStorageScopes as listStorageScopesHandler,
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
};

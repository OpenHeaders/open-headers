/** Diagnostic + relay RPCs that don't belong to a single entity domain. */

import type { JarCookieEditWire, JarCookieKeyWire } from '@openheaders/core/bridge';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { logger } from '@utils/logger';
import {
  fetchCookieJarForUrl as fetchCookieJarForUrlHandler,
  removeCookieForUrl as removeCookieForUrlHandler,
  setCookieForUrl as setCookieForUrlHandler,
} from '../../fetch-cookie-jar';
import { fetchSourceMapText as fetchSourceMapTextHandler } from '../../fetch-source-map';
import type { HandlerMap } from '../types';

export const miscHandlers: HandlerMap = {
  fetchSourceMapText: ({ message, respond }) => {
    fetchSourceMapTextHandler(message.jsUrl as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('SourceMapFetch', `handler threw: ${err.message}`);
        respond({ mapText: null });
      });
    return true;
  },

  fetchCookieJarForUrl: ({ message, respond }) => {
    fetchCookieJarForUrlHandler(message.url as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarFetch', `handler threw: ${err.message}`);
        respond({ cookies: null });
      });
    return true;
  },

  setCookieForUrl: ({ message, respond }) => {
    setCookieForUrlHandler(message.cookie as JarCookieEditWire)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarWrite', `set handler threw: ${err.message}`);
        respond({ cookie: null });
      });
    return true;
  },

  removeCookieForUrl: ({ message, respond }) => {
    const key: JarCookieKeyWire = {
      name: message.name as string,
      domain: message.domain as string,
      path: message.path as string,
      secure: message.secure as boolean,
      ...(message.partitionKey ? { partitionKey: message.partitionKey as string } : {}),
      ...(message.storeId ? { storeId: message.storeId as string } : {}),
    };
    removeCookieForUrlHandler(key)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarWrite', `remove handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  getStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getStatusSnapshot() });
  },
};

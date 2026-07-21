/** Cookie-jar RPCs — the browser jar reads/writes behind the panel's
 *  cookie seams (and the telemetry storage relay's cookie verbs). */

import type { JarCookieEditWire, JarCookieKeyWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';
import {
  clearCookiesForSite as clearCookiesForSiteHandler,
  fetchCookieJarForSite as fetchCookieJarForSiteHandler,
  fetchCookieJarForUrl as fetchCookieJarForUrlHandler,
  removeCookieForUrl as removeCookieForUrlHandler,
  setCookieForUrl as setCookieForUrlHandler,
} from '../../net/fetch-cookie-jar';
import type { HandlerMap } from '../types';

export const cookieJarHandlers: HandlerMap = {
  fetchCookieJarForUrl: ({ message, respond }) => {
    fetchCookieJarForUrlHandler(message.url as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarFetch', `handler threw: ${err.message}`);
        respond({ cookies: null });
      });
    return true;
  },

  fetchCookieJarForSite: ({ message, respond }) => {
    fetchCookieJarForSiteHandler(message.url as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarFetch', `site handler threw: ${err.message}`);
        respond({ cookies: null });
      });
    return true;
  },

  clearCookiesForSite: ({ message, respond }) => {
    clearCookiesForSiteHandler(message.url as string)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarWrite', `clear handler threw: ${err.message}`);
        respond({ ok: false });
      });
    return true;
  },

  setCookieForUrl: ({ message, respond }) => {
    setCookieForUrlHandler(message.cookie as JarCookieEditWire)
      .then((res) => respond(res))
      .catch((err: Error) => {
        logger.info('CookieJarWrite', `set handler threw: ${err.message}`);
        respond({ cookie: null, error: err.message });
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
};

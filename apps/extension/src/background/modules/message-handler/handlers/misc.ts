/** Diagnostic + relay RPCs that don't belong to a single entity domain. */

import type { JarCookieEditWire, JarCookieKeyWire } from '@openheaders/core/bridge';
import { getBackendSyncStatusSnapshot } from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { logger } from '@utils/logger';
import { evalConsoleExpression, previewConsoleExpression } from '../../console-eval-access';
import {
  clearCookiesForSite as clearCookiesForSiteHandler,
  fetchCookieJarForSite as fetchCookieJarForSiteHandler,
  fetchCookieJarForUrl as fetchCookieJarForUrlHandler,
  removeCookieForUrl as removeCookieForUrlHandler,
  setCookieForUrl as setCookieForUrlHandler,
} from '../../net/fetch-cookie-jar';
import { fetchSourceMapText as fetchSourceMapTextHandler } from '../../net/fetch-source-map';
import type { HandlerMap } from '../types';

export const miscHandlers: HandlerMap = {
  consoleEval: ({ message, respond }) => {
    const tabId = message.tabId as number;
    const contextKey = message.contextKey as string;
    const expression = message.expression as string;
    // "Treat code evaluation as user action" — absent reads as true, the
    // browser's default.
    const userGesture = message.userGesture !== false;
    // The outcome rides the console stream as command/result entries; the
    // response only acks dispatch (false = no evaluator on this host).
    evalConsoleExpression(tabId, contextKey, expression, userGesture)
      .then((dispatched) =>
        respond(dispatched ? { success: true } : { success: false, error: 'console evaluation unavailable' }),
      )
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  consoleEvalPreview: ({ message, respond }) => {
    // Eager evaluation — a clean "nothing to show" is success with no text.
    previewConsoleExpression(message.tabId as number, message.contextKey as string, message.expression as string)
      .then((text) => respond(text === null ? { success: true } : { success: true, text }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

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

  getBackendSyncStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getBackendSyncStatusSnapshot() });
  },
};

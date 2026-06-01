/** Diagnostic + relay RPCs that don't belong to a single entity domain. */

import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { logger } from '@utils/logger';
import { fetchCookieJarForUrl as fetchCookieJarForUrlHandler } from '../../fetch-cookie-jar';
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

  getStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getStatusSnapshot() });
  },
};

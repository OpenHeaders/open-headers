/** Diagnostic + relay RPCs that don't belong to a single entity domain. */

import type { WorkspaceContentSnapshot } from '@openheaders/core/sync';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { logger } from '@utils/logger';
import { wsRequest } from '../../../ws-request';
import { fetchCookieJarForUrl as fetchCookieJarForUrlHandler } from '../../fetch-cookie-jar';
import { fetchSourceMapText as fetchSourceMapTextHandler } from '../../fetch-source-map';
import type { HandlerMap } from '../types';

export const miscHandlers: HandlerMap = {
  // Peer data-presence relay (Phase C M2c.2). The renderer can't talk to the
  // desktop directly; this bounces the request over the WS and forwards the
  // response back. `available: false` covers WS-offline, relay failure, and a
  // server `__error` echo (handled inside wsRequest) — the mode-switch
  // orchestrator routes any of these to `peer-unreachable`.
  'oh.sync.getPeerDataPresence': ({ respond, ctx }) => {
    if (!ctx.isWebSocketConnected()) {
      respond({ available: false });
      return;
    }
    void wsRequest<{ workspaces: WorkspaceContentSnapshot[] }>({ type: 'oh.sync.getDataPresence' })
      .then((resp) => respond({ available: true, workspaces: resp.workspaces }))
      .catch((err: Error) => {
        logger.info('MessageHandler', `oh.sync.getPeerDataPresence relay failed: ${err.message}`);
        respond({ available: false });
      });
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

  getStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getStatusSnapshot() });
  },
};

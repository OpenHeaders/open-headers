/** Diagnostic + relay RPCs that don't belong to a single entity domain. */

import { getBackendSyncStatusSnapshot } from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { logger } from '@utils/logger';
import { evalConsoleExpression, previewConsoleExpression } from '../../console-eval-access';
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

  getStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getStatusSnapshot() });
  },

  getBackendSyncStatusSnapshot: ({ respond }) => {
    respond({ snapshot: getBackendSyncStatusSnapshot() });
  },
};

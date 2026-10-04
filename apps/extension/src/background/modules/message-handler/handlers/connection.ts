/** Connection / presence RPCs. */

import { getRules } from '@openheaders/oracle/entity/rule-store';
import { acceptBackendIdentityChange } from '@openheaders/oracle/sync/client/backend-identity-accept';
import { logger } from '@utils/logger';
import { getActiveWorkspaceId, listWorkspaces } from '../../workspace/workspace-store';
import type { HandlerMap } from '../types';

export const connectionHandlers: HandlerMap = {
  popupOpen: ({ respond, ctx }) => {
    respond({
      type: 'rulesUpdated',
      rules: getRules(),
      connected: ctx.isWebSocketConnected(),
      workspaces: listWorkspaces(),
      activeWorkspaceId: getActiveWorkspaceId(),
    });
  },

  checkConnection: ({ respond, ctx }) => {
    respond({ connected: ctx.isWebSocketConnected() });
  },

  getRules: ({ respond, ctx }) => {
    respond({ rules: getRules(), isConnected: ctx.isWebSocketConnected() });
  },

  'oh.backendIdentity.accept': ({ message, respond }) => {
    acceptBackendIdentityChange(message.backendId as string)
      .then((result) => respond(result))
      .catch((error: Error) => {
        logger.warn('MessageHandler', 'accepting the backend identity change failed', error.message);
        respond({ reconnected: false });
      });
    return true;
  },

  rulesUpdated: ({ respond, ctx }) => {
    logger.info('MessageHandler', 'Rule update requested');
    ctx
      .revalidateTrackedRequests()
      .then(() => {
        ctx.scheduleUpdate('rulesUpdated', { immediate: true });
        ctx.updateBadgeCallback();
        respond({ success: true });
      })
      .catch((error: Error) => {
        logger.info('MessageHandler', 'Error updating rules:', error.message);
        respond({ success: false, error: error.message });
      });
    return true;
  },
};

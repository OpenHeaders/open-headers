/**
 * Message Handler — routes non-rule-CRUD RPCs from every extension surface
 * (popup, sidepanel, workbench.html, devtools panel) to a domain handler.
 *
 * The dispatch is a table lookup (`registry`): each `message.type` resolves
 * to one handler module under `handlers/`. This router owns only what can't
 * be a plain table entry:
 *   - the `target: 'background'` script-host RPC from the offscreen doc,
 *   - the host-neutral sync/awareness passthrough (`dispatchSyncRpc`), which
 *     must run before the table since its types aren't registered,
 *   - the `proxy-*` / unknown fallthrough,
 *   - the top-level error boundary.
 *
 * Handler contract: return `true` to keep the message channel open for an
 * async `respond`; return nothing for a reply already sent synchronously.
 */

import type { ScriptHostRequest } from '@openheaders/core/scripts';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import { logger } from '@utils/logger';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import { handleScriptHostRequest } from '../offscreen-host';
import { registry } from './registry';

function createSafeResponse(sendResponse: SendResponse): SendResponse {
  return (data: unknown) => {
    try {
      sendResponse(data);
    } catch (_error) {
      logger.info('MessageHandler', 'Could not send response, channel closed');
    }
  };
}

export function handleGeneralMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
  ctx: MessageHandlerContext,
): boolean | undefined {
  const respond = createSafeResponse(sendResponse);

  try {
    // Script sandbox host RPC (from offscreen doc). Tagged with
    // `target: 'background'` so we route it here instead of letting the
    // offscreen doc's broker handle its own messages.
    if (message.target === 'background' && message.type === 'script.host-request') {
      const request = message.request as ScriptHostRequest;
      handleScriptHostRequest(request)
        .then((response) => respond(response))
        .catch((err: Error) =>
          respond({ executionId: request.executionId, rpcId: request.rpcId, ok: false, error: err.message }),
        );
      return true;
    }

    // Sync + awareness wire channels — host-neutral dispatcher in
    // @openheaders/oracle/rpc. Returns null for unknown types so we fall
    // through to the table below.
    const syncResult = dispatchSyncRpc(message);
    if (syncResult !== null) {
      if (syncResult.kind === 'sync') {
        respond(syncResult.response);
        return undefined;
      }
      syncResult.promise
        .then((response) => respond(response))
        .catch((err: Error) => {
          logger.info('MessageHandler', `sync rpc rejected: ${err.message}`);
          respond({ ok: false, error: err.message });
        });
      return true;
    }

    const handler = registry[message.type as string];
    if (handler) {
      return handler({ message, sender, respond, ctx }) ? true : undefined;
    }

    // `proxy-*` is owned by another listener; stay quiet. Anything else is
    // genuinely unknown.
    if (typeof message.type === 'string' && message.type.startsWith('proxy-')) {
      return false;
    }
    logger.info('MessageHandler', 'Unknown message type:', message.type);
    return false;
  } catch (error) {
    logger.info('MessageHandler', 'Error handling message:', (error as Error).message);
    respond({ error: (error as Error).message });
    return true;
  }
}

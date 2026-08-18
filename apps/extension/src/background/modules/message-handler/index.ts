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
import { runtime } from '@utils/browser-runtime';
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

/**
 * The only RPC types a tab realm (content script / page context) may
 * send. Everything else on the surface is reserved for the extension's
 * own pages — popup, sidepanel, workbench, devtools, offscreen — whose
 * sender URL carries the extension origin. The handlers behind these
 * types already key on `sender.tab.id`; the gate formalizes which types
 * a tab may reach at all. (`oh-delay-bypass` is routed before this
 * dispatcher and is sender-scoped there.)
 */
const TAB_ORIGINATED_TYPES: ReadonlySet<string> = new Set([
  'tabFire',
  'tabResponseOverride',
  'tabRequestOverride',
  'tabMessageCapture',
  'perfResourceEntries',
  'getWorkspaceTabOrdinal',
]);

/** Lazy: `runtime.getURL` needs the extension context, absent in bare tests. */
let cachedOwnOriginPrefix: string | null = null;
function ownOriginPrefix(): string {
  if (cachedOwnOriginPrefix === null) cachedOwnOriginPrefix = runtime.getURL('');
  return cachedOwnOriginPrefix;
}

/**
 * Sender-context gate: a message from outside the extension origin
 * (any tab realm) may only use the tab-originated allowlist. Content
 * scripts run in pages the extension can't vouch for — without this
 * gate every RPC type would be reachable from any compromised page
 * realm. Extension-origin senders (chrome-extension:// /
 * moz-extension:// / safari-web-extension://) pass untouched.
 */
function senderMayDispatch(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): boolean {
  const senderUrl = sender.url ?? '';
  if (senderUrl.startsWith(ownOriginPrefix())) return true;
  return TAB_ORIGINATED_TYPES.has(message.type as string);
}

export function handleGeneralMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
  ctx: MessageHandlerContext,
): boolean | undefined {
  const respond = createSafeResponse(sendResponse);

  try {
    if (!senderMayDispatch(message, sender)) {
      logger.warn('MessageHandler', 'Dropped RPC from non-extension sender:', message.type, sender.url ?? '(no url)');
      return false;
    }

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

    // `proxy-*` is owned by another listener; stay quiet. `oh.updates.*`
    // and `oh.secrets.*` are host-optional RPCs the desktop answers but
    // this host doesn't — surfaces probe them first and fall back on the
    // rejection, so the miss is expected; log at debug. Anything else is
    // genuinely unknown.
    if (typeof message.type === 'string' && message.type.startsWith('proxy-')) {
      return false;
    }
    if (
      typeof message.type === 'string' &&
      (message.type.startsWith('oh.updates.') || message.type.startsWith('oh.secrets.'))
    ) {
      logger.debug('MessageHandler', 'Host-optional RPC not served here:', message.type);
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

/**
 * Renderer-side safety net for RPCs the desktop main hasn't implemented
 * yet.
 *
 * Stage 2's `dispatchSyncRpc` only covers the 22 sync+awareness channels;
 * anything else (entity CRUD, popup lifecycle, request-scripts review,
 * etc.) rejects with `desktop main: RPC '<name>' is not implemented`
 * until later commits lift more handlers out of the extension's
 * `message-handler.ts` and into `@openheaders/oracle/rpc`.
 *
 * Several `packages/ui` hooks fire these as `void hostBridge.call(...)`
 * without a `.catch()` — fine on the extension where the chrome adapter
 * always resolves, but unhandled rejections in DevTools on the desktop.
 *
 * This module installs a `window.addEventListener('unhandledrejection',
 * ...)` filter that:
 *   - Recognizes the "not implemented" error string (the only path
 *     `install-rpc-host.ts` produces it).
 *   - Logs each unique RPC name once at INFO (with the full error on
 *     the first occurrence), then `preventDefault()`s the console
 *     warning on subsequent ones.
 *   - Leaves every other rejection untouched — real bugs still surface.
 *
 * The whole module is inert once every non-sync RPC has a real desktop
 * implementation; delete this file when the rejection-dedup map stays
 * empty across a full app boot.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'DesktopRpcFallback';
const NOT_IMPLEMENTED_PREFIX = "desktop main: RPC '";
const NOT_IMPLEMENTED_SUFFIX = "' is not implemented";

const seenRpcNames = new Set<string>();

function extractRpcName(message: string): string | null {
  if (!message.startsWith(NOT_IMPLEMENTED_PREFIX)) return null;
  const after = message.slice(NOT_IMPLEMENTED_PREFIX.length);
  if (!after.endsWith(NOT_IMPLEMENTED_SUFFIX)) return null;
  return after.slice(0, after.length - NOT_IMPLEMENTED_SUFFIX.length);
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : null;
  if (!message) return;
  const rpcName = extractRpcName(message);
  if (!rpcName) return;

  event.preventDefault();
  if (seenRpcNames.has(rpcName)) return;
  seenRpcNames.add(rpcName);
  logger.info(SCOPE, `RPC '${rpcName}' not yet implemented on desktop — caller continues without it`);
});

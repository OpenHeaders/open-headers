/**
 * Tab-side safety net for RPCs the web host doesn't implement —
 * browser-integration channels (chrome.tabs, DNR, CDP, …) that only
 * the extension or desktop shells answer.
 *
 * Several `packages/ui` hooks fire RPCs as `void hostBridge.call(...)`
 * without a `.catch()` — fine on hosts whose adapter always resolves,
 * but unhandled rejections in DevTools here. This filter recognizes
 * the bridge's "not implemented" error string, logs each unique RPC
 * name once at INFO, and suppresses the console noise for repeats.
 * Every other rejection stays untouched — real bugs still surface.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { RPC_NOT_IMPLEMENTED_PREFIX, RPC_NOT_IMPLEMENTED_SUFFIX } from './install-host-bridge';

const SCOPE = 'WebRpcFallback';

const seenRpcNames = new Set<string>();

function extractRpcName(message: string): string | null {
  if (!message.startsWith(RPC_NOT_IMPLEMENTED_PREFIX)) return null;
  const after = message.slice(RPC_NOT_IMPLEMENTED_PREFIX.length);
  if (!after.endsWith(RPC_NOT_IMPLEMENTED_SUFFIX)) return null;
  return after.slice(0, after.length - RPC_NOT_IMPLEMENTED_SUFFIX.length);
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
  logger.info(SCOPE, `RPC '${rpcName}' not yet implemented on the web host — caller continues without it`);
});

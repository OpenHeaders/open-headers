/**
 * Web host RPC dispatch — the in-process "reactor" the host bridge
 * calls into. The tab oracle lives in the same JS context as the
 * Workbench, so dispatch is a function call: universal host RPCs
 * first, then the host-neutral sync + awareness channels via
 * {@link dispatchSyncRpc}, and a recognizable rejection for anything
 * only other hosts implement (chrome.tabs, DNR, CDP, …) so
 * fire-and-forget callers degrade quietly through the rpc-fallback
 * filter.
 */

import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import { callDaemonAdminRpc } from './wire-admin-rpc';

export const RPC_NOT_IMPLEMENTED_PREFIX = "web host: RPC '";
export const RPC_NOT_IMPLEMENTED_SUFFIX = "' is not implemented";

export async function dispatchWebRpc(raw: unknown): Promise<unknown> {
  const message = (raw ?? {}) as Record<string, unknown>;
  const type = message.type;

  if (type === 'getActiveWorkspaceId') {
    return { activeWorkspaceId: peekActiveWorkspaceId() };
  }
  if (type === 'getStatusSnapshot') {
    return { snapshot: getStatusSnapshot() };
  }
  // Daemon-admin channels are not the tab oracle's — they administer
  // the SERVING daemon, so they forward up the wire to its gated peer
  // admin plane and answer as the authenticated peer.
  if (typeof type === 'string' && type.startsWith('oh.daemon.')) {
    return callDaemonAdminRpc(message);
  }

  const result = dispatchSyncRpc(message);
  if (result === null) {
    throw new Error(`${RPC_NOT_IMPLEMENTED_PREFIX}${String(type)}${RPC_NOT_IMPLEMENTED_SUFFIX}`);
  }
  if (result.kind === 'sync') return result.response;
  return await result.promise;
}

/**
 * The daemon-side egress opt-in for sends a WS peer asks this host to
 * make — one gate for BOTH request families (the context sends of
 * `peer-requests-rpc.ts` and the delegated sends of
 * `delegated-requests-rpc.ts`). Two-tiered by the peer's loopback fact
 * and read fresh from the settings record per frame: same-device
 * browsers ride `backend.allowLocalPeerExecute` (default ON — the
 * user paired this browser to use this app as its engine, so pairing
 * is the consent), other devices ride `backend.allowRemotePeerExecute`
 * (default OFF — egress from this machine on another device's behalf
 * is an operator decision, never implied by pairing). The refusal is
 * honest (it names the tier), not the admin plane's uniform deny: the
 * channels' existence is public contract.
 */

import { LOCAL_PEER_EXECUTE_DISABLED_MESSAGE, REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { WsPeerRpcContext } from '../host-runtime/ws-server';

export async function peerExecuteAllowed(isLoopback: boolean): Promise<boolean> {
  const values = ((await hostStorage.get(OH.settingsUser)) ?? {}) as Record<string, unknown>;
  if (isLoopback) return values['backend.allowLocalPeerExecute'] !== false;
  return values['backend.allowRemotePeerExecute'] === true;
}

/** Refuse before any identity resolution — no capability decision is
 *  made, so no audit row (the MCP tier-gate precedent). */
export async function assertPeerExecuteAllowed(peer: WsPeerRpcContext): Promise<void> {
  const loopback = peer.isLoopback === true;
  if (!(await peerExecuteAllowed(loopback))) {
    throw new Error(loopback ? LOCAL_PEER_EXECUTE_DISABLED_MESSAGE : REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
  }
}

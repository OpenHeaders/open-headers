/**
 * Boot-time wiring: the web host bridge. The tab oracle runs IN this
 * tab, so `call` is a direct dispatch into {@link dispatchWebRpc} and
 * `subscribe` reads the same in-tab fan-out the oracle's host hooks
 * broadcast into — no transport in between.
 *
 * RPCs only other hosts implement reject with the recognizable
 * "not implemented" error; `install-rpc-fallback.ts` keeps the
 * fire-and-forget callers quiet. `presence` stays inert: the only
 * consumer is the extension popup surface, and surface liveness on
 * this host rides the awareness lifeline loopback instead.
 */

import {
  type BridgeBroadcastPayload,
  type BridgeBroadcastType,
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  type HostBridge,
  setHostBridge,
} from '@openheaders/core/bridge';
import { broadcastLocal, subscribeLocal } from './web-broadcast';
import { dispatchWebRpc } from './web-rpc-dispatch';

export { RPC_NOT_IMPLEMENTED_PREFIX, RPC_NOT_IMPLEMENTED_SUFFIX } from './web-rpc-dispatch';

const webBridge: HostBridge = {
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    const payload = (args[0] ?? {}) as Record<string, unknown>;
    return dispatchWebRpc({ type, ...payload }) as Promise<BridgeRpcResponse<K>>;
  },
  broadcast<K extends BridgeBroadcastType>(
    type: K,
    ...args: BridgeBroadcastPayload<K> extends Record<string, never> ? [] : [payload: BridgeBroadcastPayload<K>]
  ): void {
    // Surface-emitted broadcasts fan out to the other in-tab
    // subscribers on the same registry the host hooks publish into.
    broadcastLocal(String(type), args[0]);
  },
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    return subscribeLocal(String(subscribedType), (payload) => handler(payload as BridgeBroadcastPayload<K>));
  },
  presence(): () => void {
    return () => undefined;
  },
};

setHostBridge(webBridge);

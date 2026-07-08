/**
 * Boot-time wiring: the Phase-4a stub host bridge. The web tab has no
 * host reactor yet — Phase 4b brings the tab oracle (the reactor runs
 * IN the tab) and the WS client transport to the serving daemon.
 *
 * Until then every RPC rejects with a recognizable "not implemented"
 * error (`install-rpc-fallback.ts` keeps the fire-and-forget callers
 * quiet), broadcasts go nowhere, and subscriptions are inert. Snapshot
 * fetches in the shared mirrors resolve to nothing, so every surface
 * renders its honest empty state.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';

export const RPC_NOT_IMPLEMENTED_PREFIX = "web host: RPC '";
export const RPC_NOT_IMPLEMENTED_SUFFIX = "' is not implemented";

const stubBridge: HostBridge = {
  call(type, ..._args) {
    return Promise.reject(new Error(`${RPC_NOT_IMPLEMENTED_PREFIX}${String(type)}${RPC_NOT_IMPLEMENTED_SUFFIX}`));
  },
  broadcast() {
    // No reactor to fan out from; nothing listens yet.
  },
  subscribe() {
    return () => {};
  },
  presence() {
    return () => {};
  },
};

setHostBridge(stubBridge);

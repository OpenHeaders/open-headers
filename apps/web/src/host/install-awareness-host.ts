/**
 * Boot-time wiring: Phase-4a stubs for the awareness lifeline + peer
 * navigation seams.
 *
 * Lifeline: with no host reactor there is nothing to observe surface
 * lifecycles, so `connect` hands back an inert port (messages go
 * nowhere, disconnect is local). Phase 4b routes this over the tab
 * oracle's own lifeline server, exactly like the extension SW's ports.
 *
 * Peer navigator: a plain tab can't focus other surfaces; every handle
 * answers `canNavigate: false`, which surfaces the awareness pill's
 * "open peer surface unsupported" affordance.
 */

import {
  type LifelinePort,
  type LifelineTransport,
  type PeerNavigator,
  setLifelineTransport,
  setPeerNavigator,
} from '@openheaders/core/awareness';

const stubLifelineTransport: LifelineTransport = {
  connect(): LifelinePort {
    return {
      postMessage() {},
      onMessage() {},
      onDisconnect() {},
      disconnect() {},
    };
  },
};

const webPeerNavigator: PeerNavigator = {
  navigate() {
    return Promise.resolve(false);
  },
  canNavigate() {
    return false;
  },
};

setLifelineTransport(stubLifelineTransport);
setPeerNavigator(webPeerNavigator);

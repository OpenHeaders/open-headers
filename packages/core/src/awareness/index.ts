/**
 * Awareness host seams (`@openheaders/core/awareness`).
 *
 * Platform seams the awareness layer depends on: a renderer-side
 * long-lived liveness channel ({@link LifelineTransport}), its host-side
 * counterpart ({@link LifelineServer}), and a peer-surface navigator
 * ({@link PeerNavigator}). All default to graceful no-ops so an unwired
 * host stays functional — see each module for the contract.
 */

export {
  getLifelineServer,
  type IncomingLifelinePort,
  type LifelineServer,
  lifelineServer,
  setLifelineServer,
} from './lifeline-server';
export {
  getLifelineTransport,
  type LifelinePort,
  type LifelineTransport,
  lifelineTransport,
  setLifelineTransport,
} from './lifeline-transport';
export {
  getPeerNavigator,
  type PeerNavigator,
  peerNavigator,
  setPeerNavigator,
} from './peer-navigation';

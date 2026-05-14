/**
 * Awareness host seams (`@openheaders/core/awareness`).
 *
 * Two platform seams the renderer-side awareness UI depends on: a
 * long-lived liveness channel ({@link LifelineTransport}) and a
 * peer-surface navigator ({@link PeerNavigator}). Both default to
 * graceful no-ops so an unwired host stays functional — see each module
 * for the contract.
 */

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

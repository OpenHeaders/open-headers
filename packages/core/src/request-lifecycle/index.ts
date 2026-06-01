/**
 * Request lifecycle primitive — public surface for `@openheaders/core/request-lifecycle`.
 *
 * Engine modules import the types + invariant predicates from here. UI
 * modules import the wire-shaped `RequestLifecycleUpdate` to reduce
 * against. See `./types` for the eight invariants this primitive
 * embodies and `docs/REQUEST_LIFECYCLE_DESIGN.md` for the architecture.
 */

export type { RequestCorrelator, RequestLifecycleListener, Unsubscribe } from './correlator';
export type {
  InvariantAssertion,
  InvariantEntry,
  InvariantId,
  InvariantPending,
} from './invariant-registry';
export { REQUEST_LIFECYCLE_INVARIANTS } from './invariant-registry';
export {
  isPhaseAdvance,
  isRedirectReset,
  isTerminalPhase,
  lifecycleKey,
  patchRefines,
  refinesField,
  urlChain,
} from './invariants';
export type {
  RedirectHop,
  RequestError,
  RequestLifecycle,
  RequestLifecycleJsonSafeProof,
  RequestLifecyclePatch,
  RequestLifecycleUpdate,
  RequestPhase,
} from './types';
export type {
  LifecycleClearSessionMessage,
  LifecycleConsumerMessage,
  LifecycleSubscribeMessage,
  LifecycleWireMessage,
} from './wire';
export {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
} from './wire';

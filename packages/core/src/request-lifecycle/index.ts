/**
 * Request lifecycle primitive — public surface for `@openheaders/core/request-lifecycle`.
 *
 * Engine modules import the types + invariant predicates from here. UI
 * modules import the wire-shaped `RequestLifecycleUpdate` to reduce
 * against. See `./types` for the eight invariants this primitive
 * embodies and `docs/REQUEST_LIFECYCLE_DESIGN.md` for the architecture.
 */

export type {
  RedirectHop,
  RequestError,
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestLifecycleUpdate,
  RequestPhase,
} from './types';

export type { RequestCorrelator, RequestLifecycleListener, Unsubscribe } from './correlator';

export {
  isPhaseAdvance,
  isRedirectReset,
  isTerminalPhase,
  lifecycleKey,
  patchRefines,
  refinesField,
  urlChain,
} from './invariants';

export {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
} from './wire';
export type { LifecycleWireMessage } from './wire';

export { REQUEST_LIFECYCLE_INVARIANTS } from './invariant-registry';
export type {
  InvariantAssertion,
  InvariantEntry,
  InvariantId,
  InvariantPending,
} from './invariant-registry';

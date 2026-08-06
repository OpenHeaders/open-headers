/**
 * Request lifecycle primitive — public surface for `@openheaders/core/request-lifecycle`.
 *
 * Engine modules import the types + invariant predicates from here. UI
 * modules import the wire-shaped `RequestLifecycleUpdate` to reduce
 * against. See `./types` for the eight invariants this primitive
 * embodies and `docs/REQUEST_LIFECYCLE_DESIGN.md` for the architecture.
 */

export type { RequestCorrelator, RequestLifecycleListener, Unsubscribe } from './correlator';
export { deriveHopNetworkStartMs } from './derived-timing';
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
export { appendStreamMessage, appendStreamMessageCapture } from './stream-messages';
export type {
  InspectorOverrideBody,
  InspectorRequestSnapshot,
  InspectorResponseSnapshot,
  RedirectHop,
  RequestError,
  RequestLifecycle,
  RequestLifecycleJsonSafeProof,
  RequestLifecyclePatch,
  RequestLifecycleUpdate,
  RequestOverride,
  RequestPhase,
  ResponseOverride,
  SseStreamMessage,
  StreamMessage,
  StreamMessageCapture,
  WsStreamMessage,
} from './types';
export { MATERIAL_DEBUG_PAUSE_MS, MAX_STREAM_MESSAGES_PER_REQUEST } from './types';
export type {
  LifecycleClearSessionMessage,
  LifecycleConsumerMessage,
  LifecycleRequestBodyMessage,
  LifecycleSource,
  LifecycleSubscribeMessage,
  LifecycleWireMessage,
  QualifiedLifecyclePortTarget,
} from './wire';
export {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
  parseQualifiedLifecyclePortName,
  parseReplayLifecyclePortName,
  qualifiedLifecyclePortName,
  REPLAY_LIFECYCLE_PORT_PREFIX,
  replayLifecyclePortName,
} from './wire';

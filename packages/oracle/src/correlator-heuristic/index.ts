/**
 * `@openheaders/oracle/correlator-heuristic` — production implementation
 * of {@link RequestCorrelator} that projects webRequest- and HAR-shaped
 * events into lifecycle updates.
 *
 * No chrome dependency lives in this module. The chrome bindings are
 * the caller's responsibility: implement {@link WebRequestEventSource}
 * + {@link HarEventSource} and pass both to {@link HeuristicCorrelator}.
 * See `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

export { BodyJoinMap } from './body-join-map';
export type { CorrelatorDiagnostics, HeuristicCorrelatorSources } from './correlator';
export { HeuristicCorrelator } from './correlator';
export type { ClassifyCorsInput } from './cors-classifier';
export { classifyCors, extractHeader, isCrossOrigin } from './cors-classifier';
export type { CorsContextDropLogger, CorsContextDropReason } from './cors-context-store';
export { CorsContextStore } from './cors-context-store';
export { refineUpdateWithCors } from './cors-error-refinement';
export type {
  OnBeforeRedirectEvent,
  OnBeforeRequestEvent,
  OnCompletedEvent,
  OnErrorOccurredEvent,
  OnHeadersReceivedEvent,
  OnSendHeadersEvent,
  WebRequestEvent,
  WebRequestEventSource,
  WebRequestHeader,
} from './events';
export { FinalizedRetention } from './finalized-retention';
export type {
  HarBodyEvent,
  HarEntryEvent,
  HarEvent,
  HarEventSource,
  HarPresenceEvent,
  HarPresenceSource,
} from './har-events';
export {
  bodyAttachedUpdate,
  harAttachedUpdate,
  harEntryJoinFields,
  harEntryTimestamp,
  harOnlyLifecycleUpdates,
  hasHarFailureVerdict,
} from './har-to-update';
export type {
  ExpiredHarEntry,
  HarDrainResult,
  HarRetry,
  HarRetryMatch,
  HarWaitingDropLogger,
} from './har-waiting-buffer';
export { HarWaitingBuffer } from './har-waiting-buffer';
export type { HopCursorDropLogger, HopCursorDropReason } from './hop-cursor';
export { HopCursor } from './hop-cursor';
export type { FifoEvictionLogger, InFlightMatch } from './in-flight-fifo';
export { IN_FLIGHT_MAX_AGE_MS, InFlightFifo } from './in-flight-fifo';
export { FINALIZED_RETENTION_MS, HAR_FAILURE_HOLD_MS, HAR_FORWARD_HOLD_MS } from './late-arrival-constants';
export { MAX_PARTIAL_HAR_REQUESTS_PER_TAB, WebRequestHarBuilder } from './webrequest-har-builder';
export type { PartialHarResponse, PartialHarSeed, PartialHarTerminal } from './webrequest-har-synth';
export { partialHarEntry } from './webrequest-har-synth';
export { webRequestEventToUpdates } from './webrequest-to-update';

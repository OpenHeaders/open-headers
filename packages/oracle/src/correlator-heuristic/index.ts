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

export { HeuristicCorrelator } from './correlator';
export type { CorrelatorDiagnostics, HeuristicCorrelatorSources } from './correlator';
export { webRequestEventToUpdates } from './webrequest-to-update';
export { harAttachedUpdate, bodyAttachedUpdate, harEntryJoinFields, harEntryTimestamp } from './har-to-update';
export { InFlightFifo, IN_FLIGHT_MAX_AGE_MS } from './in-flight-fifo';
export type { FifoEvictionLogger, InFlightMatch } from './in-flight-fifo';
export { BodyJoinMap } from './body-join-map';
export { HarWaitingBuffer } from './har-waiting-buffer';
export type { HarDrainResult, HarRetry, HarRetryMatch, HarWaitingDropLogger } from './har-waiting-buffer';
export { HopCursor } from './hop-cursor';
export type { HopCursorDropLogger, HopCursorDropReason } from './hop-cursor';
export { FinalizedRetention } from './finalized-retention';
export { FINALIZED_RETENTION_MS, HAR_FORWARD_HOLD_MS } from './late-arrival-constants';
export { classifyCors, extractHeader, isCrossOrigin } from './cors-classifier';
export type { ClassifyCorsInput } from './cors-classifier';
export { CorsContextStore } from './cors-context-store';
export type { CorsContextDropLogger, CorsContextDropReason } from './cors-context-store';
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
export type {
  HarBodyEvent,
  HarEntryEvent,
  HarEvent,
  HarEventSource,
  HarPresenceEvent,
  HarPresenceSource,
} from './har-events';

/**
 * `@openheaders/oracle/correlator-heuristic` — production implementation
 * of {@link RequestCorrelator} that projects webRequest- and HAR-shaped
 * events into lifecycle updates.
 *
 * No chrome dependency lives in this module. The chrome bindings are
 * the caller's responsibility: implement {@link WebRequestEventSource}
 * + {@link HarEventSource} and pass both to {@link HeuristicCorrelator}.
 * See the request-lifecycle design §6.2.
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
  harEntryDurationMs,
  harEntryJoinFields,
  harEntryTimestamp,
  harOnlyLifecycleUpdates,
  hasHarFailureVerdict,
  isMemoryCacheHarEntry,
  memoryCacheHarLifecycleUpdates,
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
export { IN_FLIGHT_MAX_AGE_MS, InFlightFifo, SAME_URL_TIE_WINDOW_MS } from './in-flight-fifo';
export { FINALIZED_RETENTION_MS, HAR_FAILURE_HOLD_MS, HAR_FORWARD_HOLD_MS } from './late-arrival-constants';
export type { OverrideEvent, OverrideEventSource } from './override-events';
export type {
  ResourceTimingEvent,
  ResourceTimingEventSource,
  ResourceTimingSnapshotEvent,
} from './resource-timing-events';
export {
  MAX_PARTIAL_HAR_REQUESTS_PER_TAB,
  RT_JOIN_WINDOW_MS,
  RT_RETENTION_MS,
  WebRequestHarBuilder,
} from './webrequest-har-builder';
export type { PartialHarResponse, PartialHarSeed, PartialHarTerminal, PartialHarTiming } from './webrequest-har-synth';
export { partialHarEntry } from './webrequest-har-synth';
export type { FloorTimingFacts, InspectorHarTimings, ResourceTimingLegContext } from './webrequest-har-timings';
export { floorHarTimings, isResponseBodyIncomplete, resourceTimingHarTimings } from './webrequest-har-timings';
export { webRequestEventToUpdates } from './webrequest-to-update';

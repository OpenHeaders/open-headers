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
export type { HeuristicCorrelatorSources } from './correlator';
export { webRequestEventToUpdates } from './webrequest-to-update';
export { harAttachedUpdate, bodyAttachedUpdate, harEntryJoinFields, harEntryTimestamp } from './har-to-update';
export { InFlightFifo, IN_FLIGHT_MAX_AGE_MS, POP_FUTURE_SKEW_MS, MAX_IN_FLIGHT_URLS_PER_TAB } from './in-flight-fifo';
export type { FifoEvictionLogger } from './in-flight-fifo';
export { BodyJoinMap, MAX_BODY_JOIN_KEYS_PER_TAB } from './body-join-map';
export { HarWaitingBuffer } from './har-waiting-buffer';
export type { HarDrainResult, HarRetry, HarWaitingDropLogger } from './har-waiting-buffer';
export { FinalizedRetention } from './finalized-retention';
export { LATE_ARRIVAL_WINDOW_MS, MAX_HAR_WAITING_PER_TAB } from './late-arrival-constants';
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

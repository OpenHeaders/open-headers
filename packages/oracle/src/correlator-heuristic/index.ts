/**
 * `@openheaders/oracle/correlator-heuristic` — production implementation
 * of {@link RequestCorrelator} that projects webRequest-shaped events
 * into lifecycle updates.
 *
 * No chrome dependency lives in this module. The chrome binding is the
 * caller's responsibility: implement {@link WebRequestEventSource} and
 * pass it to {@link HeuristicCorrelator}. See
 * `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

export { HeuristicCorrelator } from './correlator';
export { webRequestEventToUpdates } from './webrequest-to-update';
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

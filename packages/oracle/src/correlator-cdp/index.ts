/**
 * `@openheaders/oracle/correlator-cdp` — production implementation of
 * {@link RequestCorrelator} backed by a {@link CdpEventSource}.
 *
 * No chrome dependency lives here: implement {@link CdpEventSource} from
 * `chrome.debugger.onEvent` and pass it to {@link CdpCorrelator}. The
 * correlator owns a {@link CdpHarBuilder} that synthesizes per-hop
 * `InspectorHarEntry`s across the multi-event CDP request lifecycle.
 *
 * See `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2 and
 * `docs/CDP_INSPECTION_PLAN.md`.
 */

export { CDP_HAR_RETENTION_MS, CdpHarBuilder, MAX_CDP_HAR_REQUESTS_PER_TAB } from './cdp-har-builder';
export type { HarTimings } from './cdp-har-synth';
export {
  cdpRequestToHar,
  cdpResponseToHar,
  cdpTimingToHar,
  headerRecordToHar,
  parseRequestCookies,
  parseResponseCookies,
  queryStringFromUrl,
  totalTimeMs,
  wallTimeToIso,
} from './cdp-har-synth';
export { cdpEventToUpdates } from './cdp-to-update';
export { CdpCorrelator } from './correlator';
export type {
  CdpEventSource,
  CdpInitiator,
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpNetworkEvent,
  CdpRequestParams,
  CdpRequestWillBeSent,
  CdpResourceTiming,
  CdpResponseParams,
  CdpResponseReceived,
} from './events';
export { cdpStoreRequestId } from './events';

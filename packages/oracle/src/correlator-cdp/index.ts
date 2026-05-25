/**
 * `@openheaders/oracle/correlator-cdp` — typechecked-only second
 * implementation of {@link RequestCorrelator}.
 *
 * Exists to enforce the correlation seam is real. See
 * `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

export { cdpEventToUpdates } from './cdp-to-update';
export { CdpCorrelatorStub, NotImplementedError } from './correlator';
export type {
  CdpEventSource,
  CdpInitiator,
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpNetworkEvent,
  CdpRequestParams,
  CdpRequestWillBeSent,
  CdpResponseParams,
  CdpResponseReceived,
} from './events';

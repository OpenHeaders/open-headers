/**
 * `@openheaders/oracle/correlator-cdp` — typechecked-only second
 * implementation of {@link RequestCorrelator}. Types-only public surface;
 * the stub + projector are deep-imported by tests to enforce the seam.
 *
 * See `docs/REQUEST_LIFECYCLE_DESIGN.md` §6.2.
 */

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

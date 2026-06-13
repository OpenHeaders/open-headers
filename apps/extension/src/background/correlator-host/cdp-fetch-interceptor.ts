/**
 * The inbound edge of the Phase-D control loop: subscribe to the
 * {@link CdpFetchEvent} control-input stream and answer each
 * `Fetch.requestPaused` through the {@link CdpRequestControlPort}.
 *
 * D1 skeleton — PASS-THROUGH. Every paused request is `continueRequest`'d
 * unmodified, so an armed tab's matching traffic flows exactly as if it were
 * never paused; this proves the pause→answer loop end to end without
 * touching any request. D2 swaps the pass-through for rule-driven
 * fulfill / rewrite (and the full-condition re-check the coarse `urlPattern`
 * pre-filter defers to).
 *
 * Fire-and-forget: a failed answer (the request already gone, the tab
 * detached) is logged and dropped — it must never throw into the event fan.
 */

import type { CdpFetchEvent, CdpRequestControlPort } from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';

export interface CdpFetchInterceptorOptions {
  /** The `Fetch.*` control-input stream — `ChromeDebuggerEventSource.subscribeFetch`. */
  readonly subscribeFetch: (listener: (event: CdpFetchEvent) => void) => () => void;
  /** The imperative per-paused-request port. */
  readonly requestControlPort: CdpRequestControlPort;
}

/** Start the pass-through interceptor; returns the unsubscribe handle. */
export function startCdpFetchInterceptor(options: CdpFetchInterceptorOptions): () => void {
  const { subscribeFetch, requestControlPort } = options;
  return subscribeFetch((event) => {
    if (event.method !== 'Fetch.requestPaused') return;
    void requestControlPort
      .continueRequest({ tabId: event.tabId, sessionId: event.sessionId }, { requestId: event.requestId })
      .catch((err: unknown) => {
        logger.debug('CdpFetchInterceptor', 'continueRequest failed', {
          tabId: event.tabId,
          requestId: event.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  });
}

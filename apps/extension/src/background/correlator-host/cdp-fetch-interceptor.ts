/**
 * The inbound edge of the Phase-D control loop: subscribe to the
 * {@link CdpFetchEvent} control-input stream and answer each
 * `Fetch.requestPaused` through the {@link CdpRequestControlPort}.
 *
 * D2 — rule-driven. {@link resolveFetchReaction} re-checks the paused
 * request against the live rules (the `Fetch.enable` `urlPattern` set was
 * only a coarse pre-filter) and decides the answer:
 *   - a static `mock` match → `fulfillRequest` (synthesized response);
 *   - a static `body` match → `continueRequest` with a rewritten request
 *     body (`postData`);
 *   - anything else → `continueRequest` pass-through (nothing modified).
 * A fulfilled / rewritten request enters the rule-fire plane as an
 * AUTHORITATIVE fire — reported only after the answer command lands, so a
 * fire means the action actually ran.
 *
 * Fire-and-forget: a failed answer (the request already gone, the tab
 * detached) is logged and dropped — it must never throw into the event fan.
 */

import type { RequestRecord, Rule } from '@openheaders/core/types';
import type {
  CdpFetchEvent,
  CdpRequestControlPort,
  CdpRequestPaused,
  CdpSessionTarget,
} from '@openheaders/oracle/correlator-cdp';
import { cdpStoreRequestId } from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import { cdpResourceTypeToTracked, resolveFetchReaction } from './cdp-fetch-reaction';

export interface CdpFetchInterceptorOptions {
  /** The `Fetch.*` control-input stream — `ChromeDebuggerEventSource.subscribeFetch`. */
  readonly subscribeFetch: (listener: (event: CdpFetchEvent) => void) => () => void;
  /** The imperative per-paused-request port. */
  readonly requestControlPort: CdpRequestControlPort;
  /** The live, already-effective rules to match a paused request against. */
  readonly getRules: () => readonly Rule[];
  /** Report an authoritative fire (fulfill / rewrite) into the rule-fire plane. */
  readonly reportFire: (tabId: number, record: RequestRecord) => void;
}

/** Start the rule-driven interceptor; returns the unsubscribe handle. */
export function startCdpFetchInterceptor(options: CdpFetchInterceptorOptions): () => void {
  const { subscribeFetch, requestControlPort, getRules, reportFire } = options;
  return subscribeFetch((event) => {
    if (event.method !== 'Fetch.requestPaused') return;
    const target: CdpSessionTarget = { tabId: event.tabId, sessionId: event.sessionId };
    const reaction = resolveFetchReaction(event, getRules());

    if (reaction.kind === 'pass-through') {
      answer(requestControlPort.continueRequest(target, { requestId: event.requestId }), event);
      return;
    }

    const fire = () => reportFire(event.tabId, buildFireRecord(event, reaction.ruleUid));
    const command =
      reaction.kind === 'fulfill'
        ? requestControlPort.fulfill(target, reaction.response)
        : requestControlPort.continueRequest(target, reaction.request);
    answer(command.then(fire), event);
  });
}

/** Swallow + log an answer failure so it never throws into the event fan. */
function answer(command: Promise<void>, event: CdpRequestPaused): void {
  void command.catch((err: unknown) => {
    logger.debug('CdpFetchInterceptor', 'answer failed', {
      tabId: event.tabId,
      requestId: event.requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function buildFireRecord(event: CdpRequestPaused, ruleUid: string): RequestRecord {
  return {
    ruleUid,
    url: event.request.url,
    pattern: '',
    resourceType: cdpResourceTypeToTracked(event.resourceType),
    t: Date.now(),
    evidence: 'confirmed',
    // Session-namespaced CDP id — the lifecycle row's key on the CDP path.
    ...(event.networkId ? { requestId: cdpStoreRequestId(event.sessionId, event.networkId) } : {}),
  };
}

/**
 * The inbound edge of the Phase-D control loop: subscribe to the
 * {@link CdpFetchEvent} control-input stream and answer each
 * `Fetch.requestPaused` through the {@link CdpRequestControlPort}.
 *
 * Rule-driven, two interception stages:
 *   - REQUEST stage ({@link resolveFetchReaction}) — a static `mock` match →
 *     `fulfillRequest`; a static `request-body` match → `continueRequest`
 *     with a rewritten body; a static `network`-source `response` match →
 *     `continueRequest{interceptResponse:true}` (send the real request, pause
 *     again at the Response stage); anything else → pass-through.
 *   - RESPONSE stage ({@link resolveResponseReaction}) — reached only for an
 *     intercepted reply; `fulfillRequest`s the rule's static body over the
 *     real status/headers, or `continueResponse`s it unmodified when no rule
 *     still matches.
 * A fulfilled / rewritten request enters the rule-fire plane as an
 * AUTHORITATIVE fire — reported only after the answer command lands (for a
 * `network`-source rule, that is the Response-stage fulfill, NOT the
 * request-stage continue), so a fire means the action actually ran once.
 *
 * Fire-and-forget: a failed answer (the request already gone, the tab
 * detached) is logged and dropped — it must never throw into the event fan.
 */

import { MATERIAL_DEBUG_PAUSE_MS } from '@openheaders/core/request-lifecycle';
import type { RequestRecord, Rule } from '@openheaders/core/types';
import type {
  CdpAuthRequired,
  CdpFetchEvent,
  CdpRequestControlPort,
  CdpRequestPaused,
  CdpSessionTarget,
} from '@openheaders/oracle/correlator-cdp';
import { cdpStoreRequestId } from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import {
  cdpResourceTypeToTracked,
  resolveAuthReaction,
  resolveFetchReaction,
  resolveResponseReaction,
} from './cdp-fetch-reaction';

export interface CdpFetchInterceptorOptions {
  /** The `Fetch.*` control-input stream — `ChromeDebuggerEventSource.subscribeFetch`. */
  readonly subscribeFetch: (listener: (event: CdpFetchEvent) => void) => () => void;
  /** The imperative per-paused-request port. */
  readonly requestControlPort: CdpRequestControlPort;
  /** The live, already-effective rules to match a paused request against. */
  readonly getRules: () => readonly Rule[];
  /** Report an authoritative fire (fulfill / rewrite) into the rule-fire plane. */
  readonly reportFire: (tabId: number, record: RequestRecord) => void;
  /**
   * Record the CDP `Fetch` interception hold (ms) for a paused request onto
   * its lifecycle — the control-plane → observation seam (D4c). `requestId`
   * is the store join key ({@link cdpStoreRequestId}); the host applies it as
   * a `pausedByDebugMs` phase patch. Only called for a material hold on a
   * request that carries a `networkId`.
   */
  readonly reportPause: (tabId: number, requestId: string, pausedMs: number) => void;
}

/**
 * Cap on in-flight `await-response` holds — a backstop against leaking a hold
 * whose Response stage never arrives (the request was aborted mid-flight).
 * Far above any realistic concurrent intercepted-reply count.
 */
const MAX_PENDING_RESPONSE_HOLDS = 1024;

/** Start the rule-driven interceptor; returns the unsubscribe handle. */
export function startCdpFetchInterceptor(options: CdpFetchInterceptorOptions): () => void {
  const { subscribeFetch } = options;
  // Request-stage holds for `await-response` requests, awaiting their Response
  // stage so the emitted `pausedByDebugMs` sums BOTH hops (the real server
  // round-trip between them is not debug overhead). Keyed by the store id.
  const pendingHolds = new Map<string, number>();
  return subscribeFetch((event) => {
    if (event.method === 'Fetch.authRequired') {
      handleAuthRequired(event, options);
      return;
    }
    if (event.method !== 'Fetch.requestPaused') return;
    if (isResponseStagePause(event)) {
      handleResponseStage(event, options, pendingHolds);
      return;
    }
    handleRequestStage(event, options, pendingHolds);
  });
}

/** A Response-stage pause carries the real reply (or its network-error reason). */
function isResponseStagePause(event: CdpRequestPaused): boolean {
  return event.responseStatusCode !== undefined || event.responseErrorReason !== undefined;
}

/**
 * Answer a REQUEST-stage pause. A static `mock` / `request-body` match fulfills
 * / rewrites and fires here; a `network`-source match continues with
 * `interceptResponse` and DEFERS its fire to the Response stage (recording the
 * request-stage hold so the two hops add up); anything else passes through.
 *
 * Pause-receipt stamp (D4c): the hold we introduce is this instant to
 * answer-land. Every paused request on a controlled tab incurs it —
 * pass-through included, since even a no-op continue paid the SW round-trip.
 */
function handleRequestStage(
  event: CdpRequestPaused,
  options: CdpFetchInterceptorOptions,
  pendingHolds: Map<string, number>,
): void {
  const { requestControlPort, getRules, reportFire, reportPause } = options;
  const receivedAtMs = Date.now();
  const target: CdpSessionTarget = { tabId: event.tabId, sessionId: event.sessionId };
  const reaction = resolveFetchReaction(event, getRules());

  if (reaction.kind === 'await-response') {
    const settled = requestControlPort.continueRequest(target, reaction.request).then(() => {
      // Carry the request-stage hold to the Response stage; the fire waits
      // until the reply is actually fulfilled there.
      if (event.networkId) {
        rememberHold(pendingHolds, cdpStoreRequestId(event.sessionId, event.networkId), Date.now() - receivedAtMs);
      }
    });
    answer(settled, event);
    return;
  }

  const command =
    reaction.kind === 'fulfill'
      ? requestControlPort.fulfill(target, reaction.response)
      : reaction.kind === 'continue'
        ? requestControlPort.continueRequest(target, reaction.request)
        : requestControlPort.continueRequest(target, { requestId: event.requestId });

  const settled = command.then(() => {
    if (reaction.kind !== 'pass-through') reportFire(event.tabId, buildFireRecord(event, reaction.ruleUid));
    emitPauseIfMaterial(event, receivedAtMs, 0, reportPause);
  });
  answer(settled, event);
}

/**
 * Answer a RESPONSE-stage pause (reached only via an `await-response`
 * continue). Fulfill the matching `network`-source static rule with its body +
 * merged overrides and fire once; a no-longer-matching rule releases the reply
 * unmodified. The emitted hold sums the request-stage + response-stage holds.
 */
function handleResponseStage(
  event: CdpRequestPaused,
  options: CdpFetchInterceptorOptions,
  pendingHolds: Map<string, number>,
): void {
  const { requestControlPort, getRules, reportFire, reportPause } = options;
  const receivedAtMs = Date.now();
  const target: CdpSessionTarget = { tabId: event.tabId, sessionId: event.sessionId };
  const reaction = resolveResponseReaction(event, getRules());

  const command =
    reaction.kind === 'fulfill'
      ? requestControlPort.fulfill(target, reaction.response)
      : requestControlPort.continueResponse(target, { requestId: event.requestId });

  const settled = command.then(() => {
    if (reaction.kind === 'fulfill') reportFire(event.tabId, buildFireRecord(event, reaction.ruleUid));
    const priorHoldMs = event.networkId
      ? takeHold(pendingHolds, cdpStoreRequestId(event.sessionId, event.networkId))
      : 0;
    emitPauseIfMaterial(event, receivedAtMs, priorHoldMs, reportPause);
  });
  answer(settled, event);
}

/**
 * Emit the interception hold for a paused request once its answer has landed.
 * `priorHoldMs` adds any earlier-stage hold (the request stage of a two-stage
 * `network`-source request) so the total is per-request, not per-stage. Skips
 * a request with no `networkId` (no lifecycle to join the hold to — the same
 * carve-out as the fire record) and an immaterial sub-{@link
 * MATERIAL_DEBUG_PAUSE_MS} total (not worth a store patch). The store applies
 * it as a refining `pausedByDebugMs` phase patch keyed by {@link cdpStoreRequestId}.
 */
function emitPauseIfMaterial(
  event: CdpRequestPaused,
  receivedAtMs: number,
  priorHoldMs: number,
  reportPause: (tabId: number, requestId: string, pausedMs: number) => void,
): void {
  if (!event.networkId) return;
  const pausedMs = priorHoldMs + (Date.now() - receivedAtMs);
  if (pausedMs < MATERIAL_DEBUG_PAUSE_MS) return;
  reportPause(event.tabId, cdpStoreRequestId(event.sessionId, event.networkId), pausedMs);
}

/** Record a request-stage hold, evicting the oldest if the map is at its cap. */
function rememberHold(pending: Map<string, number>, key: string, holdMs: number): void {
  if (pending.size >= MAX_PENDING_RESPONSE_HOLDS) {
    const oldest = pending.keys().next().value;
    if (oldest !== undefined) pending.delete(oldest);
  }
  pending.set(key, holdMs);
}

/** Take (and clear) a recorded request-stage hold, or 0 if none was kept. */
function takeHold(pending: Map<string, number>, key: string): number {
  const holdMs = pending.get(key) ?? 0;
  pending.delete(key);
  return holdMs;
}

/**
 * Answer a second-stage auth challenge (D3): resolve the matching auth
 * rule's credentials and reply `ProvideCredentials`, or `Default` when no
 * rule owns the challenge (the browser then runs its native flow). A
 * provided answer reports an authoritative fire — only after the command
 * lands. Credentials never enter the fire record nor any log line.
 */
function handleAuthRequired(event: CdpAuthRequired, options: CdpFetchInterceptorOptions): void {
  const { requestControlPort, getRules, reportFire } = options;
  const target: CdpSessionTarget = { tabId: event.tabId, sessionId: event.sessionId };
  const reaction = resolveAuthReaction(event, getRules());

  if (reaction.kind === 'default') {
    answer(
      requestControlPort.continueWithAuth(target, {
        requestId: event.requestId,
        authChallengeResponse: { response: 'Default' },
      }),
      event,
    );
    return;
  }

  const command = requestControlPort.continueWithAuth(target, {
    requestId: event.requestId,
    authChallengeResponse: { response: 'ProvideCredentials', username: reaction.username, password: reaction.password },
  });
  const fire = () => reportFire(event.tabId, buildAuthFireRecord(event, reaction.ruleUid));
  answer(command.then(fire), event);
}

/** Swallow + log an answer failure so it never throws into the event fan. */
function answer(command: Promise<void>, event: CdpRequestPaused | CdpAuthRequired): void {
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

/** Fire record for an answered auth challenge. Carries no credentials — the
 *  auth event has no `networkId`, so no lifecycle id is attached either. */
function buildAuthFireRecord(event: CdpAuthRequired, ruleUid: string): RequestRecord {
  return {
    ruleUid,
    url: event.request.url,
    pattern: '',
    resourceType: cdpResourceTypeToTracked(event.resourceType),
    t: Date.now(),
    evidence: 'confirmed',
  };
}

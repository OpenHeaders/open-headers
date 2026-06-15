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
import { cdpResourceTypeToTracked, resolveAuthReaction, resolveFetchReaction } from './cdp-fetch-reaction';

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

/** Start the rule-driven interceptor; returns the unsubscribe handle. */
export function startCdpFetchInterceptor(options: CdpFetchInterceptorOptions): () => void {
  const { subscribeFetch, requestControlPort, getRules, reportFire, reportPause } = options;
  return subscribeFetch((event) => {
    if (event.method === 'Fetch.authRequired') {
      handleAuthRequired(event, options);
      return;
    }
    if (event.method !== 'Fetch.requestPaused') return;
    // Pause-receipt stamp (D4c). The hold we introduce is this instant to
    // answer-land (the control command resolving). Every paused request on a
    // controlled tab incurs the hold — pass-through included, since even a
    // no-op continue paid the SW round-trip — so all three answers measure it.
    const receivedAtMs = Date.now();
    const target: CdpSessionTarget = { tabId: event.tabId, sessionId: event.sessionId };
    const reaction = resolveFetchReaction(event, getRules());

    const command =
      reaction.kind === 'fulfill'
        ? requestControlPort.fulfill(target, reaction.response)
        : reaction.kind === 'continue'
          ? requestControlPort.continueRequest(target, reaction.request)
          : requestControlPort.continueRequest(target, { requestId: event.requestId });

    const settled = command.then(() => {
      if (reaction.kind !== 'pass-through') reportFire(event.tabId, buildFireRecord(event, reaction.ruleUid));
      emitPauseIfMaterial(event, receivedAtMs, reportPause);
    });
    answer(settled, event);
  });
}

/**
 * Emit the interception hold for a paused request once its answer has landed.
 * Skips a request with no `networkId` (no lifecycle to join the hold to — the
 * same carve-out as the fire record) and an immaterial sub-{@link
 * MATERIAL_DEBUG_PAUSE_MS} hold (not worth a store patch). The store applies it
 * as a refining `pausedByDebugMs` phase patch keyed by {@link cdpStoreRequestId}.
 */
function emitPauseIfMaterial(
  event: CdpRequestPaused,
  receivedAtMs: number,
  reportPause: (tabId: number, requestId: string, pausedMs: number) => void,
): void {
  if (!event.networkId) return;
  const pausedMs = Date.now() - receivedAtMs;
  if (pausedMs < MATERIAL_DEBUG_PAUSE_MS) return;
  reportPause(event.tabId, cdpStoreRequestId(event.sessionId, event.networkId), pausedMs);
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

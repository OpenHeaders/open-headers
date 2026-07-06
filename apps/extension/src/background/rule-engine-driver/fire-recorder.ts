/**
 * Fire Recorder — given an observed URL and its identifying context,
 * runs the rule matcher and shadow arbitrator and forwards each winning
 * rule to tab-telemetry as an observed fire. Tab tracking and dedupe
 * are tab-telemetry's responsibility; this module just composes the
 * matcher + arbitrator pipeline.
 *
 * Matches are intersected with the engine's effective-uid set before
 * arbitration: a rule that matches the URL but has no live artifact in
 * the engine (engine paused, pause-marked, unpublished draft, dropped
 * over the rule cap) did not act on the request and must not claim a
 * fire — nor shadow a rule that did.
 *
 * Response-gated rules (response-header conditions) get a deferred
 * judgment: their observation parks here until the reply's headers
 * arrive (`judgeResponseGatedCandidates`, driven by the lifecycle
 * subscription's headers-received phase), where the gate is judged the
 * same way Chrome judges it — promote with the original observation's
 * timestamp, or drop.
 */

import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import type { TrackedResourceType } from '@/types/browser';
import { getEffectiveFireUids, isDelayRedelivery } from '../dnr-manager';
import { doesResponseHeaderGateApprove, matchRulesToRequest } from '../modules/request-tracker';
import {
  type ArbitratedRule,
  arbitrateWithStrategy,
  type ShadowAttribution,
} from '../modules/rules/shadow-arbitration';
import { isTracked as isTabTracked, recordObservedFire, recordReportedFire } from '../modules/tab-telemetry';
import { isTrackableUrl, normalizeUrlForTracking } from '../modules/url-utils';

export interface FireRecorderInput {
  tabId: number;
  url: string;
  requestId: string;
  timestampMs: number;
  resourceType: TrackedResourceType;
  method?: string;
  /** Request initiator origin, when the observation carries one. */
  initiator?: string;
}

/**
 * Observations whose live match set contained a response-gated rule,
 * parked until the response headers arrive and the gate becomes
 * judgeable. Keyed per `(tabId, requestId)`; a redirect hop's
 * re-observation replaces the prior hop's park (each hop's reply judges
 * its own). Only the observation input is held — the match is re-run
 * live at the header moment, so nothing here caches rule state. Bounded
 * drop-oldest as a backstop against requests whose headers never arrive
 * on a tab that never navigates.
 */
const parkedObservations = new Map<string, FireRecorderInput>();
const MAX_PARKED_OBSERVATIONS = 512;

function parkedKey(tabId: number, requestId: string): string {
  return `${tabId}:${requestId}`;
}

export function recordFiresForObservation(input: FireRecorderInput): void {
  if (input.tabId === -1 || !isTabTracked(input.tabId)) return;
  if (!isTrackableUrl(input.url)) return;
  // delay.html redelivering a held navigation is the same logical request
  // the rules already attributed on the first observation — except for
  // main frames, where the first observation's commit never lands and the
  // redelivery is the attribution carrier (see isDelayRedelivery).
  if (input.resourceType !== 'main_frame' && isDelayRedelivery(input.tabId, input.url)) return;
  const normalized = normalizeUrlForTracking(input.url);
  const matches = matchRulesToRequest(normalized, {
    method: input.method,
    resourceType: input.resourceType,
    initiator: input.initiator,
  });
  if (matches.length === 0) return;
  const effective = getEffectiveFireUids();
  const live = effective === null ? matches : matches.filter((m) => effective.has(m.uid));
  if (live.length === 0) return;
  // Response-gated rules are unjudgeable until the reply arrives — park
  // the observation so judgeResponseGatedCandidates can settle them at
  // the headers-received moment (promote with THIS observation's
  // timestamp, or drop).
  if (live.some((m) => m.responseGated && !m.contentGated)) {
    if (parkedObservations.size >= MAX_PARKED_OBSERVATIONS) {
      const oldest = parkedObservations.keys().next().value;
      if (oldest !== undefined) parkedObservations.delete(oldest);
    }
    parkedObservations.set(parkedKey(input.tabId, input.requestId), input);
  }
  // Content-gated rules (GraphQL operation filters) decline non-matching
  // operations on the same URL, so a URL-only observation proves nothing —
  // they neither claim observed fires NOR shadow other rules here (a shadow
  // claim needs proof the shadower acted; only their wrapper report has it).
  // Response-gated rules are excluded for the same law at a different
  // moment: their gate is judged by Chrome only when the reply arrives.
  const arbitrable = live.filter((m) => !m.contentGated && !m.responseGated);
  if (arbitrable.length === 0) return;
  const arbitrated = arbitrateWithStrategy(arbitrable, getSetting('rulesEngine.evaluationStrategy'));
  for (const r of arbitrated) {
    recordArbitratedFire(input, normalized, r);
  }
}

/**
 * Record one arbitrated rule against an observation, applying the
 * per-type action gates (which rule types can claim an observed fire on
 * which resource types). Shared by the observation path and the
 * response-gated judgment path so an approved candidate flows through
 * the identical laws.
 */
function recordArbitratedFire(input: FireRecorderInput, normalizedUrl: string, r: ArbitratedRule): void {
  // ws/sse rules act per EVENT through the in-page wrapper relay — the
  // network layer merely observing the stream request is not an action
  // (a drop rule on a stream with no matching frames did nothing), and
  // the observation often lands at stream close, past any suppression
  // window. The wrapper relay is their only fire source
  // (evidence=confirmed).
  if (r.type === 'ws' || r.type === 'sse') return;
  // Delay acts on frames through the DNR waiting page and on fetch/XHR
  // through the wrapper (which reports its own confirmed fires). A
  // sub-resource observation with no wrapper report means the delay had
  // no handle on the request (streams, images, EventSource) — not an act.
  if (r.type === 'delay' && input.resourceType !== 'main_frame' && input.resourceType !== 'sub_frame') return;
  // Inject acts exactly once per document — inject-manager mounts it on
  // the frameId-0 commit and nowhere else. A sub-resource that happens
  // to match the rule's URL pattern (the page's own module script is
  // the classic case) was never acted on, and inject has no wrapper
  // report to correct the record, so the fallback buffer would promote
  // the false fire unchallenged.
  if (r.type === 'inject' && input.resourceType !== 'main_frame') return;
  recordObservedFire(input.tabId, r.uid, normalizedUrl, input.requestId, input.timestampMs, {
    resourceType: input.resourceType,
    pattern: r.pattern,
    deferred: r.deferred,
    shadowedBy: r.shadowedBy,
    // Inject's act happens strictly AFTER the commit; a main-frame
    // navigation that fails never commits, so its buffered record must
    // be dropped on error, not promoted (see onMainFrameError).
    commitGated: r.type === 'inject',
  });
}

/**
 * Judge a parked observation against the response headers that actually
 * arrived — the moment Chrome evaluates response-header conditions. The
 * match is re-run live (nothing was cached from observation time); each
 * response-gated rule's gate is checked against the headers, and only
 * approved rules record — with the ORIGINAL observation timestamp and
 * `matched` evidence. Main-frame approvals flow into the normal
 * pending-fires commit buffer (headers precede the commit, so ordering
 * holds); sub-resources append immediately. Shadow verdicts are
 * recomputed at approval with the approved rules included — an
 * unapproved response-gated rule never claims a fire and never shadows.
 */
export function judgeResponseGatedCandidates(
  tabId: number,
  requestId: string,
  headers: readonly { name: string; value: string }[],
): void {
  const input = parkedObservations.get(parkedKey(tabId, requestId));
  if (input === undefined) return;
  parkedObservations.delete(parkedKey(tabId, requestId));
  if (!isTabTracked(tabId)) return;
  const normalized = normalizeUrlForTracking(input.url);
  const matches = matchRulesToRequest(normalized, {
    method: input.method,
    resourceType: input.resourceType,
    initiator: input.initiator,
  });
  const effective = getEffectiveFireUids();
  const live = effective === null ? matches : matches.filter((m) => effective.has(m.uid));
  const approved = live.filter(
    (m) => m.responseGated && !m.contentGated && doesResponseHeaderGateApprove(m.uid, headers),
  );
  if (approved.length === 0) return;
  const approvedUids = new Set(approved.map((m) => m.uid));
  // Arbitrate the approved rules against the request's proven actors —
  // the never-gated arbitrable set plus every approved gated rule. The
  // never-gated rules' own records were already written at observation
  // time; only the approved gated rules record here.
  const pool = live.filter((m) => (!m.contentGated && !m.responseGated) || approvedUids.has(m.uid));
  const arbitrated = arbitrateWithStrategy(pool, getSetting('rulesEngine.evaluationStrategy'));
  for (const r of arbitrated) {
    if (!approvedUids.has(r.uid)) continue;
    recordArbitratedFire(input, normalized, r);
  }
}

/**
 * Drop a parked observation whose response never arrived — a failed
 * request leaves the gate unjudged, and an unjudged response-gated rule
 * never claims a fire.
 */
export function dropResponseGatedCandidates(tabId: number, requestId: string): void {
  parkedObservations.delete(parkedKey(tabId, requestId));
}

/** Tab teardown — drop every parked observation for the tab. */
export function dropResponseGatedTab(tabId: number): void {
  const prefix = `${tabId}:`;
  for (const key of parkedObservations.keys()) {
    if (key.startsWith(prefix)) parkedObservations.delete(key);
  }
}

/** Reset the park buffer — test-only. */
export function __resetFireRecorderForTests(): void {
  parkedObservations.clear();
}

/**
 * Record a wrapper-reported (fire-bridge / CDP binding) fire, annotated
 * with the arbitration verdict for the reporting rule. The wrapper report
 * proves the rule RAN (evidence=confirmed), but arbitration still decides
 * whether another rule mooted its effect — a request-body rewrite on a
 * request a mock response rule answered never reaches any wire. The
 * verdict only annotates; it never gates the fire.
 */
export function recordFiresForReport(tabId: number, ruleUid: string, url: string, timestampMs: number): void {
  const shadowedBy = isTabTracked(tabId) ? computeReportShadow(ruleUid, url) : undefined;
  recordReportedFire(tabId, ruleUid, url, timestampMs, shadowedBy);
}

function computeReportShadow(ruleUid: string, url: string): ShadowAttribution | undefined {
  if (!isTrackableUrl(url)) return undefined;
  const matches = matchRulesToRequest(normalizeUrlForTracking(url));
  if (matches.length === 0) return undefined;
  const effective = getEffectiveFireUids();
  const live = effective === null ? matches : matches.filter((m) => effective.has(m.uid));
  // A content-gated rule other than the reporter proves nothing at URL
  // level (its filter may have declined this operation) — it cannot
  // shadow the rule that demonstrably acted. Response-gated rules are
  // excluded for the same reason (their gate is unjudged here). The
  // reporter itself stays: its report IS the proof it acted.
  const arbitrable = live.filter((m) => (!m.contentGated && !m.responseGated) || m.uid === ruleUid);
  const arbitrated = arbitrateWithStrategy(arbitrable, getSetting('rulesEngine.evaluationStrategy'));
  return arbitrated.find((r) => r.uid === ruleUid)?.shadowedBy;
}

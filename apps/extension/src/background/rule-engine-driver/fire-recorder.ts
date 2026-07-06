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
 */

import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import type { TrackedResourceType } from '@/types/browser';
import { getEffectiveFireUids, isDelayRedelivery } from '../dnr-manager';
import { matchRulesToRequest } from '../modules/request-tracker';
import { arbitrateWithStrategy, type ShadowAttribution } from '../modules/rules/shadow-arbitration';
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
  const arbitrated = arbitrateWithStrategy(live, getSetting('rulesEngine.evaluationStrategy'));
  for (const r of arbitrated) {
    // ws/sse rules act per EVENT through the in-page wrapper relay — the
    // network layer merely observing the stream request is not an action
    // (a drop rule on a stream with no matching frames did nothing), and
    // the observation often lands at stream close, past any suppression
    // window. Content-gated rules (GraphQL operation filters) decline
    // non-matching operations on the same URL, so a URL-only observation
    // proves nothing either. For both, the wrapper relay is the only
    // fire source (evidence=confirmed).
    if (r.type === 'ws' || r.type === 'sse' || r.contentGated) continue;
    recordObservedFire(input.tabId, r.uid, normalized, input.requestId, input.timestampMs, {
      resourceType: input.resourceType,
      pattern: r.pattern,
      deferred: r.deferred,
      shadowedBy: r.shadowedBy,
    });
  }
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
  const arbitrated = arbitrateWithStrategy(live, getSetting('rulesEngine.evaluationStrategy'));
  return arbitrated.find((r) => r.uid === ruleUid)?.shadowedBy;
}

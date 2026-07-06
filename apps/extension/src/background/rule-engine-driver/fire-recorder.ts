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
import { getEffectiveFireUids } from '../dnr-manager';
import { matchRulesToRequest } from '../modules/request-tracker';
import { arbitrateWithStrategy } from '../modules/rules/shadow-arbitration';
import { isTracked as isTabTracked, recordObservedFire } from '../modules/tab-telemetry';
import { isTrackableUrl, normalizeUrlForTracking } from '../modules/url-utils';

export interface FireRecorderInput {
  tabId: number;
  url: string;
  requestId: string;
  timestampMs: number;
  resourceType: TrackedResourceType;
}

export function recordFiresForObservation(input: FireRecorderInput): void {
  if (input.tabId === -1 || !isTabTracked(input.tabId)) return;
  if (!isTrackableUrl(input.url)) return;
  const normalized = normalizeUrlForTracking(input.url);
  const matches = matchRulesToRequest(normalized);
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
    // window. Their only fire source is the wrapper (evidence=confirmed).
    if (r.type === 'ws' || r.type === 'sse') continue;
    recordObservedFire(input.tabId, r.uid, normalized, input.requestId, input.timestampMs, {
      resourceType: input.resourceType,
      pattern: r.pattern,
      deferred: r.deferred,
      shadowedBy: r.shadowedBy,
    });
  }
}

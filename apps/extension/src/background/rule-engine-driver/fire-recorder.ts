/**
 * Fire Recorder — given an observed URL and its identifying context,
 * runs the rule matcher and shadow arbitrator and forwards each winning
 * rule to tab-telemetry as an observed fire. Tab tracking and dedupe
 * are tab-telemetry's responsibility; this module just composes the
 * matcher + arbitrator pipeline.
 */

import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import type { TrackedResourceType } from '@/types/browser';
import { matchRulesToRequest } from '../modules/request-tracker';
import { arbitrateWithStrategy } from '../modules/shadow-arbitration';
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
  const arbitrated = arbitrateWithStrategy(matches, getSetting('rulesEngine.evaluationStrategy'));
  for (const r of arbitrated) {
    recordObservedFire(input.tabId, r.uid, normalized, input.requestId, input.timestampMs, {
      resourceType: input.resourceType,
      pattern: r.pattern,
      deferred: r.deferred,
      shadowedBy: r.shadowedBy,
    });
  }
}

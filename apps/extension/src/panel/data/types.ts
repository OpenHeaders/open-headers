/**
 * Shared types for the DevTools Inspector panel.
 *
 * The traffic list is driven SOLELY by HAR entries forwarded from the
 * devtools_page, so it matches Chrome's native Network panel 1:1 — no
 * phantom rows, no "half-correlated" states. Rule-fire data is an
 * augmentation layer: fires attach to HAR entries when their URL
 * matches, or surface as "off-HAR rule activity" (dangling fires)
 * when the request didn't produce a HAR entry (e.g. a block rule
 * cancelled it before response, a service worker handled it, or the
 * request fired before DevTools was open to capture it).
 */

import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';
import type { RequestRecord } from '@/background/modules/tab-telemetry';

/**
 * Per-rule fire attached to an `InspectorRequest`. `authoritative`
 * distinguishes `onRuleMatchedDebug` fires (Chrome/Edge only — Chrome
 * told us this rule actually executed) from tab-telemetry's inferred
 * URL-matching path.
 */
export interface InspectorFire {
  ruleUid: string;
  t: number;
  pattern: string;
  authoritative: boolean;
  shadowedBy?: RequestRecord['shadowedBy'];
  evidence: RequestRecord['evidence'];
}

/**
 * A rule fire that couldn't be joined to any HAR entry. Typically
 * means the request was blocked / cancelled / cached / handled by a
 * service worker so DevTools never produced a HAR entry for it, but
 * the extension still saw the URL match a rule's conditions. Rendered
 * in the "Rule Activity" view as a separate list so power users can
 * audit rule behavior on requests that don't show up in the primary
 * traffic list.
 */
export interface DanglingFire extends InspectorFire {
  /** URL the rule fired on. */
  url: string;
}

/**
 * Canonical request row — exactly one per HAR entry. Mirrors the
 * shape of Chrome's Network tab row-by-row; the augmentation is the
 * `fires` array, which lists every Open Headers rule that matched
 * this request (empty when no rule matched).
 */
export interface InspectorRequest {
  /** Stable id — synthetic from `method + url + startedDateTime`. */
  id: string;
  /** Full HAR entry from chrome.devtools.network.onRequestFinished. */
  harEntry: InspectorHarEntry;
  /** Convenience projections off the HAR entry. Read from `harEntry` where possible. */
  method: string;
  url: string;
  /** Wall-clock ms parsed from `harEntry.startedDateTime`. */
  timestamp: number;
  statusCode?: number;
  statusText?: string;
  mimeType?: string;
  responseSize?: number;
  duration?: number;
  resourceType?: string;
  /** Response body, attached asynchronously when the `har-body` message arrives. */
  responseBody?: string;
  responseBodyEncoding?: string;
  /** Rule fires attached to this entry, ordered by arrival. */
  fires: InspectorFire[];
  /** Monotonic counter — used as a stable render order tiebreaker. */
  arrivalIndex: number;
}

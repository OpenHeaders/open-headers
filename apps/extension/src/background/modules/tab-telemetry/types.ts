/**
 * Public metadata shapes callers supply when reporting fires.
 */

import type { TrackedResourceType } from '@/types/browser';
import type { ShadowAttribution } from '../rules/shadow-arbitration';

/** Metadata the caller supplies when reporting an observed (webRequest) fire. */
export interface ObservedFireMeta {
  resourceType: TrackedResourceType;
  pattern: string;
  /**
   * True if the rule's type can *also* emit a scriptable fire (delay, body,
   * response, inject, header with header-merge). Gates the 500ms buffer. Pure DNR
   * types (block, redirect, query-param, plain header) pass false and are
   * recorded immediately.
   */
  deferred: boolean;
  /**
   * Shadow arbitration result for this rule on this request. Propagated
   * into `RequestRecord.shadowedBy` verbatim. Omit to signal "our arbitrator
   * has no confident claim about this rule's fate" — the UI treats that as
   * unshadowed, the same as when the experimental flag is off.
   */
  shadowedBy?: ShadowAttribution;
}

/** Metadata the caller supplies when reporting a scriptable (fire-bridge) fire. */
export interface ScriptableFireMeta {
  pattern: string;
  resourceType: TrackedResourceType;
  /**
   * Extra time (beyond the standard fallback window) a late observed fire
   * for the same (rule, url) stays suppressed. A delay wrapper fires when
   * the page calls fetch/XHR but holds the network request for the rule's
   * `delayMs` — the observed twin arrives that much later, so the
   * scriptable-wins window must span the delay or the same action counts
   * twice. 0 / omitted for wrappers that dispatch the request immediately.
   */
  suppressForMs?: number;
  /**
   * Shadow arbitration result for this rule on this request. A wrapper
   * report proves the rule RAN, but another rule can still moot its
   * effect (a request-body rewrite on a request a mock response rule
   * answered never reaches any wire). Same semantics as the observed
   * meta: omitted means unshadowed.
   */
  shadowedBy?: ShadowAttribution;
}

export type TrackingReason = string;

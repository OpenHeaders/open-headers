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
}

export type TrackingReason = string;

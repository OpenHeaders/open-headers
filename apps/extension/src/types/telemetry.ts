/**
 * Telemetry schema shared across execution contexts.
 *
 * The background's `tab-telemetry` module is the producer; the popup and
 * DevTools panel are consumers. They can't import from the background
 * directly (different processes, bridge RPC boundary), so the shape
 * lives here as the single source of truth for the wire format.
 */

import type { ShadowAttribution } from '@/background/modules/shadow-arbitration';
import type { TrackedResourceType } from './browser';

/**
 * Tier of evidence that a rule applied to a request.
 *
 *   - `confirmed`        — in-page fire-bridge reported that the action
 *                          ran. Ground truth for scriptable rule types.
 *   - `matched`          — webRequest observed a URL that satisfied the
 *                          rule's conditions. Best evidence for pure-DNR
 *                          workbench (Chrome does not tell extensions which
 *                          rule wins in arbitration).
 *   - `matched-fallback` — observed fire for a deferred rule type
 *                          (could have emitted scriptable) that didn't
 *                          confirm within the fallback window.
 *   - `silent`           — pattern matched an observed URL but the
 *                          response was served from cache / a service
 *                          worker / bfcache. No network request reached
 *                          webRequest, so DNR / scriptable actions did
 *                          not run. Sourced from the perf-observer
 *                          content script; attached to records that
 *                          live in `ActiveRule.silentRecords`, NOT in
 *                          the telemetry `byRule` / `counters` (those
 *                          remain reserved for actions that ran).
 */
export type Evidence = 'confirmed' | 'matched' | 'matched-fallback' | 'silent';

/**
 * How Chrome served the response.
 *
 *   - `network`         — fresh network round-trip, no cache involvement.
 *   - `cached`          — served from the HTTP cache (disk or in-memory
 *                         tier at the network-service layer).
 *   - `service-worker`  — intercepted by a service worker.
 *
 * Undefined while the request is in-flight or when no webRequest
 * correlation is available (scriptable fires reported from the in-page
 * fire-bridge).
 */
export type DeliveryMode = 'network' | 'cached' | 'service-worker';

/** One observation of a rule firing on a specific URL. */
export interface RequestRecord {
  ruleUid: string;
  url: string;
  pattern: string;
  resourceType: TrackedResourceType;
  /** Wall-clock timestamp in ms. */
  t: number;
  evidence: Evidence;
  /**
   * Chrome webRequest identifier. Present for webRequest-observed fires
   * so delivery mode can be back-filled on `onCompleted`. Absent for
   * scriptable fires reported from the in-page fire-bridge.
   */
  requestId?: string;
  /** Populated post-fact from `onCompleted.fromCache`. */
  deliveryMode?: DeliveryMode;
  /** Shadow arbitration verdict — see shadow-arbitration.ts. */
  shadowedBy?: ShadowAttribution;
}

/** Per-tab telemetry snapshot returned to consumers. */
export interface TabTelemetrySnapshot {
  /** Per-rule event counters. Keys are rule UIDs that matched at least
   *  one request on this page since the last commit. */
  counters: Record<string, number>;
  /** Chronological fire log (newest last). Bounded. */
  fires: RequestRecord[];
  /** Per-rule unique-URL records, LRU order. */
  byRule: Record<string, RequestRecord[]>;
  /** Unique normalized URLs across all workbench. */
  uniqueRequestCount: number;
}

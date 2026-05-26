/**
 * Pure mappers: HAR entry / HAR body → `RequestLifecycleUpdate`.
 *
 * Companion to {@link webRequestEventToUpdates} — the correlator does
 * the join (per-URL FIFO + body-join map) and then hands the resolved
 * `(requestId, hopIndex)` to these helpers to mint the update.
 *
 * Per-hop attribution is the correlator's job: it stamps `hopIndex` into
 * its FIFO and body-join map at record time and threads it through these
 * helpers. A redirect chain produces one HAR per source URL but the
 * lifecycle's `redirectHopCount` at attach time does not identify which
 * hop the HAR belongs to (HAR for an earlier hop arrives after webRequest
 * has already moved on), which is why the correlator carries the cursor
 * rather than reading it off the lifecycle.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

/** Parse a HAR entry's `startedDateTime` into wall-clock ms or `null`. */
export function harEntryTimestamp(entry: InspectorHarEntry): number | null {
  const parsed = Date.parse(entry.startedDateTime);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `{ url, method }` extracted from a HAR entry — both default to empty string. */
export function harEntryJoinFields(entry: InspectorHarEntry): { url: string; method: string } {
  return {
    url: entry.request?.url ?? '',
    method: entry.request?.method ?? '',
  };
}

export function harAttachedUpdate(args: {
  readonly tabId: number;
  readonly requestId: string;
  readonly hopIndex: number;
  readonly entry: InspectorHarEntry;
}): RequestLifecycleUpdate {
  return {
    kind: 'har-attached',
    tabId: args.tabId,
    requestId: args.requestId,
    hopIndex: args.hopIndex,
    har: args.entry,
  };
}

export function bodyAttachedUpdate(args: {
  readonly tabId: number;
  readonly requestId: string;
  readonly hopIndex: number;
  readonly body: InspectorHarBody;
}): RequestLifecycleUpdate {
  return {
    kind: 'body-attached',
    tabId: args.tabId,
    requestId: args.requestId,
    hopIndex: args.hopIndex,
    body: args.body,
  };
}

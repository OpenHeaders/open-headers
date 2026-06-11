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

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry, InspectorHarHeaderCapture } from '@openheaders/core/types';

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

/**
 * Capture-point stamp for a devtools HAR entry, keyed on the entry's own
 * provenance. The host's HAR records THE WIRE when the request crossed it:
 * the request set is post-rewrite (the engine rewrites before send →
 * `effective`) while the response set is pre-rewrite (the engine rewrites
 * after receipt → `raw`; ground-truthed by the fire-evidence probe — the
 * entry held the server's original header while the page received the
 * rewritten value). A cache read (`_fromCache`) never crossed the wire,
 * so the host records the renderer's view instead: the request set is the
 * cooked pre-wire set (`raw`) and the response set is the served one with
 * the engine's rewrite re-applied (`effective` — probe-observed carrying
 * the rewritten value). Same model as the CDP producer's ExtraInfo stamps.
 */
export function harHeaderCapture(entry: InspectorHarEntry): InspectorHarHeaderCapture {
  const cacheRead = entry._fromCache !== undefined || entry._servedFromCache === true;
  return cacheRead ? { request: 'raw', response: 'effective' } : { request: 'effective', response: 'raw' };
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
    har: { ...args.entry, _ohHeaderCapture: harHeaderCapture(args.entry), _ohEntrySource: 'devtools' },
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

/**
 * Does this HAR entry carry the host's own failure verdict? `_error` is
 * the devtools-recorded net error (`loadingFailed` → the exporter's
 * `_error` field) — a recorded fact, not an inference. A clean cache-hit
 * entry has `status 200` and no `_error`; a request canceled before (or
 * while) crossing the wire has `_error: net::ERR_ABORTED` (status `0`,
 * or the real code when headers had landed first).
 */
export function hasHarFailureVerdict(entry: InspectorHarEntry): boolean {
  const error = entry.response?._error;
  return typeof error === 'string' && error.length > 0;
}

/**
 * Mint the update sequence for a HAR-only lifecycle — a request the
 * host's devtools recorded (and delivered through `onRequestFinished`)
 * but `webRequest` never saw, so no real lifecycle exists to attach the
 * entry to. Canceled-while-queued requests are the canonical case: the
 * renderer cancels them before they reach the network stack.
 *
 * Everything is projected from the entry itself — url/method/type, the
 * provisional request headers (the browser's cooked pre-wire set, hence
 * the provisional flag), the entry as hop-0 HAR, and the terminal
 * `failed` phase carrying the host's `_error` verdict. `statusCode` is
 * set only when the entry carries a real one (`> 0`), matching the
 * status cell's `(canceled)`-only-without-a-code rule.
 */
export function harOnlyLifecycleUpdates(args: {
  readonly tabId: number;
  readonly requestId: string;
  readonly entry: InspectorHarEntry;
}): RequestLifecycleUpdate[] {
  const { tabId, requestId, entry } = args;
  const startedAtMs = harEntryTimestamp(entry);
  const error = entry.response?._error;
  if (startedAtMs === null || typeof error !== 'string' || error.length === 0) return [];
  const { url, method } = harEntryJoinFields(entry);
  if (!url) return [];

  const lifecycle: RequestLifecycle = {
    tabId,
    requestId,
    url,
    method: method || 'GET',
    resourceType: harResourceTypeToWebRequest(entry._resourceType),
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    har: [],
    harBodyByHop: [],
  };
  const updates: RequestLifecycleUpdate[] = [{ kind: 'started', lifecycle }];

  const headers = entry.request?.headers;
  if (headers && headers.length > 0) {
    updates.push({
      kind: 'phase',
      tabId,
      requestId,
      patch: {
        requestHeaders: headers.map((h) => ({ name: h.name, value: h.value })),
        requestHeadersProvisional: true,
      },
    });
  }

  updates.push(harAttachedUpdate({ tabId, requestId, hopIndex: 0, entry }));

  const elapsed = typeof entry.time === 'number' && entry.time > 0 ? entry.time : 0;
  const status = entry.response?.status ?? 0;
  const statusText = entry.response?.statusText;
  updates.push({
    kind: 'phase',
    tabId,
    requestId,
    patch: {
      phase: 'failed',
      completedAtMs: startedAtMs + elapsed,
      error: { code: error, reason: error },
      ...(status > 0 ? { statusCode: status } : {}),
      ...(status > 0 && statusText ? { statusText } : {}),
    },
  });
  return updates;
}

/**
 * The devtools HAR `_resourceType` vocabulary mostly coincides with
 * webRequest's `type` (the lifecycle's convention); map the names that
 * differ and pass the rest through.
 */
function harResourceTypeToWebRequest(resourceType: string | undefined): string {
  switch (resourceType) {
    case undefined:
      return 'other';
    case 'document':
      return 'main_frame';
    case 'xhr':
      return 'xmlhttprequest';
    case 'cspviolationreport':
      return 'csp_report';
    default:
      return resourceType;
  }
}

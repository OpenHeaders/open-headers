/**
 * Pure timing-block synthesis for partial HAR entries — two honesty
 * tiers, both built only from host-recorded instants:
 *
 *   - The FLOOR ({@link floorHarTimings}): every hop that saw
 *     `onHeadersReceived` gets a coarse block from the webRequest event
 *     timestamps alone — `blocked` spans start → headers-received and
 *     `receive` spans headers-received → terminal. The connection legs
 *     stay `-1` (unknown, not "reused"); the queueing split is absent,
 *     so the whole pre-response span reads as stalled — the same
 *     degraded shape the host renders for a request with no detailed
 *     timing.
 *
 *   - The LADDER ({@link resourceTimingHarTimings}): when the page's own
 *     Resource Timing entry joins the request, its connection legs
 *     upgrade the block to the full breakdown. Two accepted limitations,
 *     pinned by tests: a cross-origin entry that fails the
 *     Timing-Allow-Origin check hides its legs (they read `0`) and the
 *     mapper returns `null` so the floor stands — degraded, never
 *     invented; and the surface records no request-end instant, so the
 *     send leg folds into wait (`send: 0`).
 *
 * All Resource Timing legs are ms offsets from the document time origin;
 * the snapshot's `timeOriginMs` lifts them to wall-clock where a
 * webRequest instant has to close an open leg.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import type { InspectorHarEntry } from '@openheaders/core/types';

export type InspectorHarTimings = NonNullable<InspectorHarEntry['timings']>;

/** webRequest event instants for one hop, wall-clock ms. */
export interface FloorTimingFacts {
  /** Hop start (`onBeforeRequest` / `onBeforeRedirect` time). */
  readonly startedAtMs: number;
  /** `onHeadersReceived` time — the first-byte instant. */
  readonly headersReceivedAtMs: number;
  /** Hop terminal time; absent while the hop is still in flight. */
  readonly completedAtMs?: number;
}

/** The coarse block from webRequest instants alone. */
export function floorHarTimings(facts: FloorTimingFacts): InspectorHarTimings {
  return {
    blocked: Math.max(0, facts.headersReceivedAtMs - facts.startedAtMs),
    dns: -1,
    connect: -1,
    ssl: -1,
    send: -1,
    wait: -1,
    receive: facts.completedAtMs !== undefined ? Math.max(0, facts.completedAtMs - facts.headersReceivedAtMs) : -1,
  };
}

export interface ResourceTimingLegContext {
  /** Wall-clock ms of the document time origin for the entry's legs. */
  readonly timeOriginMs: number;
  /**
   * Hop terminal wall-clock ms — closes the receive leg when the page
   * recorded no response end (the download never finished). Absent while
   * the hop is in flight: receive stays `-1`.
   */
  readonly terminalMs?: number;
}

/**
 * The full connection ladder from a Resource Timing entry. `null` when
 * the Timing-Allow-Origin check hid the legs — the caller keeps the
 * floor block instead.
 *
 * Leg semantics, each traceable to a recorded instant:
 *   - The entry's local zero is the FINAL hop's start: `redirectEnd`
 *     when the chain redirected (the legs describe the last fetch),
 *     else `startTime`. The block lands on that hop's slot.
 *   - `_blocked_queueing` = `fetchStart − zero` (the scheduler queue);
 *     `blocked` runs to the first connection instant, so the ladder's
 *     stalled rung reads `blocked − queueing`.
 *   - A reused connection collapses the dns/connect legs onto
 *     `fetchStart` (zero-width at the same instant) — mapped to `-1`
 *     so they read "reused", with the socket wait inside `blocked`.
 *   - `connect` speaks the exporter's dialect: anchored at the DNS
 *     start when a lookup ran (so it spans dns AND TLS, the same
 *     overlap the exporter writes), else `connectStart → connectEnd`;
 *     `ssl` is the `secureConnectionStart → connectEnd` slice of it.
 *     Every consumer decodes one dialect this way, and the entry `time`
 *     stays the exporter's leg sum.
 *   - The wait leg ends at the FINAL response headers: with a 103
 *     interim response, `responseStart` reports the interim's first
 *     byte, while the host's Waiting runs to the real headers
 *     (probe-proven ≈ the wire's receive-headers-end instant) —
 *     `finalResponseHeadersStart` carries exactly that, with
 *     `responseStart` the fallback where the engine doesn't expose it.
 */
export function resourceTimingHarTimings(
  entry: ResourceTimingEntry,
  ctx: ResourceTimingLegContext,
): InspectorHarTimings | null {
  if (entry.requestStart <= 0) return null;
  const zero = entry.redirectEnd > 0 ? entry.redirectEnd : entry.startTime;
  const queueing = Math.max(0, entry.fetchStart - zero);
  const reused = entry.connectEnd <= entry.fetchStart;
  const firstConnectionInstant = reused ? entry.requestStart : entry.domainLookupStart;
  const waitEnd = entry.finalResponseHeadersStart > 0 ? entry.finalResponseHeadersStart : entry.responseStart;
  const receive =
    entry.responseEnd > 0
      ? Math.max(0, entry.responseEnd - waitEnd)
      : ctx.terminalMs !== undefined
        ? Math.max(0, ctx.terminalMs - (ctx.timeOriginMs + waitEnd))
        : -1;
  const dnsRan = !reused && entry.domainLookupEnd > entry.domainLookupStart;
  return {
    blocked: Math.max(0, firstConnectionInstant - zero),
    _blocked_queueing: queueing,
    dns: reused ? -1 : Math.max(0, entry.domainLookupEnd - entry.domainLookupStart),
    connect: reused ? -1 : Math.max(0, entry.connectEnd - (dnsRan ? entry.domainLookupStart : entry.connectStart)),
    ssl: reused || entry.secureConnectionStart <= 0 ? -1 : Math.max(0, entry.connectEnd - entry.secureConnectionStart),
    send: 0,
    wait: Math.max(0, waitEnd - entry.requestStart),
    receive,
  };
}

/**
 * The download never completed: the page recorded a first byte but no
 * response end, and the hop hit a terminal error (canceled mid-stream).
 * Drives the not-finished caution — the host shows the same line for a
 * request its protocol plane never finishes.
 */
export function isResponseBodyIncomplete(entry: ResourceTimingEntry, terminalError: string | undefined): boolean {
  return entry.responseStart > 0 && entry.responseEnd === 0 && terminalError !== undefined;
}

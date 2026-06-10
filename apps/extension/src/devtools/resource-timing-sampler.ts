/**
 * Resource Timing sampler — devtools-page half of the `oh-rt` feed.
 *
 * Polls the inspected window's Resource Timing buffer on the shared ramped
 * cadence and forwards each post-open snapshot to the background.
 *
 * Why this feed exists: a renderer in-process cache hit is served without
 * ever reaching the network service, so no `webRequest` / HAR event fires
 * for it, yet it still records a `PerformanceResourceTiming` entry (with
 * `transferSize` 0). The panel reconciles this snapshot against its real
 * rows to surface the otherwise-invisible hits.
 *
 * Session scope: the buffer is cumulative since navigation, so a panel
 * opened on an already-loaded page would otherwise see every resource
 * since load. Entries are floored at `openedAtWallMs` (the DevTools-open
 * moment) so the feed is scoped to the current session — only requests
 * since DevTools opened, matching the network log's Chrome-parity scope.
 *
 * The floor is a pure function (`filterEntriesSinceOpen`), unit-tested
 * without a chrome eval mock; the chrome plumbing (eval + port post) is
 * injected, so this module stays host-free and testable.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { POLL_MAX_MS, rampedDelayMs } from './poll-cadence';

export interface ResourceTimingSnapshot {
  /** Wall-clock ms of the document time origin for this snapshot. */
  readonly timeOriginMs: number;
  /** Resource Timing entries, relative to `timeOriginMs`. */
  readonly entries: readonly ResourceTimingEntry[];
  /** The document's own navigation entry, same projection — the doc row's
   *  only timing source. Kept apart from `entries` (resources only). */
  readonly navigation?: ResourceTimingEntry;
}

/**
 * Expression eval'd in the inspected window. Returns the full cumulative
 * buffer as a JSON-safe snapshot; flooring is applied host-side so it
 * stays a pure, tested transform rather than an opaque eval string.
 */
export const RESOURCE_TIMING_EXPR = `(() => {
  try {
    const origin = performance.timeOrigin || (Date.now() - performance.now());
    const pick = (e) => ({
      name: e.name,
      initiatorType: e.initiatorType || '',
      nextHopProtocol: e.nextHopProtocol || '',
      startTime: e.startTime || 0,
      duration: e.duration || 0,
      transferSize: e.transferSize || 0,
      encodedBodySize: e.encodedBodySize || 0,
      decodedBodySize: e.decodedBodySize || 0,
      deliveryType: e.deliveryType || '',
      responseStatus: typeof e.responseStatus === 'number' ? e.responseStatus : 0,
      workerStart: e.workerStart || 0,
      redirectStart: e.redirectStart || 0,
      redirectEnd: e.redirectEnd || 0,
      fetchStart: e.fetchStart || 0,
      domainLookupStart: e.domainLookupStart || 0,
      domainLookupEnd: e.domainLookupEnd || 0,
      connectStart: e.connectStart || 0,
      connectEnd: e.connectEnd || 0,
      secureConnectionStart: e.secureConnectionStart || 0,
      requestStart: e.requestStart || 0,
      responseStart: e.responseStart || 0,
      firstInterimResponseStart: e.firstInterimResponseStart || 0,
      finalResponseHeadersStart: e.finalResponseHeadersStart || 0,
      responseEnd: e.responseEnd || 0,
    });
    const entries = performance.getEntriesByType('resource').map(pick);
    const nav = performance.getEntriesByType('navigation')[0];
    const out = { timeOriginMs: origin, entries };
    if (nav) out.navigation = pick(nav);
    return out;
  } catch (e) {
    return { timeOriginMs: 0, entries: [] };
  }
})()`;

/**
 * Drop entries whose wall-clock start (`timeOriginMs + startTime`)
 * predates `openedAtWallMs` — including the navigation entry (its
 * `startTime` is `0`, so it survives only when the navigation itself
 * happened after DevTools opened, matching the doc row's own session
 * scope). Returns the same snapshot reference when nothing is filtered,
 * so an unchanged buffer stays identity-stable.
 */
export function filterEntriesSinceOpen(
  snapshot: ResourceTimingSnapshot,
  openedAtWallMs: number,
): ResourceTimingSnapshot {
  const entries = snapshot.entries.filter((e) => snapshot.timeOriginMs + e.startTime >= openedAtWallMs);
  const navigation =
    snapshot.navigation !== undefined && snapshot.timeOriginMs + snapshot.navigation.startTime >= openedAtWallMs
      ? snapshot.navigation
      : undefined;
  if (entries.length === snapshot.entries.length && navigation === snapshot.navigation) return snapshot;
  return {
    timeOriginMs: snapshot.timeOriginMs,
    entries,
    ...(navigation !== undefined ? { navigation } : {}),
  };
}

/** Eval one expression in the inspected window. Mirrors chrome's seam. */
type EvalInPage = (expr: string, cb: (result: ResourceTimingSnapshot | null, err?: unknown) => void) => void;

export interface ResourceTimingSamplerDeps {
  /** Evaluate `RESOURCE_TIMING_EXPR` in the inspected window. */
  readonly evalInPage: EvalInPage;
  /** Forward a post-open snapshot to the background. */
  readonly forward: (snapshot: ResourceTimingSnapshot) => void;
  /** Wall-clock moment DevTools opened — the session floor. */
  readonly openedAtWallMs: number;
}

export interface ResourceTimingSampler {
  /**
   * (Re)start the poll from t=0. A new document resets the buffer, so this
   * also drops the change-count gate — the first post of the new page
   * always lands. Idempotent: a running poll is stopped first.
   */
  restart(): void;
  /** Stop the poll. */
  stop(): void;
}

export function createResourceTimingSampler(deps: ResourceTimingSamplerDeps): ResourceTimingSampler {
  const { evalInPage, forward, openedAtWallMs } = deps;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let elapsedMs = 0;
  // Fingerprint of the last forwarded (floored) snapshot — a cheap
  // "nothing new" gate that avoids waking the background for an identical
  // snapshot. Tracks the entry count plus the navigation entry's evolving
  // legs (first byte / last byte land after the entry first appears), so
  // a doc-only change still forwards. `null` forces the next sample out.
  let lastFingerprint: string | null = null;

  const fingerprint = (snapshot: ResourceTimingSnapshot): string => {
    const nav = snapshot.navigation;
    return `${snapshot.entries.length}|${nav ? `${nav.responseStart}:${nav.responseEnd}` : '-'}`;
  };

  const sample = (): void => {
    evalInPage(RESOURCE_TIMING_EXPR, (result, err) => {
      if (err || !result) return;
      const floored = filterEntriesSinceOpen(result, openedAtWallMs);
      const next = fingerprint(floored);
      if (next === lastFingerprint) return;
      lastFingerprint = next;
      forward(floored);
    });
  };

  const stop = (): void => {
    if (timer != null) clearTimeout(timer);
    timer = null;
  };

  const restart = (): void => {
    stop();
    elapsedMs = 0;
    lastFingerprint = null;
    // Self-scheduling so the next eval only fires after the previous one
    // resolves — never stacking round-trips at the inspected window. Unlike
    // nav timing there is no single "done" event (lazy resources keep
    // arriving), so the poll runs to the budget ceiling.
    const tick = (): void => {
      sample();
      if (elapsedMs >= POLL_MAX_MS) {
        stop();
        return;
      }
      const delay = rampedDelayMs(elapsedMs);
      elapsedMs += delay;
      timer = setTimeout(tick, delay);
    };
    tick();
  };

  return { restart, stop };
}

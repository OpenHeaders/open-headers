/**
 * Wire-join — the browser-row ⇄ wire-row correlation layer
 * (OBSERVABILITY_PLAN.md Phase 6, §2).
 *
 * The extension's browser-truth rows and the proxy's wire-truth rows are
 * parallel witnesses of the same exchange in two partitions. This module
 * computes the join between them PURELY and AT CONSUME TIME — nothing is
 * ever written back into either store, the daemon holds no second store,
 * and an absent join (capture off, un-scoped host, cache hit) changes
 * nothing. The merged row is one more ADDITIVE layer on the browser row,
 * same law as webRequest → HAR → CDP: wire facts fill only slots the
 * browser layers left empty, never overwrite them.
 *
 * Correlation key (§2): method + per-hop URL + start-time window,
 * matched one-to-one — each wire row upgrades at most one browser hop,
 * nearest start time wins. Matching is per browser HOP, not per row: a
 * server 3xx is ONE browser lifecycle but N separate wire exchanges,
 * and a DNR rewrite's internal hop means the wire saw the post-rewrite
 * URL — both fall out of hop-level matching naturally. A wire row that
 * a rule rewrote in place is keyed by its INITIAL url (hop 0's source),
 * which is what the browser issued.
 *
 * Exclusions are structural, not heuristic: a cache/SW-served browser
 * row never reaches the wire, and only http(s) exchanges transit the
 * proxy.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

/** How far apart the browser's and the proxy's start instants may be.
 *  Both clocks are the same machine's wall clock (extension vs daemon
 *  process); the window absorbs queueing between `onBeforeRequest` and
 *  the proxy accepting the socket, not clock skew. */
export const WIRE_JOIN_WINDOW_MS = 5_000;

/** One matched hop: this browser hop's exchange is `wireRequestId`. */
export interface WireJoinMatch {
  readonly hopIndex: number;
  readonly wireRequestId: string;
}

export interface WireJoinBack {
  readonly browserRequestId: string;
  readonly hopIndex: number;
}

export interface WireJoinResult {
  /** Browser row → its matched hops (ascending `hopIndex`). */
  readonly byBrowserId: ReadonlyMap<string, readonly WireJoinMatch[]>;
  /** Wire row → the one browser hop it upgrades. */
  readonly byWireId: ReadonlyMap<string, WireJoinBack>;
}

export const EMPTY_WIRE_JOIN: WireJoinResult = Object.freeze({
  byBrowserId: new Map<string, readonly WireJoinMatch[]>(),
  byWireId: new Map<string, WireJoinBack>(),
});

/** The URL a row's hop actually issued. Hop 0 is the original request
 *  (the row's `url` has advanced past redirects); hop N is the Nth
 *  redirect's target. */
function hopUrl(row: RequestLifecycle, hopIndex: number): string {
  if (hopIndex === 0) return row.redirectHops.length > 0 ? row.redirectHops[0].sourceUrl : row.url;
  return row.redirectHops[hopIndex - 1]?.redirectUrl ?? row.url;
}

/** The instant a row's hop was issued. */
function hopStartMs(row: RequestLifecycle, hopIndex: number): number {
  if (hopIndex === 0) return row.startedAtMs;
  return row.redirectHops[hopIndex - 1]?.timestampMs ?? row.startedAtMs;
}

/** The wire exchange's key URL — what the client issued, i.e. hop 0's
 *  source when a rule rewrote the exchange in place. */
function wireInitialUrl(row: RequestLifecycle): string {
  return row.redirectHops.length > 0 ? row.redirectHops[0].sourceUrl : row.url;
}

function isJoinableScheme(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

interface WireCandidate {
  readonly wireRequestId: string;
  readonly startedAtMs: number;
  used: boolean;
}

interface BrowserHopProbe {
  readonly browserRequestId: string;
  readonly hopIndex: number;
  readonly key: string;
  readonly startMs: number;
}

/**
 * Compute the join between one browser partition and the wire partition.
 * Pure and deterministic: candidates are consumed in chronological
 * browser-hop order, each taking its nearest unmatched wire twin within
 * {@link WIRE_JOIN_WINDOW_MS}. O((B + W) log(B + W)).
 */
export function computeWireJoin(
  browserRows: readonly RequestLifecycle[],
  wireRows: readonly RequestLifecycle[],
): WireJoinResult {
  if (browserRows.length === 0 || wireRows.length === 0) return EMPTY_WIRE_JOIN;

  // Index wire rows by exchange key, each bucket start-sorted.
  const buckets = new Map<string, WireCandidate[]>();
  for (const wire of wireRows) {
    const url = wireInitialUrl(wire);
    if (!isJoinableScheme(url)) continue;
    const key = `${wire.method} ${url}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push({ wireRequestId: wire.requestId, startedAtMs: wire.startedAtMs, used: false });
  }
  if (buckets.size === 0) return EMPTY_WIRE_JOIN;
  for (const bucket of buckets.values()) bucket.sort((a, b) => a.startedAtMs - b.startedAtMs);

  // Every joinable browser hop, chronological so contention over one
  // candidate resolves deterministically and nearest-first.
  const probes: BrowserHopProbe[] = [];
  for (const row of browserRows) {
    if (row.fromCache === true) continue;
    if (!isJoinableScheme(row.url)) continue;
    for (let hop = 0; hop <= row.redirectHopCount; hop += 1) {
      const url = hopUrl(row, hop);
      probes.push({
        browserRequestId: row.requestId,
        hopIndex: hop,
        key: `${row.method} ${url}`,
        startMs: hopStartMs(row, hop),
      });
    }
  }
  probes.sort((a, b) => a.startMs - b.startMs || a.browserRequestId.localeCompare(b.browserRequestId));

  const byBrowserId = new Map<string, WireJoinMatch[]>();
  const byWireId = new Map<string, WireJoinBack>();
  for (const probe of probes) {
    const bucket = buckets.get(probe.key);
    if (!bucket) continue;
    const candidate = takeNearest(bucket, probe.startMs);
    if (!candidate) continue;
    let matches = byBrowserId.get(probe.browserRequestId);
    if (!matches) {
      matches = [];
      byBrowserId.set(probe.browserRequestId, matches);
    }
    matches.push({ hopIndex: probe.hopIndex, wireRequestId: candidate.wireRequestId });
    byWireId.set(candidate.wireRequestId, { browserRequestId: probe.browserRequestId, hopIndex: probe.hopIndex });
  }
  if (byWireId.size === 0) return EMPTY_WIRE_JOIN;
  for (const matches of byBrowserId.values()) matches.sort((a, b) => a.hopIndex - b.hopIndex);
  return { byBrowserId, byWireId };
}

/** Nearest unused candidate within the window, consumed on take. Binary
 *  search to the insertion point, then widen over used neighbours. */
function takeNearest(bucket: WireCandidate[], startMs: number): WireCandidate | null {
  let lo = 0;
  let hi = bucket.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bucket[mid].startedAtMs < startMs) lo = mid + 1;
    else hi = mid;
  }
  let best: WireCandidate | null = null;
  let bestDelta = WIRE_JOIN_WINDOW_MS + 1;
  for (let i = lo; i < bucket.length; i += 1) {
    const delta = bucket[i].startedAtMs - startMs;
    if (delta >= bestDelta) break;
    if (!bucket[i].used) {
      best = bucket[i];
      bestDelta = delta;
      break;
    }
  }
  for (let i = lo - 1; i >= 0; i -= 1) {
    const delta = startMs - bucket[i].startedAtMs;
    if (delta >= bestDelta) break;
    if (!bucket[i].used) {
      best = bucket[i];
      bestDelta = delta;
      break;
    }
  }
  if (best === null || bestDelta > WIRE_JOIN_WINDOW_MS) return null;
  best.used = true;
  return best;
}

/**
 * The additive merge: fill the browser row's empty per-hop HAR and body
 * slots from the matched wire rows' final hops. Returns the SAME object
 * when there is nothing to add — identity stability is what lets the
 * memoized row components skip re-render.
 */
export function mergeWireLayer(
  browser: RequestLifecycle,
  matches: readonly WireJoinMatch[],
  wireById: ReadonlyMap<string, RequestLifecycle>,
): RequestLifecycle {
  let har: (RequestLifecycle['har'][number] | null)[] | null = null;
  let bodies: (RequestLifecycle['harBodyByHop'][number] | null)[] | null = null;
  for (const match of matches) {
    const wire = wireById.get(match.wireRequestId);
    if (!wire) continue;
    const wireHop = wire.redirectHopCount;
    const wireHar = wire.har[wireHop] ?? null;
    const wireBody = wire.harBodyByHop[wireHop] ?? null;
    if (
      wireHar !== null &&
      (browser.har[match.hopIndex] ?? null) === null &&
      (har?.[match.hopIndex] ?? null) === null
    ) {
      har ??= padSlots(browser.har, browser.redirectHopCount);
      har[match.hopIndex] = wireHar;
    }
    if (
      wireBody !== null &&
      (browser.harBodyByHop[match.hopIndex] ?? null) === null &&
      (bodies?.[match.hopIndex] ?? null) === null
    ) {
      bodies ??= padSlots(browser.harBodyByHop, browser.redirectHopCount);
      bodies[match.hopIndex] = wireBody;
    }
  }
  if (har === null && bodies === null) return browser;
  return {
    ...browser,
    ...(har !== null ? { har } : {}),
    ...(bodies !== null ? { harBodyByHop: bodies } : {}),
  };
}

function padSlots<T>(slots: readonly (T | null)[], lastHop: number): (T | null)[] {
  const next = [...slots];
  while (next.length <= lastHop) next.push(null);
  return next;
}

/**
 * Identity-stable merge cache: a merged row keeps its object identity
 * until the underlying browser row or one of its matched wire rows
 * actually changes (identity-churn law — the row memo must hold across
 * unrelated snapshot ticks). Hold one instance per view in a ref.
 */
export class WireJoinMerger {
  private cache = new Map<
    string,
    { browser: RequestLifecycle; wires: readonly (RequestLifecycle | undefined)[]; merged: RequestLifecycle }
  >();

  merge(
    browser: RequestLifecycle,
    matches: readonly WireJoinMatch[],
    wireById: ReadonlyMap<string, RequestLifecycle>,
  ): RequestLifecycle {
    if (matches.length === 0) return browser;
    const wires = matches.map((m) => wireById.get(m.wireRequestId));
    const hit = this.cache.get(browser.requestId);
    if (hit && hit.browser === browser && sameWires(hit.wires, wires)) return hit.merged;
    const merged = mergeWireLayer(browser, matches, wireById);
    this.cache.set(browser.requestId, { browser, wires, merged });
    return merged;
  }

  /** Drop entries for rows no longer present (partition cleared). */
  prune(liveBrowserIds: ReadonlySet<string>): void {
    for (const key of this.cache.keys()) {
      if (!liveBrowserIds.has(key)) this.cache.delete(key);
    }
  }
}

function sameWires(
  a: readonly (RequestLifecycle | undefined)[],
  b: readonly (RequestLifecycle | undefined)[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

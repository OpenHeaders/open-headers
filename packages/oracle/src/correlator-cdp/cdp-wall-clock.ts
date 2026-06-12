/**
 * Per-request wall↔monotonic offset tracker for the CDP correlator.
 *
 * CDP carries two clocks. `requestWillBeSent` reports both a wall-clock
 * `wallTime` (UNIX seconds) and a monotonic `timestamp` (seconds since an
 * arbitrary epoch); the terminal `loadingFinished` / `loadingFailed` events
 * report only the monotonic `timestamp`. Our lifecycle stamps every
 * timestamp on the wall clock (`startedAtMs`, `hopStartedAtMs`), so a
 * monotonic terminal time cannot be subtracted from a wall start — the
 * difference is off by ~1.7e12 and `lifecycleDuration` clamps it to 0.
 *
 * The fix mirrors Chrome's `NetworkRequest.pseudoWallTime`
 * (`wallIssueTime − issueTime + monotonicTime`): capture the per-request
 * offset `wallTime − timestamp` at `requestWillBeSent`, and apply it to a
 * later monotonic instant to recover wall time. The offset is essentially
 * constant across a session (both clocks tick at the same rate), but we key
 * it per request to stay pseudoWallTime-exact, sharing the formula shape
 * with {@link ../correlator-cdp/cdp-page-synth.pageStartedAtMs}.
 *
 * State posture mirrors {@link ./cdp-har-builder.CdpHarBuilder}: scoped by
 * tab, dropped by {@link forgetTab} / {@link clear}, bounded by a per-tab cap
 * (oldest-inserted evicts, bounding the leak from a request whose terminal
 * event never arrives), and swept by a lazy retention gc keyed on the
 * monotonic event timestamp after a terminal event (no timers — deterministic
 * under fake clocks, SW-suspend-safe).
 *
 * Host-neutral: no chrome, no timers. The pure conversion
 * ({@link monotonicSecToWallMs}) is table-testable on its own.
 */

import { logger } from '@openheaders/core/utils';

import { type CdpNetworkEvent, cdpStoreRequestId } from './events';

/**
 * Per-tab cap on tracked offsets. One number per request, so this is cheap;
 * sized to the store's per-tab lifecycle envelope so a row still viewable in
 * the panel resolves its own offset. Oldest-inserted evicts first.
 */
export const MAX_CDP_WALL_OFFSETS_PER_TAB = 10_000;

/**
 * Window an offset is retained after its request's terminal event, so a
 * trailing/duplicate terminal still resolves. Measured against the monotonic
 * event timestamp. Matches {@link ./cdp-har-builder.CDP_HAR_RETENTION_MS}.
 */
export const CDP_WALL_RETENTION_MS = 60_000;

const secondsToMs = (t: number): number => Math.round(t * 1000);

/**
 * The resolver the pure mapper consumes: a monotonic instant (seconds, for
 * the request identified by `(tabId, sessionId, requestId)`) → wall-clock ms.
 * {@link CdpWallClock.toWallMs} implements it; the mapper stays pure by
 * taking it as a parameter.
 */
export type CdpWallClockResolver = (
  tabId: number,
  sessionId: string,
  requestId: string,
  monotonicSec: number,
) => number;

/**
 * Pure conversion — a monotonic instant plus its wall↔monotonic offset, in
 * ms. Mirrors Chrome's `pseudoWallTime` and our {@link pageStartedAtMs}
 * (`(wallTime − issue + instant) * 1000`, with `offset = wallTime − issue`).
 * Full precision on purpose: the start-time sort and footer math want the
 * sub-ms fraction, and the HAR export truncates separately.
 */
export function monotonicSecToWallMs(monotonicSec: number, offsetSec: number): number {
  return (monotonicSec + offsetSec) * 1000;
}

interface OffsetEntry {
  /** `wallTime − timestamp` captured at `requestWillBeSent` (seconds). */
  readonly offsetSec: number;
  /** Monotonic ms of the terminal event, once seen — drives retention gc. */
  finalizedAtMs?: number;
}

interface TabWallState {
  /** Per-request offsets, keyed by namespaced store id. */
  readonly offsets: Map<string, OffsetEntry>;
  /**
   * The most recently captured offset on this tab — the mid-attach fallback.
   * When a terminal event's own `requestWillBeSent` was never seen (CDP
   * attached mid-request), this stands in. The offset is ~constant per
   * session, so a sibling request's offset is accurate to sub-ms.
   */
  lastOffsetSec?: number;
}

export class CdpWallClock {
  private readonly perTab = new Map<number, TabWallState>();
  /** Latch so the unknown-offset fallback warns once, not per row. */
  private missLogged = false;

  /**
   * Fold one CDP event into the offset state. Records the offset at
   * `requestWillBeSent`, marks the request finalized at a terminal event
   * (for retention gc), and sweeps stale finalized offsets. No updates are
   * emitted — the correlator calls this before mapping and passes
   * {@link toWallMs} into the mapper.
   */
  observe(event: CdpNetworkEvent): void {
    // The `*ExtraInfo` variants carry no `timestamp`; gc rides the base events.
    if ('timestamp' in event) this.gcFinalized(event.tabId, secondsToMs(event.timestamp));
    switch (event.method) {
      case 'Network.requestWillBeSent':
        this.onRequest(event);
        return;
      case 'Network.webSocketWillSendHandshakeRequest':
        // The only WS event carrying both clocks — the offset source for the
        // socket's later monotonic-only events (frames, close).
        this.record(event.tabId, cdpStoreRequestId(event.sessionId, event.requestId), event.wallTime - event.timestamp);
        return;
      case 'Network.loadingFinished':
      case 'Network.loadingFailed':
      case 'Network.webSocketClosed':
        this.markFinalized(
          event.tabId,
          cdpStoreRequestId(event.sessionId, event.requestId),
          secondsToMs(event.timestamp),
        );
        return;
      default:
        return;
    }
  }

  /**
   * Wall-clock ms for a monotonic instant on a known request. Resolution
   * order: the request's own offset, then the tab's last-known offset
   * (mid-attach), then a zero offset with a one-time warning.
   *
   * The zero-offset branch is reached only when a terminal event lands before
   * any `requestWillBeSent` on the tab — CDP attached mid-flight with no prior
   * request to seed an offset. We deliberately do NOT mirror Chrome's
   * raw-monotonic fallback there: our lifecycle clock is wall, so a raw
   * monotonic `completedAtMs` would re-introduce the negative duration the
   * tab-global fallback exists to prevent. The tab-global branch makes this
   * effectively unreachable in practice.
   */
  toWallMs(tabId: number, sessionId: string, requestId: string, monotonicSec: number): number {
    const tab = this.perTab.get(tabId);
    const perRequest = tab?.offsets.get(cdpStoreRequestId(sessionId, requestId))?.offsetSec;
    const offsetSec = perRequest ?? tab?.lastOffsetSec;
    if (offsetSec === undefined) {
      if (!this.missLogged) {
        this.missLogged = true;
        logger.warn(
          'CdpWallClock',
          "no wall↔monotonic offset for a completed CDP request (attached mid-request); using a zero offset, so this row's duration may read as 0",
        );
      }
      return monotonicSecToWallMs(monotonicSec, 0);
    }
    return monotonicSecToWallMs(monotonicSec, offsetSec);
  }

  /** Drop all offset state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /** Discard all accumulated state. */
  clear(): void {
    this.perTab.clear();
  }

  /** Total tracked offsets across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const tab of this.perTab.values()) n += tab.offsets.size;
    return n;
  }

  private onRequest(event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>): void {
    const storeId = cdpStoreRequestId(event.sessionId, event.requestId);
    // A redirect continuation reuses the id across hops; keep the root hop's
    // offset (earliest wins) — the lifecycle anchors `completedAtMs` of the
    // whole chain to the final hop's monotonic finish, converted with the
    // root's offset, exactly as Chrome's per-request pseudoWallTime is stable
    // across the redirect. A fresh `requestWillBeSent` (no `redirectResponse`)
    // (re)records, which also resets a reused id after its prior life was gc'd.
    if (event.redirectResponse !== undefined && this.perTab.get(event.tabId)?.offsets.has(storeId)) {
      this.ensureTab(event.tabId).lastOffsetSec = event.wallTime - event.timestamp;
      return;
    }
    this.record(event.tabId, storeId, event.wallTime - event.timestamp);
  }

  private record(tabId: number, storeId: string, offsetSec: number): void {
    const tab = this.ensureTab(tabId);
    tab.lastOffsetSec = offsetSec;
    // Touch-to-end so a reused id sits at the tail under the per-tab cap.
    tab.offsets.delete(storeId);
    tab.offsets.set(storeId, { offsetSec });
    this.enforceCap(tab.offsets);
  }

  private markFinalized(tabId: number, requestId: string, monotonicMs: number): void {
    const entry = this.perTab.get(tabId)?.offsets.get(requestId);
    if (entry !== undefined) entry.finalizedAtMs = monotonicMs;
  }

  private enforceCap(offsets: Map<string, OffsetEntry>): void {
    while (offsets.size > MAX_CDP_WALL_OFFSETS_PER_TAB) {
      const oldest = offsets.keys().next().value;
      if (oldest === undefined) break;
      offsets.delete(oldest);
    }
  }

  private ensureTab(tabId: number): TabWallState {
    let tab = this.perTab.get(tabId);
    if (tab === undefined) {
      tab = { offsets: new Map() };
      this.perTab.set(tabId, tab);
    }
    return tab;
  }

  /**
   * Lazy retention sweep for one tab: drop finalized offsets older than
   * {@link CDP_WALL_RETENTION_MS}. Insertion order is not monotonic in
   * `finalizedAtMs` (a long redirect chain finalizes after a later short
   * request), so every finalized entry is checked rather than early-exiting.
   * The tab's `lastOffsetSec` is independent of the per-request map, so it
   * survives the sweep and keeps backing the mid-attach fallback.
   */
  private gcFinalized(tabId: number, nowMs: number): void {
    const tab = this.perTab.get(tabId);
    if (tab === undefined) return;
    const cutoff = nowMs - CDP_WALL_RETENTION_MS;
    for (const [requestId, entry] of tab.offsets) {
      if (entry.finalizedAtMs !== undefined && entry.finalizedAtMs < cutoff) {
        tab.offsets.delete(requestId);
      }
    }
    if (tab.offsets.size === 0 && tab.lastOffsetSec === undefined) this.perTab.delete(tabId);
  }
}

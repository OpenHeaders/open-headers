/**
 * Per-`(tabId, requestId)` CORS context buffer (H5).
 *
 * Bridges the two webRequest events that together produce a CORS
 * verdict:
 *
 *   1. `onSendHeaders` records the outgoing `Origin` header
 *      (`recordOrigin`).
 *   2. `onHeadersReceived` consults the captured origin, classifies
 *      the response, and stores the verdict (`finalize`).
 *   3. Terminal phase (`onCompleted` / `onErrorOccurred`) reads the
 *      verdict once and drops the entry (`consume`).
 *
 * Cleanup posture is **eager** — the verdict is consumed inline at the
 * correlator's terminal-phase emission; nothing reads it again. Per-tab
 * LRU acts as a backstop only. This is the key SoC difference from
 * `FinalizedRetention`, which exists precisely because late HAR-side
 * consumers re-query state past the terminal phase.
 *
 * On redirect, the next hop fires its own `onSendHeaders` for the same
 * `requestId`; `recordOrigin` overwrites cleanly, so the captured
 * context always describes the current hop. The verdict drives the
 * pre-emit `error.code` refinement on the lifecycle (see
 * `cors-error-refinement.ts`); the verdict itself is engine-internal
 * and never reaches the wire.
 */

import { lifecycleKey } from '@openheaders/core/request-lifecycle';

import { MAX_CORS_ENTRIES_PER_TAB } from './cors-constants';
import type { CorsVerdict } from './cors-types';

interface PendingContext {
  /** `null` when the request carried no `Origin` header. */
  readonly origin: string | null;
  /** Set once `onHeadersReceived` fired; `undefined` until then. */
  readonly verdict?: CorsVerdict;
}

/**
 * Reason a context entry was dropped without a normal consume. Mirrors
 * the posture of `HarWaitingDropLogger` / `FifoEvictionLogger` so hosts
 * can wire a single drop-logging policy across all the per-tab buffers.
 */
export type CorsContextDropReason = 'lru' | 'tab-forgotten';

export type CorsContextDropLogger = (event: {
  tabId: number;
  requestId: string;
  reason: CorsContextDropReason;
}) => void;

export class CorsContextStore {
  private readonly perTab = new Map<number, Map<string, PendingContext>>();
  private readonly onDrop?: CorsContextDropLogger;

  constructor(onDrop?: CorsContextDropLogger) {
    this.onDrop = onDrop;
  }

  /**
   * Record the captured `Origin` for a `(tabId, requestId)`. Overwrites
   * a previous entry — required for redirect hops, where the same
   * `requestId` produces a fresh `onSendHeaders` per hop.
   *
   * Insertion-order touch-to-end keeps freshly-recorded entries at the
   * tail so the LRU evicts the oldest pending request first.
   */
  recordOrigin(tabId: number, requestId: string, origin: string | null): void {
    const tabMap = this.tabMap(tabId);
    const key = lifecycleKey(tabId, requestId);
    if (tabMap.has(key)) tabMap.delete(key);
    tabMap.set(key, { origin });
    this.evictIfFull(tabId, tabMap);
  }

  /**
   * Attach the classified verdict to the pending context. If there is
   * no prior `recordOrigin` (e.g. `onSendHeaders` was suppressed by the
   * host), the call still records a verdict-only entry — the verdict
   * is computed from the same headers and remains valid.
   */
  finalize(tabId: number, requestId: string, verdict: CorsVerdict): void {
    const tabMap = this.tabMap(tabId);
    const key = lifecycleKey(tabId, requestId);
    const prev = tabMap.get(key);
    if (tabMap.has(key)) tabMap.delete(key);
    tabMap.set(key, { origin: prev?.origin ?? null, verdict });
    this.evictIfFull(tabId, tabMap);
  }

  /** Read the captured `Origin` without consuming. Used at `onHeadersReceived`. */
  getOrigin(tabId: number, requestId: string): string | null {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return null;
    const ctx = tabMap.get(lifecycleKey(tabId, requestId));
    return ctx?.origin ?? null;
  }

  /**
   * Read and drop the verdict for a terminal-phase emission. Returns
   * `undefined` when nothing was ever recorded (request finished before
   * any header capture, e.g. a tracking-protection block).
   */
  consume(tabId: number, requestId: string): CorsVerdict | undefined {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return undefined;
    const key = lifecycleKey(tabId, requestId);
    const ctx = tabMap.get(key);
    if (!ctx) return undefined;
    tabMap.delete(key);
    if (tabMap.size === 0) this.perTab.delete(tabId);
    return ctx.verdict;
  }

  /**
   * Drop every entry for a tab (invariant 2). Fires `onDrop` with
   * `tab-forgotten` per entry so hosts can account for the loss.
   */
  forgetTab(tabId: number): void {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return;
    if (this.onDrop) {
      for (const key of tabMap.keys()) {
        this.onDrop({ tabId, requestId: parseRequestId(key), reason: 'tab-forgotten' });
      }
    }
    this.perTab.delete(tabId);
  }

  /** Total tracked entries across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  private tabMap(tabId: number): Map<string, PendingContext> {
    let m = this.perTab.get(tabId);
    if (!m) {
      m = new Map();
      this.perTab.set(tabId, m);
    }
    return m;
  }

  private evictIfFull(tabId: number, tabMap: Map<string, PendingContext>): void {
    while (tabMap.size > MAX_CORS_ENTRIES_PER_TAB) {
      const oldestKey = tabMap.keys().next().value;
      if (oldestKey === undefined) break;
      tabMap.delete(oldestKey);
      this.onDrop?.({ tabId, requestId: parseRequestId(oldestKey), reason: 'lru' });
    }
  }
}

/**
 * `lifecycleKey` is `${tabId}:${requestId}`. The store keys are scoped
 * to a per-tab map already, so the requestId portion follows the first
 * colon. Cheap parse that avoids a second map keyed by raw requestId.
 */
function parseRequestId(lifecycleKeyStr: string): string {
  const idx = lifecycleKeyStr.indexOf(':');
  return idx < 0 ? lifecycleKeyStr : lifecycleKeyStr.slice(idx + 1);
}

/**
 * Debug-level instrumentation for the request-lifecycle pipeline
 * (lifecycle audit §1.7). Counts each stage per tab — raw webRequest in,
 * raw HAR in, what the correlator emits, every HAR-loss site, and the
 * webRequest→handler processing lag — then logs a throttled per-tab
 * summary so a slow/offline repro shows exactly where OH's view diverges
 * from the browser's own Network panel.
 *
 * Pure observation: it implements {@link CorrelatorDiagnostics} (the
 * loss hooks) and offers `webRequestIn` / `harIn` / `emitted` taps the
 * host attaches as extra source/correlator subscribers. Nothing here
 * feeds back into correlation.
 *
 * Gated by the host on `data.logLevel === 'debug'` — only wired (and only
 * costing anything) when debug logging is on; otherwise the correlator
 * runs its plain path with no diagnostics object at all.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { CorrelatorDiagnostics, HarEvent, WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';
import { logger } from '@utils/logger';

/** Minimum gap between summary log lines per tab. */
const SUMMARY_THROTTLE_MS = 1500;

/** Cap on per-tab verbose drift samples — enough to read the divergence. */
const MAX_DRIFT_SAMPLES = 20;

interface TabCounters {
  wrBeforeRequest: number;
  wrCompleted: number;
  wrError: number;
  harEntry: number;
  harBody: number;
  emittedStarted: number;
  emittedHarAttached: number;
  emittedBodyAttached: number;
  emittedGone: number;
  joinMissNoKey: number;
  joinMissDrift: number;
  driftTooOld: number;
  driftTooNew: number;
  driftMethod: number;
  nearestDeltaMinMs: number | null;
  nearestDeltaMaxMs: number | null;
  driftSamplesLogged: number;
  retentionDrop: number;
  harWaitingDrop: number;
  fifoEviction: number;
  // Processing lag = Date.now() at our onBeforeRequest handler minus the
  // event's own timeStamp. ~0 ⇒ we process events as fast as Chrome fires
  // them (the request-discovery lag is then inherent webRequest trigger
  // timing); seconds ⇒ the SW event loop is backlogged and reducible.
  procLagSumMs: number;
  procLagCount: number;
  procLagMinMs: number | null;
  procLagMaxMs: number | null;
  lastLoggedAtMs: number;
}

function emptyCounters(): TabCounters {
  return {
    wrBeforeRequest: 0,
    wrCompleted: 0,
    wrError: 0,
    harEntry: 0,
    harBody: 0,
    emittedStarted: 0,
    emittedHarAttached: 0,
    emittedBodyAttached: 0,
    emittedGone: 0,
    joinMissNoKey: 0,
    joinMissDrift: 0,
    driftTooOld: 0,
    driftTooNew: 0,
    driftMethod: 0,
    nearestDeltaMinMs: null,
    nearestDeltaMaxMs: null,
    driftSamplesLogged: 0,
    retentionDrop: 0,
    harWaitingDrop: 0,
    fifoEviction: 0,
    procLagSumMs: 0,
    procLagCount: 0,
    procLagMinMs: null,
    procLagMaxMs: null,
    lastLoggedAtMs: 0,
  };
}

export class LifecycleDiagnostics implements CorrelatorDiagnostics {
  private readonly perTab = new Map<number, TabCounters>();

  webRequestIn(event: WebRequestEvent): void {
    if (event.tabId === -1) return;
    const c = this.tab(event.tabId);
    if (event.method_kind === 'onBeforeRequest') {
      c.wrBeforeRequest++;
      const lag = Date.now() - event.timeStamp;
      c.procLagSumMs += lag;
      c.procLagCount++;
      c.procLagMinMs = c.procLagMinMs === null ? lag : Math.min(c.procLagMinMs, lag);
      c.procLagMaxMs = c.procLagMaxMs === null ? lag : Math.max(c.procLagMaxMs, lag);
    } else if (event.method_kind === 'onCompleted') c.wrCompleted++;
    else if (event.method_kind === 'onErrorOccurred') c.wrError++;
    else return;
    this.touch(event.tabId, c);
  }

  harIn(event: HarEvent): void {
    if (event.tabId === -1) return;
    const c = this.tab(event.tabId);
    if (event.kind === 'har-entry') c.harEntry++;
    else c.harBody++;
    this.touch(event.tabId, c);
  }

  emitted(update: RequestLifecycleUpdate): void {
    const tabId = update.kind === 'started' ? update.lifecycle.tabId : update.tabId;
    if (tabId === -1) return;
    const c = this.tab(tabId);
    if (update.kind === 'started') c.emittedStarted++;
    else if (update.kind === 'har-attached') c.emittedHarAttached++;
    else if (update.kind === 'body-attached') c.emittedBodyAttached++;
    else if (update.kind === 'gone') c.emittedGone++;
    else return;
    this.touch(tabId, c);
  }

  // ---- CorrelatorDiagnostics loss hooks ----

  onFifoEviction = (info: { tabId: number; url: string; pendingCount: number }): void => {
    const c = this.tab(info.tabId);
    c.fifoEviction++;
    logger.warn('LifecycleDiag', 'in-flight FIFO evicted non-empty queue (join key lost)', info);
    this.touch(info.tabId, c);
  };

  onHarWaitingDrop = (info: { tabId: number; reason: string }): void => {
    const c = this.tab(info.tabId);
    c.harWaitingDrop++;
    this.touch(info.tabId, c);
  };

  onJoinMiss = (info: {
    tabId: number;
    url: string;
    method: string;
    harTimestamp: number;
    pending: number;
    methodMismatch: number;
    tooOld: number;
    tooNew: number;
    nearestDeltaMs: number | null;
  }): void => {
    const c = this.tab(info.tabId);
    if (info.pending === 0) {
      c.joinMissNoKey++;
      this.touch(info.tabId, c);
      return;
    }
    c.joinMissDrift++;
    // Classify by which gate the candidates fail (method gate first,
    // matching popMatching's own order).
    if (info.methodMismatch >= info.pending) c.driftMethod++;
    else if (info.tooOld > 0 && (info.nearestDeltaMs ?? 0) < 0) c.driftTooOld++;
    else if (info.tooNew > 0) c.driftTooNew++;
    if (info.nearestDeltaMs !== null) {
      c.nearestDeltaMinMs =
        c.nearestDeltaMinMs === null ? info.nearestDeltaMs : Math.min(c.nearestDeltaMinMs, info.nearestDeltaMs);
      c.nearestDeltaMaxMs =
        c.nearestDeltaMaxMs === null ? info.nearestDeltaMs : Math.max(c.nearestDeltaMaxMs, info.nearestDeltaMs);
    }
    if (c.driftSamplesLogged < MAX_DRIFT_SAMPLES) {
      c.driftSamplesLogged++;
      logger.warn('LifecycleDiag', 'HAR drift (key present, no match)', {
        url: info.url.length > 80 ? `${info.url.slice(0, 80)}…` : info.url,
        method: info.method,
        pending: info.pending,
        nearestDeltaMs: info.nearestDeltaMs,
        tooOld: info.tooOld,
        tooNew: info.tooNew,
        methodMismatch: info.methodMismatch,
      });
    }
    this.touch(info.tabId, c);
  };

  onRetentionDrop = (info: { tabId: number; requestId: string }): void => {
    const c = this.tab(info.tabId);
    c.retentionDrop++;
    this.touch(info.tabId, c);
  };

  private tab(tabId: number): TabCounters {
    let c = this.perTab.get(tabId);
    if (c === undefined) {
      c = emptyCounters();
      this.perTab.set(tabId, c);
    }
    return c;
  }

  private touch(tabId: number, c: TabCounters): void {
    const now = Date.now();
    if (now - c.lastLoggedAtMs < SUMMARY_THROTTLE_MS) return;
    c.lastLoggedAtMs = now;
    logger.info('LifecycleDiag', `tab ${tabId}`, {
      'webReq(start/done/err)': `${c.wrBeforeRequest}/${c.wrCompleted}/${c.wrError}`,
      'har(entry/body)': `${c.harEntry}/${c.harBody}`,
      'emit(started/har/body/gone)': `${c.emittedStarted}/${c.emittedHarAttached}/${c.emittedBodyAttached}/${c.emittedGone}`,
      'lostHAR(noKey/drift/retention/waitDrop/fifoEvict)': `${c.joinMissNoKey}/${c.joinMissDrift}/${c.retentionDrop}/${c.harWaitingDrop}/${c.fifoEviction}`,
      'drift(tooOld/tooNew/method)': `${c.driftTooOld}/${c.driftTooNew}/${c.driftMethod}`,
      'nearestDeltaMs(min..max)': `${c.nearestDeltaMinMs}..${c.nearestDeltaMaxMs}`,
      'procLagMs(min/avg/max)': `${c.procLagMinMs}/${
        c.procLagCount > 0 ? Math.round(c.procLagSumMs / c.procLagCount) : 0
      }/${c.procLagMaxMs}`,
    });
  }
}

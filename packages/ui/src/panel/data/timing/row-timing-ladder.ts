/**
 * The honest timing ladder for one row — the single builder both the Waterfall
 * popover and the Timing detail tab consume, so the two surfaces render the
 * identical model and can never drift.
 *
 * A {@link TimingLadder} needs a landed HAR entry (the `timings` block arrives
 * only when a request finishes), so this returns `null` for a row with no HAR
 * yet — an in-flight `(unknown)` / pending row, whose partial timing comes from
 * {@link computeInFlightTiming} off the lifecycle instead. While a row streams
 * (response in, body still downloading) the live Content Download leg is spliced
 * in — `duration − latency`, the same split the Time column and duration bar
 * grow by — so the breakdown tracks the row instead of freezing at the first
 * byte.
 */

import { currentHarEntry, type InspectorRowWithFires } from '../inspector-row-projection';
import { waterfallSortValue } from '../network-columns';
import { classifyRequestState, effectiveStatusCode, statusCellText } from '../request-state';
import { computeTimingLadder, type LadderContext, type TimingLadder } from './timing-ladder';
import { computeRawTimingLadder } from './timing-ladder-raw';
import type { WaterfallTerminal } from './timing-popover-model';

export function rowTimingLadder(row: InspectorRowWithFires): TimingLadder | null {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);
  if (har == null) return null;
  // Live Content Download while streaming (duration − latency) — before the
  // terminal HAR `receive` leg lands; `undefined` once finished (HAR is
  // authoritative). Once the raw terminal instant landed the raw decode is
  // authoritative the same way.
  const streaming = lc.completedAtMs == null && lc.lastActivityAtMs != null;
  const liveReceiveMs = streaming
    ? Math.max(waterfallSortValue(row, 'duration') - waterfallSortValue(row, 'latency'), 0)
    : undefined;
  // `reachedResponse` comes from the lifecycle status, not the timings — a
  // blocked row's wait/receive are `0`, not absent.
  const ctx: LadderContext = {
    reachedResponse: (effectiveStatusCode(lc) ?? 0) > 0,
    isHttps: lc.url.startsWith('https:'),
    liveReceiveMs,
  };
  // Data-driven: a hop carrying the unfolded raw instants decomposes
  // tab-exactly; the export-dialect decode is the floor for every other hop.
  return har._rawTiming !== undefined ? computeRawTimingLadder(har._rawTiming, ctx) : computeTimingLadder(har, ctx);
}

/**
 * Outcome marker for a terminal row whose ladder carries no response — blocked
 * before the wire, or a wire failure / cancel before any response. The label
 * mirrors the Status cell so the two never disagree; a popover or the Timing tab
 * swaps the fabricated Response / Ended instants for it. `undefined` for any row
 * that did reach a response (success, redirect, 4xx/5xx, cache, mid-body
 * failure), which carries a real `wait` / `receive` rung.
 */
export function noResponseTerminal(row: InspectorRowWithFires, ladder: TimingLadder): WaterfallTerminal | undefined {
  if (ladder.responseMs != null) return undefined; // a response arrived
  const kind = classifyRequestState(row.lifecycle).kind;
  if (kind !== 'blocked' && kind !== 'failed') return undefined;
  // Phase-aware detail: a request that did any network step (an `onWire` rung
  // elapsed) reached the network, then got no response; one with only local
  // scheduling / stalled time died before any wire activity. Worded at render
  // via `terminalDetailText`.
  const reachedNetwork = ladder.rungs.some((r) => r.onWire && r.state.kind === 'elapsed');
  return { label: statusCellText(row.lifecycle), detail: reachedNetwork ? 'no-response' : 'never-reached' };
}

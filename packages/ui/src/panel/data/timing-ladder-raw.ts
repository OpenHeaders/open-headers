/**
 * Instant-anchored timing ladder from raw protocol timing — the browser
 * Timing tab's own decomposition, leg-for-leg.
 *
 * The export-dialect decode (`computeTimingLadder`) reads the HAR `timings`
 * legs, which the exporter re-anchors and folds: the connection-stage gaps
 * (dnsEnd→connectStart, connectEnd→sendStart) are folded into the following
 * leg, so "Request sent" reads `sendEnd − max(connectEnd, dnsEnd, …)` rather
 * than the tab's `sendEnd − sendStart`. When a hop carries the unfolded
 * raw instants (`_rawTiming`, CDP-recorded hops), this decode reproduces
 * the tab's exact range math instead:
 *
 *   queueing  issue → requestTime
 *   stalled   0 → firstPositive(dnsStart, connectStart, sendStart, response)
 *   dns       dnsStart → dnsEnd
 *   TCP       connectStart → connectEnd, minus the TLS subset (the tab draws
 *             its connection bar OVER its SSL bar; ours is the
 *             non-overlapping split, anchored at connectStart)
 *   TLS       sslStart → sslEnd
 *   send      sendStart → sendEnd
 *   wait      max(sendEnd, connectEnd, dnsEnd, proxyEnd, stalledEnd) → response
 *   receive   response → end
 *
 * where `response` is the headers-received event instant clamped to at most
 * `requestTime + receiveHeadersEnd/1000` (the browser applies that exact
 * clamp when it adopts the timing block), and `end` is the terminal instant
 * clamped to at least `response`.
 *
 * Each rung's `startMs` is its true instant (relative to the queue moment),
 * so the inter-leg gaps live BETWEEN rungs — rendered by no rung, exactly
 * like the tab — and `durationMs` is the range span, not a leg sum. The
 * legend's footnote lists the gaps so the leg-sum-vs-total delta stays
 * explained (see `ladderFootnotes`).
 */

import type { InspectorRawTiming } from '@openheaders/core/types';
import {
  type LadderContext,
  RUNG_BANDS,
  RUNG_LABELS,
  RUNG_ORDER,
  type RungState,
  type TimingLadder,
  type TimingRung,
  type TimingRungKey,
} from './timing-ladder';

/** A recorded ms offset (≥ 0), or `undefined` when the leg did not occur. */
function off(v: number | undefined): number | undefined {
  return typeof v === 'number' && v >= 0 ? v : undefined;
}

/** First strictly-positive value, the tab's blocking-end resolver. */
function firstPositive(values: ReadonlyArray<number | undefined>): number | undefined {
  for (const v of values) {
    if (v !== undefined && v > 0) return v;
  }
  return undefined;
}

/** Largest recorded value, or `undefined` when none was. */
function maxRecorded(values: ReadonlyArray<number | undefined>): number | undefined {
  let best: number | undefined;
  for (const v of values) {
    if (v !== undefined && (best === undefined || v > best)) best = v;
  }
  return best;
}

/**
 * The effective first-byte offset (ms from `requestTimeSec`): the
 * headers-received event instant clamped to at most the timing block's
 * `receiveHeadersEnd` and at least 0 — the browser's own response-received
 * resolution. A redirect hop has no discrete event; the offset alone decides.
 */
export function rawFirstByteMs(raw: InspectorRawTiming): number | undefined {
  const rhe = off(raw.receiveHeadersEnd);
  const event =
    raw.responseReceivedSec !== undefined ? (raw.responseReceivedSec - raw.requestTimeSec) * 1000 : undefined;
  const effective = rhe === undefined ? event : event === undefined ? rhe : Math.min(event, rhe);
  return effective === undefined ? undefined : Math.max(effective, 0);
}

/**
 * The active span (ms): terminal instant minus the network start, clamped to
 * at least the first-byte offset — the browser's Time-column duration
 * (`endTime − startTime`, queueing excluded). `undefined` until terminal.
 */
export function rawSpanMs(raw: InspectorRawTiming): number | undefined {
  if (raw.endSec === undefined) return undefined;
  const end = (raw.endSec - raw.requestTimeSec) * 1000;
  return Math.max(end, rawFirstByteMs(raw) ?? 0, 0);
}

/**
 * Build the instant-anchored eight-rung ladder from a hop's raw timing. Same
 * output type as the dialect decode — every consumer reads one model — but
 * rungs carry their true instants and `durationMs` is the span.
 */
export function computeRawTimingLadder(raw: InspectorRawTiming, ctx: LadderContext): TimingLadder {
  // Queueing: issue → requestTime, clamped (the tab only draws it when the
  // issue instant precedes the network start).
  const q = Math.max((raw.requestTimeSec - raw.issuedSec) * 1000, 0);

  const dnsStart = off(raw.dnsStart);
  const dnsEnd = off(raw.dnsEnd);
  const connectStart = off(raw.connectStart);
  const connectEnd = off(raw.connectEnd);
  const sslStart = off(raw.sslStart);
  const sslEnd = off(raw.sslEnd);
  const sendStart = off(raw.sendStart);
  const sendEnd = off(raw.sendEnd);
  const proxyEnd = off(raw.proxyEnd);

  const responseOff = rawFirstByteMs(raw);
  const endOff = rawSpanMs(raw);

  // Stalled: 0 → the first connection-stage activity (the tab's blocking end;
  // a zero offset is skipped by its first-positive scan).
  const stalledEnd = firstPositive([dnsStart, connectStart, sendStart, responseOff]) ?? 0;

  const sslDur = sslStart !== undefined && sslEnd !== undefined ? sslEnd - sslStart : 0;

  // The wait rung's left edge — the highest recorded connection-stage end
  // (the tab's WAITING start; ssl is inside connect and not consulted).
  const waitStart = maxRecorded([sendEnd, connectEnd, dnsEnd, proxyEnd, stalledEnd]) ?? 0;

  const setupAbsent = (): RungState => (ctx.reachedResponse ? { kind: 'reused' } : { kind: 'not-reached' });
  const exchangeAbsent = (): RungState => (ctx.reachedResponse ? { kind: 'unknown' } : { kind: 'not-reached' });

  // Per-rung (state, true instant). An absent rung sits at the running cursor
  // (the previous rung's end) and adds no width, like the dialect ladder.
  const resolve = (key: TimingRungKey): { state: RungState; instant?: number } => {
    switch (key) {
      case 'queueing':
        return { state: { kind: 'elapsed', ms: q }, instant: 0 };
      case 'stalled':
        return { state: { kind: 'elapsed', ms: stalledEnd }, instant: q };
      case 'dns':
        if (dnsStart !== undefined && dnsEnd !== undefined) {
          return { state: { kind: 'elapsed', ms: dnsEnd - dnsStart }, instant: q + dnsStart };
        }
        return { state: setupAbsent() };
      case 'connect':
        if (connectStart !== undefined && connectEnd !== undefined) {
          return {
            state: { kind: 'elapsed', ms: Math.max(connectEnd - connectStart - sslDur, 0) },
            instant: q + connectStart,
          };
        }
        return { state: setupAbsent() };
      case 'ssl':
        if (sslStart !== undefined && sslEnd !== undefined) {
          return { state: { kind: 'elapsed', ms: sslEnd - sslStart }, instant: q + sslStart };
        }
        return { state: ctx.isHttps ? setupAbsent() : { kind: 'na' } };
      case 'send':
        if (sendStart !== undefined && sendEnd !== undefined) {
          return { state: { kind: 'elapsed', ms: sendEnd - sendStart }, instant: q + sendStart };
        }
        return { state: exchangeAbsent() };
      case 'wait':
        if (responseOff !== undefined) {
          return { state: { kind: 'elapsed', ms: Math.max(responseOff - waitStart, 0) }, instant: q + waitStart };
        }
        return { state: exchangeAbsent() };
      case 'receive':
        if (ctx.reachedResponse && ctx.liveReceiveMs != null) {
          return { state: { kind: 'elapsed', ms: ctx.liveReceiveMs }, instant: q + (responseOff ?? waitStart) };
        }
        if (endOff !== undefined && responseOff !== undefined) {
          return { state: { kind: 'elapsed', ms: Math.max(endOff - responseOff, 0) }, instant: q + responseOff };
        }
        return { state: exchangeAbsent() };
    }
  };

  const rungs: TimingRung[] = [];
  let cursor = 0;
  for (const key of RUNG_ORDER) {
    const { state, instant } = resolve(key);
    const startMs = instant ?? cursor;
    if (state.kind === 'elapsed') cursor = Math.max(cursor, startMs + state.ms);
    rungs.push({
      key,
      label: RUNG_LABELS[key],
      band: RUNG_BANDS[key],
      onWire: RUNG_BANDS[key] !== 'before-wire',
      state,
      startMs,
    });
  }

  // The span (queued → ended): the terminal instant when known; while
  // streaming, the first byte plus the live download leg; else as far as the
  // instants reach. Never less than the rungs' own extent.
  const streamingEnd =
    endOff === undefined && ctx.liveReceiveMs != null && responseOff !== undefined
      ? responseOff + ctx.liveReceiveMs
      : undefined;
  const durationMs = Math.max(q + (endOff ?? streamingEnd ?? responseOff ?? 0), cursor);

  return {
    rungs,
    startedMs: q,
    responseMs: ctx.reachedResponse && responseOff !== undefined ? q + responseOff : null,
    endedMs: ctx.reachedResponse ? durationMs : null,
    durationMs,
    instantAnchored: true,
  };
}

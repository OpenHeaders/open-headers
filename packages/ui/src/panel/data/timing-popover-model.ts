/**
 * Shared semantics for the two timing-ladder popovers (vertical + horizontal).
 *
 * Both renderers consume one {@link TimingLadder}; everything that could let
 * them disagree — the band names + where they run, which rungs compose each
 * metric ("explain"), the absent-rung wording, and the warm-socket hint — lives
 * here as a single source of truth, so the two views can never drift. The
 * renderers add no timing math of their own.
 */

import type { WaterfallMetric } from './network-columns';
import type { RungState, TimingBand, TimingLadder, TimingRungKey } from './timing-ladder';

/**
 * Outcome for a terminal request that never received a response — blocked
 * before the wire, or a wire failure before any response. `label` mirrors the
 * Status cell (`(blocked:other)`, `(canceled)`, `(failed) net::ERR_…`); `detail`
 * is the one-line explanation. When present, a popover hides the Response /
 * Ended instants (there was no response to time) and shows this marker instead.
 */
export interface WaterfallTerminal {
  label: string;
  detail: string;
}

/** Band display name — the high-level stage each rung belongs to. */
export const BAND_LABEL: Record<TimingBand, string> = {
  'before-wire': 'Scheduling',
  connecting: 'Connecting',
  exchange: 'Transferring',
};

/** Where each band runs — the wire story, spelled out: local, the handshake
 *  round-trips, then data flowing over the network. */
export const BAND_WHERE: Record<TimingBand, string> = {
  'before-wire': '(Browser)',
  connecting: '(Browser ↔ Network)',
  exchange: '(Network)',
};

export const BAND_ORDER: readonly TimingBand[] = ['before-wire', 'connecting', 'exchange'];

/** Tooltip for a `TCP 0µs` rung where TLS still ran — the socket's TCP leg was
 *  already established off this request's clock (preconnect or a warm path;
 *  `connectStart == secureConnectionStart`). Hedges the likely cause, claims no
 *  mechanism the timings can't prove. */
export const WARM_SOCKET_TITLE =
  "No TCP handshake on this request's clock — the socket was already established (likely preconnected). " +
  'Only TLS ran here.';

/** The reason an absent rung did not run, shown in place of a duration. */
export function absentText(state: Exclude<RungState, { kind: 'elapsed' }>): string {
  switch (state.kind) {
    case 'reused':
      return 'connection reused';
    case 'not-reached':
      return 'not reached';
    case 'na':
      return 'n/a';
    case 'unknown':
      return 'no data';
  }
}

export type Anchor = 'queued' | 'started';

/** A key moment in a request's life — a boundary instant with a plain-language
 *  meaning. `localMs` is the offset from the queue moment (Queued = 0); a caller
 *  adds the request's own queue offset for an absolute "… at" reading. */
export interface KeyMoment {
  key: Anchor | 'response' | 'ended';
  label: string;
  localMs: number;
  why: string;
}

/**
 * The key moments to show, in order: Queued and Started always; Response and
 * Ended only when a response actually arrived (a terminal request that never
 * got one shows neither — the caller surfaces the stop instead). One source for
 * both the popover header and the Timing tab, so the two can't disagree on which
 * instants exist or what they mean.
 */
export function keyMoments(ladder: TimingLadder): KeyMoment[] {
  const moments: KeyMoment[] = [
    { key: 'queued', label: 'Queued', localMs: 0, why: 'request created' },
    { key: 'started', label: 'Started', localMs: ladder.startedMs, why: 'left the queue' },
  ];
  if (ladder.responseMs != null) {
    moments.push({ key: 'response', label: 'Response', localMs: ladder.responseMs, why: 'first byte (TTFB)' });
  }
  if (ladder.endedMs != null) {
    moments.push({ key: 'ended', label: 'Ended', localMs: ladder.endedMs, why: 'last byte, done' });
  }
  return moments;
}

export interface ExplainSpec {
  /** The instant the metric measures FROM (highlighted with a ↓), or `null` for
   *  the aggregate metrics. */
  anchor: Anchor | null;
  /** The rungs that elapse from the anchor to the metric's instant. */
  rungs: ReadonlySet<TimingRungKey>;
  /** Highlight the Duration total instead (aggregate metrics). */
  total: boolean;
}

/**
 * What the active metric is built from: Start = Queued + Queueing; Response and
 * End anchor at Started and run through their rungs; Duration / Latency are the
 * aggregate, so they highlight the total.
 */
export function explainSpec(metric: WaterfallMetric): ExplainSpec {
  if (metric === 'startTime') return { anchor: 'queued', rungs: new Set(['queueing']), total: false };
  if (metric === 'responseTime') {
    return { anchor: 'started', rungs: new Set(['stalled', 'dns', 'connect', 'ssl', 'send', 'wait']), total: false };
  }
  if (metric === 'endTime') {
    return {
      anchor: 'started',
      rungs: new Set(['stalled', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']),
      total: false,
    };
  }
  return { anchor: null, rungs: new Set(), total: true };
}

/** The `connect` rung is a "warm socket" when its TCP leg cost `0µs` on this
 *  request's clock yet TLS still ran — the socket was established earlier
 *  (preconnect / warm path), so only TLS ran here. */
export function isWarmSocketConnect(ladder: TimingLadder): boolean {
  const connect = ladder.rungs.find((r) => r.key === 'connect')?.state;
  const tls = ladder.rungs.find((r) => r.key === 'ssl')?.state;
  const tlsRan = tls?.kind === 'elapsed' && tls.ms > 0;
  return connect?.kind === 'elapsed' && connect.ms === 0 && tlsRan;
}

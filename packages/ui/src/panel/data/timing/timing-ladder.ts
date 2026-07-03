/**
 * Timing ladder — the honest, full-picture breakdown of one request's life.
 *
 * Unlike a peeled phase list (which drops zero phases and can make a whole rung
 * vanish), the ladder ALWAYS emits the same eight rungs
 * in order, each with an explicit state — a real duration (including `0` for a
 * step that happened instantly), or a reason it is absent (`reused` / `not
 * reached` / `n/a` / `unknown`). Nothing is hidden and nothing is fabricated;
 * every number traces to a raw HAR field.
 *
 * The eight rungs, and the wire boundary that splits them:
 *
 *   BEFORE THE WIRE (browser bookkeeping)
 *     queueing  — waiting in the scheduler for permission to start
 *     stalled   — allowed to start, waiting for a free socket / proxy
 *   ─ 🌐 on the wire ─
 *   CONNECTING
 *     dns       — hostname → IP
 *     connect   — TCP handshake ONLY (see the connect/ssl note below)
 *     ssl       — TLS handshake
 *   EXCHANGE
 *     send      — push the request bytes onto the wire
 *     wait      — waiting for the first response byte (TTFB)
 *     receive   — downloading the response body
 *
 * The connect/dns/ssl truth (read from the exporter's own leg math): the
 * exported `connect` leg is anchored at the DNS START when a lookup ran —
 * it spans the DNS leg AND the TLS handshake (which is why the exported
 * `time`, a plain leg sum, over-counts dns-bearing requests by their DNS
 * leg). So the honest, non-overlapping split is
 * `TCP = connect − ssl − dns` (dns only when it elapsed; a reused / no-DNS
 * entry has `dns: -1` and the exported connect starts at `connectStart`).
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

export type TimingRungKey = 'queueing' | 'stalled' | 'dns' | 'connect' | 'ssl' | 'send' | 'wait' | 'receive';

/** Top-level band a rung belongs to — the wire boundary falls between
 *  `before-wire` and `connecting`. */
export type TimingBand = 'before-wire' | 'connecting' | 'exchange';

/**
 * A rung's state — the whole point of the ladder is that this is explicit:
 *   - `elapsed`     the step happened and took `ms` (≥ 0; `0` = instant).
 *   - `reused`      a setup step skipped because the socket was already open.
 *   - `not-reached` the request ended (blocked / failed) before this step.
 *   - `na`          the step does not apply (TLS on a plain `http://` request).
 *   - `unknown`     the step may have run but nothing recorded it — a floor
 *                   timings block measured only at the wire events (no `send`
 *                   leg). Distinct from `reused`: claiming a warm socket the
 *                   data can't prove would be fabrication.
 */
export type RungState =
  | { readonly kind: 'elapsed'; readonly ms: number }
  | { readonly kind: 'reused' }
  | { readonly kind: 'not-reached' }
  | { readonly kind: 'na' }
  | { readonly kind: 'unknown' };

export interface TimingRung {
  readonly key: TimingRungKey;
  readonly label: string;
  readonly band: TimingBand;
  /** `false` for `queueing` / `stalled` (local), `true` for the rest (network). */
  readonly onWire: boolean;
  readonly state: RungState;
  /** Cumulative ms offset from the queue moment where this rung starts — the
   *  left edge of its bar. Absent (non-elapsed) rungs sit at the cursor and add
   *  no width, so the cursor only advances on real elapsed time. */
  readonly startMs: number;
}

export interface TimingLadder {
  /** Always eight rungs, in wire order. */
  readonly rungs: readonly TimingRung[];
  /** Local instants, relative to the queue moment (Queued = 0). The caller adds
   *  the request's own queue offset for display. `null` instants never happened
   *  (no response arrived). */
  readonly startedMs: number;
  readonly responseMs: number | null;
  readonly endedMs: number | null;
  /** Total elapsed time. For a dialect (cursor) ladder this is the sum of the
   *  elapsed rungs (= HAR `time`); for an instant-anchored ladder it is the
   *  true span (queued → ended), which the rungs need not sum to — the
   *  inter-leg gaps belong to no rung. */
  readonly durationMs: number;
  /** `true` when each rung's `startMs` is a real recorded instant (raw protocol
   *  timing) rather than the cumulative cursor — rungs may then have gaps
   *  between them, and `durationMs` is the range span, not a leg sum. */
  readonly instantAnchored: boolean;
}

export interface LadderContext {
  /** The request received response headers (a first byte arrived). Decides
   *  whether an absent setup step reads `reused` vs `not reached`, and whether
   *  the exchange steps are `elapsed` vs `not reached`. Caller derives it from
   *  the lifecycle (a positive HTTP status), not from the timings. */
  readonly reachedResponse: boolean;
  /** `https://` request — TLS applies. An `http://` request shows TLS as `n/a`. */
  readonly isHttps: boolean;
  /** Live Content Download override while streaming (duration − latency) — the
   *  growing value shown before the terminal HAR `receive` lands. */
  readonly liveReceiveMs?: number;
}

export const RUNG_LABELS: Record<TimingRungKey, string> = {
  queueing: 'Queueing',
  stalled: 'Stalled',
  dns: 'DNS Lookup',
  // The TCP-handshake leg only (`connect − ssl − dns`); the exported `connect`
  // is the whole connection setup from the DNS start *including* TLS, which we
  // split out as their own rungs.
  connect: 'TCP',
  ssl: 'TLS',
  send: 'Request sent',
  wait: 'Waiting for server',
  receive: 'Content Download',
};

export const RUNG_BANDS: Record<TimingRungKey, TimingBand> = {
  queueing: 'before-wire',
  stalled: 'before-wire',
  dns: 'connecting',
  connect: 'connecting',
  ssl: 'connecting',
  send: 'exchange',
  wait: 'exchange',
  receive: 'exchange',
};

export const RUNG_ORDER: readonly TimingRungKey[] = [
  'queueing',
  'stalled',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
];

/** A HAR timing field is "present" (the step occurred) when it is a number ≥ 0;
 *  `-1` (or undefined) means the step did not happen. */
function present(v: number | undefined): boolean {
  return typeof v === 'number' && v >= 0;
}

/** Non-negative duration of a HAR field (`-1` / undefined → 0). */
function dur(v: number | undefined): number {
  return typeof v === 'number' && v > 0 ? v : 0;
}

/**
 * Build the full eight-rung ladder for a HAR entry. Pure; every rung is always
 * present. `connect` is decomposed to TCP-only (`connect − ssl`); a download
 * override drives the live in-flight value.
 */
export function computeTimingLadder(har: InspectorHarEntry, ctx: LadderContext): TimingLadder | null {
  const t = har.timings;
  if (!t) return null;

  const queueing = dur(t._blocked_queueing);
  const stalled = Math.max(0, dur(t.blocked) - queueing);
  // The exporter's connect leg is dns-anchored when a lookup ran (see the
  // module note) — peel both dns and ssl out for the TCP-only rung.
  const tcp = present(t.connect) ? Math.max(0, dur(t.connect) - dur(t.ssl) - dur(t.dns)) : -1;

  // A floor block — measured only at the wire events, no `send` leg recorded.
  // Its absent steps are UNKNOWN (nothing recorded them), never `reused`
  // (which claims a warm socket) and never `0` (which claims an instant step).
  const floor = !present(t.send);

  // The absent-reason for a setup step (dns / connect / ssl) that did not run:
  // a reused socket when a response arrived, otherwise the request never got
  // that far. TLS additionally reads `n/a` on a plaintext request.
  const setupAbsent = (): RungState => {
    if (!ctx.reachedResponse) return { kind: 'not-reached' };
    return floor ? { kind: 'unknown' } : { kind: 'reused' };
  };

  const exchange = (v: number | undefined): RungState => {
    if (!ctx.reachedResponse) return { kind: 'not-reached' };
    return present(v) ? { kind: 'elapsed', ms: dur(v) } : { kind: 'unknown' };
  };

  const stateOf = (key: TimingRungKey): RungState => {
    switch (key) {
      case 'queueing':
        if (present(t._blocked_queueing)) return { kind: 'elapsed', ms: queueing };
        return floor ? { kind: 'unknown' } : { kind: 'elapsed', ms: 0 };
      case 'stalled':
        return { kind: 'elapsed', ms: stalled };
      case 'dns':
        return present(t.dns) ? { kind: 'elapsed', ms: dur(t.dns) } : setupAbsent();
      case 'connect':
        return tcp >= 0 ? { kind: 'elapsed', ms: tcp } : setupAbsent();
      case 'ssl':
        if (present(t.ssl)) return { kind: 'elapsed', ms: dur(t.ssl) };
        return ctx.isHttps ? setupAbsent() : { kind: 'na' };
      case 'send':
        return exchange(t.send);
      case 'wait':
        return exchange(t.wait);
      case 'receive':
        if (ctx.reachedResponse && ctx.liveReceiveMs != null) return { kind: 'elapsed', ms: ctx.liveReceiveMs };
        return exchange(t.receive);
    }
  };

  const rungs: TimingRung[] = [];
  let cursor = 0;
  for (const key of RUNG_ORDER) {
    const state = stateOf(key);
    const startMs = cursor;
    if (state.kind === 'elapsed') cursor += state.ms;
    rungs.push({
      key,
      label: RUNG_LABELS[key],
      band: RUNG_BANDS[key],
      onWire: RUNG_BANDS[key] !== 'before-wire',
      state,
      startMs,
    });
  }

  const elapsedUpTo = (key: TimingRungKey): number => {
    const rung = rungs.find((r) => r.key === key);
    if (rung === undefined) return cursor;
    return rung.state.kind === 'elapsed' ? rung.startMs + rung.state.ms : rung.startMs;
  };

  const startedMs = elapsedUpTo('queueing'); // queue moment + queueing
  const responseMs = ctx.reachedResponse ? elapsedUpTo('wait') : null;
  const endedMs = ctx.reachedResponse ? cursor : null;

  return { rungs, startedMs, responseMs, endedMs, durationMs: cursor, instantAnchored: false };
}

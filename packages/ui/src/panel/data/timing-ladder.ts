/**
 * Timing ladder — the honest, full-picture breakdown of one request's life.
 *
 * Unlike the legacy `computeTimingPhases` (which peels, drops zero phases, and
 * can make a whole rung vanish), the ladder ALWAYS emits the same eight rungs
 * in order, each with an explicit state — a real duration (including `0` for a
 * step that happened instantly), or a reason it is absent (`reused` / `not
 * reached` / `n/a`). Nothing is hidden and nothing is fabricated; every number
 * traces to a raw HAR field.
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
 * The connect/ssl truth (verified against HAR's own `time`): HAR `connect`
 * spans `connectStart → connectEnd` and INCLUDES the TLS handshake, but NOT
 * DNS (DNS is a separate, earlier field). So the honest, non-overlapping split
 * is `Initial connection (TCP) = connect − ssl` and `TLS = ssl`. Chrome instead
 * shows the two as overlapping bars (both read the full connection time when
 * TLS dominates); the legacy code peeled `connect − ssl − dns`, double-counting
 * DNS out and making the TCP rung collapse to ~0. The ladder uses `connect − ssl`.
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
 */
export type RungState =
  | { readonly kind: 'elapsed'; readonly ms: number }
  | { readonly kind: 'reused' }
  | { readonly kind: 'not-reached' }
  | { readonly kind: 'na' };

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
  /** Total elapsed time — the sum of the elapsed rungs (= HAR `time`). */
  readonly durationMs: number;
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

const LABELS: Record<TimingRungKey, string> = {
  queueing: 'Queueing',
  stalled: 'Stalled',
  dns: 'DNS Lookup',
  // The TCP-handshake leg only (`connect − ssl`); HAR's `connect` is the whole
  // connection setup *including* TLS, which we split out as its own `ssl` rung.
  connect: 'TCP',
  ssl: 'TLS',
  send: 'Request sent',
  wait: 'Waiting for server',
  receive: 'Content Download',
};

const BANDS: Record<TimingRungKey, TimingBand> = {
  queueing: 'before-wire',
  stalled: 'before-wire',
  dns: 'connecting',
  connect: 'connecting',
  ssl: 'connecting',
  send: 'exchange',
  wait: 'exchange',
  receive: 'exchange',
};

const ORDER: readonly TimingRungKey[] = ['queueing', 'stalled', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];

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
  const tcp = present(t.connect) ? Math.max(0, dur(t.connect) - dur(t.ssl)) : -1;
  const receive = ctx.liveReceiveMs != null ? ctx.liveReceiveMs : dur(t.receive);

  // The absent-reason for a setup step (dns / connect / ssl) that did not run:
  // a reused socket when a response arrived, otherwise the request never got
  // that far. TLS additionally reads `n/a` on a plaintext request.
  const setupAbsent = (): RungState => (ctx.reachedResponse ? { kind: 'reused' } : { kind: 'not-reached' });

  const stateOf = (key: TimingRungKey): RungState => {
    switch (key) {
      case 'queueing':
        return { kind: 'elapsed', ms: queueing };
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
        return ctx.reachedResponse ? { kind: 'elapsed', ms: dur(t.send) } : { kind: 'not-reached' };
      case 'wait':
        return ctx.reachedResponse ? { kind: 'elapsed', ms: dur(t.wait) } : { kind: 'not-reached' };
      case 'receive':
        return ctx.reachedResponse ? { kind: 'elapsed', ms: receive } : { kind: 'not-reached' };
    }
  };

  const rungs: TimingRung[] = [];
  let cursor = 0;
  for (const key of ORDER) {
    const state = stateOf(key);
    const startMs = cursor;
    if (state.kind === 'elapsed') cursor += state.ms;
    rungs.push({ key, label: LABELS[key], band: BANDS[key], onWire: BANDS[key] !== 'before-wire', state, startMs });
  }

  const elapsedUpTo = (key: TimingRungKey): number => {
    const rung = rungs.find((r) => r.key === key);
    if (rung === undefined) return cursor;
    return rung.state.kind === 'elapsed' ? rung.startMs + rung.state.ms : rung.startMs;
  };

  const startedMs = elapsedUpTo('queueing'); // queue moment + queueing
  const responseMs = ctx.reachedResponse ? elapsedUpTo('wait') : null;
  const endedMs = ctx.reachedResponse ? cursor : null;

  return { rungs, startedMs, responseMs, endedMs, durationMs: cursor };
}

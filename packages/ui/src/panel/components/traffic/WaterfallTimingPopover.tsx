/**
 * Vertical timing ladder — the hover breakdown for a Waterfall bar.
 *
 * Renders the full eight-rung ladder from {@link TimingLadder}: every rung is
 * always shown, with a cumulative mini-bar and either its real value (including
 * `0µs` for a step that happened instantly) or an explicit reason it is absent
 * (`reused` / `not reached` / `n/a`). Each band's header names where it runs
 * (Browser → Browser ↔ Network → Network), so the wire crossing reads inline.
 *
 * Instants are real-only: Queued and Started always; Response and Ended only
 * when a response actually arrived. A terminal request that never got a response
 * (blocked / failed before the wire) shows an outcome marker in their place.
 *
 * When "explain" is on, the anchor instant the active metric measures FROM is
 * highlighted with a ↓, and the rungs that elapse from it to the metric's
 * instant are highlighted too — so the user reads "anchor + these rungs = the
 * value", not a lone restatement.
 *
 * Pure presentation over the ladder — no peeling, no dropped phases, no
 * fabricated instants. Every number traces to a raw HAR field.
 */

import { formatTimeMs } from '../../data/format-time';
import type { WaterfallMetric } from '../../data/network-columns';
import type { RungState, TimingBand, TimingLadder, TimingRungKey } from '../../data/timing-ladder';

/**
 * Outcome for a terminal request that never received a response — blocked
 * before the wire, or a wire failure before any response. `label` mirrors the
 * Status cell (`(blocked:other)`, `(canceled)`, `(failed) net::ERR_…`); `detail`
 * is the one-line explanation. When present, the popover hides the Response /
 * Ended instants (there was no response to time) and shows this marker instead.
 */
export interface WaterfallTerminal {
  label: string;
  detail: string;
}

const BAND_LABEL: Record<TimingBand, string> = {
  'before-wire': 'Scheduling',
  connecting: 'Connecting',
  exchange: 'Transferring',
};

/** Where each band runs — the wire story, spelled out: local, the handshake
 *  round-trips, then data flowing over the network. */
const BAND_WHERE: Record<TimingBand, string> = {
  'before-wire': '(Browser)',
  connecting: '(Browser ↔ Network)',
  exchange: '(Network)',
};

const BAND_ORDER: readonly TimingBand[] = ['before-wire', 'connecting', 'exchange'];

/** Tooltip for a `TCP 0µs` rung where TLS still ran — the socket's TCP leg was
 *  already established off this request's clock (preconnect or a warm path;
 *  `connectStart == secureConnectionStart`). Hedges the likely cause, claims no
 *  mechanism the timings can't prove. */
const WARM_SOCKET_TITLE =
  "No TCP handshake on this request's clock — the socket was already established (likely preconnected). " +
  'Only TLS ran here.';

/** The reason an absent rung did not run, shown in place of a duration. */
function absentText(state: Exclude<RungState, { kind: 'elapsed' }>): string {
  switch (state.kind) {
    case 'reused':
      return 'connection reused';
    case 'not-reached':
      return 'not reached';
    case 'na':
      return 'n/a';
  }
}

type Anchor = 'queued' | 'started';

interface ExplainSpec {
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
function explainSpec(metric: WaterfallMetric): ExplainSpec {
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

export function WaterfallTimingPopover({
  ladder,
  queuedAtMs,
  metric,
  explain,
  unfinished,
  terminal,
  reusedOpener,
}: {
  ladder: TimingLadder;
  /** Issue time relative to the timeline zero (the earliest request in view) —
   *  added to the ladder's local instants for the absolute "… at" header. */
  queuedAtMs: number;
  metric: WaterfallMetric;
  /** Show what the active metric is composed of (anchor + contributing rungs). */
  explain: boolean;
  /** Still streaming — Content Download and the total are growing, not final. */
  unfinished?: boolean;
  /** A terminal request that never received a response (see {@link WaterfallTerminal}). */
  terminal?: WaterfallTerminal;
  /** Display name of the request that opened this row's reused connection. */
  reusedOpener?: string;
}) {
  const at = (localMs: number) => formatTimeMs(queuedAtMs + localMs);
  const spec = explain ? explainSpec(metric) : null;
  // Every rung's bar is positioned on the same [0, duration] track, so the rows
  // stack into a cumulative waterfall. Guard a zero-duration request.
  const span = ladder.durationMs > 0 ? ladder.durationMs : 1;
  const pct = (ms: number) => `${(ms / span) * 100}%`;
  const anyReused = ladder.rungs.some((r) => r.state.kind === 'reused');
  // A `TCP 0µs` rung means no TCP handshake on this request's clock; when TLS
  // still ran, the socket's TCP leg was set up earlier (preconnect / warm path).
  const tlsState = ladder.rungs.find((r) => r.key === 'ssl')?.state;
  const tlsRan = tlsState?.kind === 'elapsed' && tlsState.ms > 0;

  // A milestone: the moment a key boundary happened (offset from the first
  // request in view), with a plain-language meaning. Computed cumulatively from
  // the rungs. The anchored milestone (the one the active metric measures FROM)
  // is highlighted with a ↓ pointing at its contributing rungs below.
  const moment = (line: Anchor | 'response' | 'ended', label: string, localMs: number, why: string) => {
    const isAnchor = spec?.anchor === line;
    return (
      <div className={`dt-waterfall-pop-moment${isAnchor ? ' dt-wf-pop-anchor' : ''}`}>
        <span className="dt-waterfall-pop-moment-label">{label}</span>
        <span className="dt-waterfall-pop-moment-value">{at(localMs)}</span>
        <span className="dt-waterfall-pop-moment-why">{why}</span>
        {isAnchor && <span className="dt-wf-pop-down">↓</span>}
      </div>
    );
  };

  return (
    // Stop clicks here from reaching the row's select handler: antd portals the
    // popover to <body>, but React replays events through the component tree, so
    // a click inside would otherwise bubble to the row and open the request.
    // biome-ignore lint/a11y/useKeyWithClickEvents: guard only, not an interactive element
    <div className="dt-waterfall-pop" onClick={(e) => e.stopPropagation()}>
      <div className="dt-waterfall-pop-start">
        <div className="dt-waterfall-pop-head">
          <span>Key moments</span>
          <span className="dt-waterfall-pop-where">(since the first request)</span>
        </div>
        {moment('queued', 'Queued', 0, 'request created')}
        {moment('started', 'Started', ladder.startedMs, 'left the queue')}
        {ladder.responseMs != null && moment('response', 'Response', ladder.responseMs, 'first byte (TTFB)')}
        {ladder.endedMs != null && moment('ended', 'Ended', ladder.endedMs, 'last byte, done')}
      </div>
      {/* The phase region is a little chart: down the Y axis = the steps in
          sequence, across the X axis = elapsed time (the bars flow right). The
          axes (drawn in CSS, arrowheads at the far ends) frame it so that
          reading is explicit. */}
      <div className="dt-waterfall-pop-phases">
        <span className="dt-waterfall-pop-axis-x" aria-hidden="true">Elapsed time</span>
        <span className="dt-waterfall-pop-axis-y" aria-hidden="true">
          {'Steps'.split('').map((ch, i) => (
            <span key={`${ch}-${i}`}>{ch}</span>
          ))}
        </span>
        {BAND_ORDER.map((band) => (
          <div key={band} className="dt-waterfall-pop-group">
          <div className="dt-waterfall-pop-head">
            <span>{BAND_LABEL[band]}</span>
            <span className="dt-waterfall-pop-where">{BAND_WHERE[band]}</span>
          </div>
          {band === 'connecting' && anyReused && reusedOpener && (
            <div className="dt-waterfall-pop-note">↳ connection opened by {reusedOpener}</div>
          )}
          {ladder.rungs
            .filter((r) => r.band === band)
            .map((r) => {
              const hl = spec?.rungs.has(r.key) ? ' dt-waterfall-pop-row--hl' : '';
              const absent = r.state.kind !== 'elapsed';
              const warmSocket = r.key === 'connect' && r.state.kind === 'elapsed' && r.state.ms === 0 && tlsRan;
              return (
                <div
                  key={r.key}
                  className={`dt-waterfall-pop-row${absent ? ' dt-waterfall-pop-row--absent' : ''}${hl}`}
                  title={warmSocket ? WARM_SOCKET_TITLE : undefined}
                >
                  <span className={`dt-waterfall-pop-swatch dt-wf-fill--${r.key}`} aria-hidden="true" />
                  <span className="dt-waterfall-pop-label">
                    <span className="dt-waterfall-pop-stepno">{ladder.rungs.indexOf(r) + 1}.</span> {r.label}
                  </span>
                  {r.state.kind === 'elapsed' ? (
                    <>
                      <span className="dt-waterfall-pop-track" aria-hidden="true">
                        <span
                          className={`dt-waterfall-pop-seg dt-wf-fill--${r.key}`}
                          style={{ left: pct(r.startMs), width: pct(r.state.ms) }}
                        />
                        {warmSocket && <span className="dt-waterfall-pop-hint">warm socket</span>}
                      </span>
                      <span className="dt-waterfall-pop-ms">{formatTimeMs(r.state.ms)}</span>
                    </>
                  ) : (
                    <span className="dt-waterfall-pop-absent-text">{absentText(r.state)}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {terminal && (
        <div className="dt-waterfall-pop-terminal">
          <div className="dt-waterfall-pop-terminal-head">✗ {terminal.label}</div>
          <div className="dt-waterfall-pop-terminal-detail">{terminal.detail}</div>
        </div>
      )}
      {unfinished && <div className="dt-waterfall-pop-caution">CAUTION: request is not finished yet!</div>}
      <div className={`dt-waterfall-pop-total${spec?.total ? ' dt-wf-pop-hl' : ''}`}>
        <span>
          Total time <span className="dt-waterfall-pop-where">(queued → ended)</span>
        </span>
        <span>{formatTimeMs(ladder.durationMs)}</span>
      </div>
    </div>
  );
}

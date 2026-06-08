/**
 * Hover breakdown for a Waterfall bar — the compact cousin of the
 * Timing detail pane. Opens with the request's timeline instants (Queued /
 * Started / Response / Ended, relative to the first request in view), then
 * renders the canonical grouped phases (`computeTimingPhases`) with a
 * colored swatch, label, and duration per row, then a bold total. The
 * total reflects the active metric: Latency sums the pre-response phases
 * (it ends at the first byte); every other metric uses the full duration.
 *
 * When `explain` is on, the popover annotates which rows the bar value is
 * built FROM — highlighting the instant alone just mirrors it back. Each
 * timeline metric marks an anchor instant (hatched, the clock's start) plus
 * the phase rows that elapse from there to its own instant: Start anchors at
 * "Queued at" and elapses Queueing; Response and End anchor at "Started at"
 * (Response stops before Content Download, End runs through it). So the user
 * reads "anchor + these rows = the instant" rather than a lone reading. The
 * duration metrics instead tint the phase rows in the bar's two tones, so the
 * rows that sum to the bar's latency value read as the waiting band and the
 * download row reads as the download band. Purely a visual cue layered over
 * the existing numbers; no value changes.
 */

import type { CSSProperties } from 'react';
import { formatTimeMs } from '../../data/format-time';
import type { WaterfallMetric } from '../../data/network-columns';
import { type PhaseTintSpan, phaseTints, type WaterfallTone } from '../../data/waterfall-geometry';
import { type ComputedTimings, type TimingGroup, type TimingPhase, type TimingPhaseKey } from '../../data/timing-phases';

const GROUP_LABEL: Record<TimingGroup, string> = {
  scheduling: 'Resource Scheduling',
  connection: 'Connection Start',
  transfer: 'Request / Response',
};

const GROUP_ORDER: readonly TimingGroup[] = ['scheduling', 'connection', 'transfer'];

type HeaderLine = 'queued' | 'started' | 'response' | 'ended';

/** The two tones the duration bar paints, resolved from the hovered row's
 * resource-type palette so the popover bands match the bar exactly. */
export interface BandColors {
  waiting: string;
  download: string;
}

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

/**
 * How an instant metric explains itself: the header instant it measures FROM
 * (the anchor) plus the phase rows that elapse from there to the metric's own
 * instant. "Anchor + these rows = the instant" reads as a sum; marking the
 * instant line alone would just restate the value. Start time anchors at
 * "Queued at" (which is `+0` on the first request — the zero a user expects)
 * and elapses Queueing to reach "Started at". Response and End anchor at
 * "Started at" (the queue moment already folded in): Response stops at the
 * first byte, so it drops Content Download; End runs through it. Null for the
 * duration metrics (they tint bands).
 */
function timelineExplain(
  metric: WaterfallMetric,
  data: ComputedTimings,
): { anchor: HeaderLine; phaseKeys: ReadonlySet<TimingPhaseKey> } | null {
  if (metric === 'startTime') return { anchor: 'queued', phaseKeys: new Set<TimingPhaseKey>(['queueing']) };
  if (metric !== 'endTime' && metric !== 'responseTime') return null;
  // Queueing is folded into the "Started at" anchor; Response stops at the
  // first byte (drop Content Download), End runs through it.
  const drop = (k: TimingPhaseKey) => k === 'queueing' || (metric === 'responseTime' && k === 'receive');
  const phaseKeys = new Set<TimingPhaseKey>(data.phases.map((p) => p.key).filter((k) => !drop(k)));
  return { anchor: 'started', phaseKeys };
}

/** Paint a phase row from its tint spans: a solid band when wholly in one
 * tone, a hard-edged two-color gradient when a span boundary cuts the row. */
function tintStyle(spans: readonly PhaseTintSpan[] | undefined, colors: BandColors): CSSProperties | undefined {
  if (!spans || spans.length === 0) return undefined;
  if (spans.length === 1) return { background: colors[spans[0].tone] };
  let at = 0;
  const stops = spans.map((s) => {
    const from = at;
    at += s.frac * 100;
    return `${colors[s.tone]} ${from}% ${at}%`;
  });
  return { background: `linear-gradient(90deg, ${stops.join(', ')})` };
}

export function WaterfallTimingPopover({
  data,
  metric,
  queuedAtMs,
  explain,
  bandColors,
  unfinished,
  terminal,
  reusedOpener,
}: {
  data: ComputedTimings;
  metric: WaterfallMetric;
  /** Issue time relative to the timeline zero (the earliest request in view). */
  queuedAtMs: number;
  /** Highlight the rows the active metric is built from. */
  explain: boolean;
  /** Bar tones for the duration metrics; absent for the timeline metrics. */
  bandColors?: BandColors;
  /** The request is still streaming — Content Download and the total are live,
   * growing readings; show a caution that they are not yet final. */
  unfinished?: boolean;
  /** A terminal request that never received a response (see {@link WaterfallTerminal});
   * hides the Response / Ended instants and shows an outcome marker instead. */
  terminal?: WaterfallTerminal;
  /** Display name of the request that opened this row's reused connection, when
   * resolvable — appended to the reused-connection note as "opened by <name>". */
  reusedOpener?: string;
}) {
  // Duration spans the whole request (issue → end), so it sums every phase
  // including Queueing — browser parity. Latency instead measures the post-
  // queue start to the first response byte, so it drops `queueing` + `receive`.
  const isLatency = metric === 'latency';
  const totalMs = data.phases
    .filter((p) => !(isLatency && (p.key === 'queueing' || p.key === 'receive')))
    .reduce((sum, p) => sum + p.ms, 0);
  const totalLabel = isLatency ? 'Latency' : 'Duration';

  // The timeline instants, all relative to the first request in view. Started
  // lags the queue moment by Queueing; Response is the first byte (everything
  // but Content Download); Ended is the finish.
  const phaseMs = (key: string) => data.phases.find((p) => p.key === key)?.ms ?? 0;
  const sumAll = data.phases.reduce((sum, p) => sum + p.ms, 0);
  const startedAtMs = queuedAtMs + phaseMs('queueing');
  const responseAtMs = queuedAtMs + Math.max(sumAll - phaseMs('receive'), 0);
  const endedAtMs = queuedAtMs + sumAll;

  // A terminal request that never got a response: hide the Response / Ended
  // instants (they would relabel the moment it was blocked / failed as a
  // response that never arrived) and show the outcome marker instead. The total
  // is the real elapsed time (Queueing + the phases it did reach), labelled
  // Duration — Latency means nothing without a first byte.
  const noResponse = terminal != null;
  const displayTotalMs = noResponse ? sumAll : totalMs;
  const displayTotalLabel = noResponse ? 'Duration' : totalLabel;
  // Always surface the Queueing row, even at 0 — the request's first
  // intermediary state. The breakdown drops a 0ms phase, so synthesize it when
  // absent (it is the only Resource Scheduling phase).
  const schedulingPhases: readonly TimingPhase[] = data.byGroup.scheduling.some((p) => p.key === 'queueing')
    ? data.byGroup.scheduling
    : [{ key: 'queueing', label: 'Queueing', group: 'scheduling', ms: 0 }, ...data.byGroup.scheduling];
  // Connection reused: a request that reached a response (wait / receive) but did
  // no DNS / connect / TLS — it rode an already-open socket, so those setup
  // phases are genuinely absent rather than zero. Note it (rather than padding
  // "-" rows) so the missing phases read as "reused", not "unknown".
  const reusedConnection =
    data.phases.some((p) => p.key === 'wait' || p.key === 'receive') &&
    !data.phases.some((p) => p.key === 'dns' || p.key === 'connect' || p.key === 'ssl');

  const explainTimeline = explain ? timelineExplain(metric, data) : null;
  const headerClass = (line: HeaderLine) => (explainTimeline?.anchor === line ? 'dt-wf-pop-anchor' : undefined);
  const tints = explain && bandColors ? phaseTints(data, metric) : null;
  // The phase rows that open a new tone band — a hairline gap above each keeps
  // the waiting and download tones from butting into one smeared block.
  const bandStarts = (() => {
    const starts = new Set<TimingPhaseKey>();
    if (!tints) return starts;
    let prev: WaterfallTone | null = null;
    for (const p of data.phases) {
      const spans = tints.get(p.key);
      const tone = spans?.length === 1 ? spans[0].tone : null;
      if (tone && prev && tone !== prev) starts.add(p.key);
      prev = tone;
    }
    return starts;
  })();

  return (
    <div className="dt-waterfall-pop">
      <div className="dt-waterfall-pop-start">
        <div className={headerClass('queued')}>Queued at {formatTimeMs(queuedAtMs)}</div>
        <div className={headerClass('started')}>Started at {formatTimeMs(startedAtMs)}</div>
        {!noResponse && <div className={headerClass('response')}>Response at {formatTimeMs(responseAtMs)}</div>}
        {!noResponse && <div className={headerClass('ended')}>Ended at {formatTimeMs(endedAtMs)}</div>}
      </div>
      {GROUP_ORDER.map((group) => {
        const phases = group === 'scheduling' ? schedulingPhases : data.byGroup[group];
        const showReusedNote = group === 'connection' && reusedConnection;
        if (phases.length === 0 && !showReusedNote) return null;
        return (
          <div key={group} className="dt-waterfall-pop-group">
            <div className="dt-waterfall-pop-head">{GROUP_LABEL[group]}</div>
            {phases.map((p) => {
              const style = tints && bandColors ? tintStyle(tints.get(p.key), bandColors) : undefined;
              const contributes = explainTimeline?.phaseKeys.has(p.key) ?? false;
              const cls = `dt-waterfall-pop-row${style ? ' dt-waterfall-pop-row--tint' : ''}${
                contributes ? ' dt-waterfall-pop-row--hl' : ''
              }${bandStarts.has(p.key) ? ' dt-waterfall-pop-row--band-start' : ''}`;
              return (
                <div key={p.key} className={cls} style={style}>
                  <span className={`dt-waterfall-pop-swatch dt-wf-fill--${p.key}`} aria-hidden="true" />
                  <span className="dt-waterfall-pop-label">{p.label}</span>
                  <span className="dt-waterfall-pop-ms">{formatTimeMs(p.ms)}</span>
                </div>
              );
            })}
            {showReusedNote && (
              <div className="dt-waterfall-pop-note">
                connection reused (DNS, TCP, TLS){reusedOpener ? ` · opened by ${reusedOpener}` : ''}
              </div>
            )}
          </div>
        );
      })}
      {terminal && (
        <div className="dt-waterfall-pop-terminal">
          <div className="dt-waterfall-pop-terminal-head">✗ {terminal.label}</div>
          <div className="dt-waterfall-pop-terminal-detail">{terminal.detail}</div>
        </div>
      )}
      {unfinished && <div className="dt-waterfall-pop-caution">CAUTION: request is not finished yet!</div>}
      <div className="dt-waterfall-pop-total">
        <span>{displayTotalLabel}</span>
        <span>{formatTimeMs(displayTotalMs)}</span>
      </div>
    </div>
  );
}

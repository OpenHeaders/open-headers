import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useCallback, useRef } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { ConnectionReuseInfo } from '../../data/connection-reuse';
import { formatTimeMs } from '../../data/format-time';
import { computeInFlightTiming } from '../../data/in-flight-timing';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { waterfallStartMs } from '../../data/network-columns';
import { parseServerTiming, type ServerTimingMetric } from '../../data/server-timing';
import { computeTimingContext, type CacheLabel } from '../../data/timing-context';
import { type ElapsedRung, findBottleneck, findWarnings } from '../../data/timing-insight';
import { noResponseTerminal, rowTimingLadder } from '../../data/row-timing-ladder';
import type { RepeatStats } from '../../data/timing-repeats';
import { HorizontalTimingChart } from '../traffic/HorizontalTimingChart';
import { TimingLadderLegend } from '../traffic/TimingLadderLegend';
import { TimingViewMenu } from './timing/TimingMenus';

function formatMs(ms: number): string {
  if (ms < 0.01) return '< 0.01 ms';
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatRelativeStart(ms: number): string {
  if (ms < 1) return '0 ms';
  if (ms < 1000) return `+${ms.toFixed(0)} ms`;
  return `+${(ms / 1000).toFixed(2)} s`;
}

interface TimingViewProps {
  row: InspectorRowWithFires;
  connectionReuse: ConnectionReuseInfo;
  repeatStats: RepeatStats | null;
  /** Session-baseline ms (typically the timestamp of the first observed entry). */
  baselineMs: number | null;
}

export default function TimingView({ row, connectionReuse, repeatStats, baselineMs }: TimingViewProps) {
  const lc = row.lifecycle;
  const [showInsights, setShowInsights] = useSetting('devpanelTiming.showInsights');
  const [showContextStrip, setShowContextStrip] = useSetting('devpanelTiming.showContextStrip');
  const [showPhaseGroups, setShowPhaseGroups] = useSetting('devpanelTiming.showPhaseGroups');
  const [showTimingBar, setShowTimingBar] = useSetting('devpanelTiming.showTimingBar');
  const [showServerTiming, setShowServerTiming] = useSetting('devpanelTiming.showServerTiming');
  const [showRepeats, setShowRepeats] = useSetting('devpanelTiming.showRepeats');
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);
  const toggleShowContextStrip = useCallback(
    () => setShowContextStrip(!showContextStrip),
    [showContextStrip, setShowContextStrip],
  );
  const toggleShowPhaseGroups = useCallback(
    () => setShowPhaseGroups(!showPhaseGroups),
    [showPhaseGroups, setShowPhaseGroups],
  );
  const toggleShowTimingBar = useCallback(() => setShowTimingBar(!showTimingBar), [showTimingBar, setShowTimingBar]);
  const toggleShowServerTiming = useCallback(
    () => setShowServerTiming(!showServerTiming),
    [showServerTiming, setShowServerTiming],
  );
  const toggleShowRepeats = useCallback(() => setShowRepeats(!showRepeats), [showRepeats, setShowRepeats]);

  const paneRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  useMeasuredCssHeights(paneRef, [{ ref: toolbarRef, cssVar: '--oh-timing-toolbar-h' }]);

  const toolbar = (
    <div className="dt-header-filter dt-timing-toolbar" ref={toolbarRef}>
      <span className="dt-timing-toolbar-spacer" aria-hidden="true" />
      <TimingViewMenu
        showInsights={showInsights}
        showContextStrip={showContextStrip}
        showPhaseGroups={showPhaseGroups}
        showTimingBar={showTimingBar}
        showServerTiming={showServerTiming}
        showRepeats={showRepeats}
        onToggleShowInsights={toggleShowInsights}
        onToggleShowContextStrip={toggleShowContextStrip}
        onToggleShowPhaseGroups={toggleShowPhaseGroups}
        onToggleShowTimingBar={toggleShowTimingBar}
        onToggleShowServerTiming={toggleShowServerTiming}
        onToggleShowRepeats={toggleShowRepeats}
      />
    </div>
  );

  // One model across the popover + this tab: the ladder when a HAR has landed,
  // else the lifecycle-derived in-flight partial (the host's growing Timing).
  const ladder = rowTimingLadder(row);
  const unfinished = lc.completedAtMs == null;
  const har = currentHarEntry(lc);
  const context = computeTimingContext(lc, connectionReuse, baselineMs);

  // No ladder and finished — genuinely nothing to time (rare; a finished row
  // with no `timings` block).
  if (!ladder && !unfinished) {
    return (
      <div className="dt-timing-view" ref={paneRef}>
        {toolbar}
        <span className="dt-col-muted" style={{ padding: 12 }}>
          No timing data available.
        </span>
      </div>
    );
  }

  // In flight with no HAR yet — show the host's partial Timing (Queued / Started
  // / open Stalled) and the not-finished caution instead of an empty pane.
  if (!ladder) {
    return (
      <div className="dt-timing-view" ref={paneRef}>
        {toolbar}
        {showContextStrip && <TimingContextStrip context={context} />}
        <InFlightTiming lc={lc} baselineMs={baselineMs} />
        {showRepeats && repeatStats && <RepeatStatsSection stats={repeatStats} url={lc.url} />}
      </div>
    );
  }

  // Completed (or streaming): the elapsed rungs feed the suggestion insights;
  // the full breakdown (incl. absent steps) is the shared bar + legend below.
  const elapsed: ElapsedRung[] = [];
  for (const r of ladder.rungs) {
    if (r.state.kind === 'elapsed' && r.state.ms > 0) {
      elapsed.push({ key: r.key, label: r.label, ms: r.state.ms });
    }
  }
  const totalMs = ladder.durationMs;
  const bottleneck = findBottleneck(elapsed, totalMs);
  const warnings = findWarnings(elapsed, bottleneck?.phase ?? null);
  const serverTiming = parseServerTiming(har?.response?.headers);
  // The queue moment as an offset from the session baseline (the tab's zero) —
  // added to the ladder's local instants for the absolute "… at" readings, the
  // same way the popover offsets from the timeline zero.
  const queuedAtMs = Math.max(waterfallStartMs(lc) - (baselineMs ?? waterfallStartMs(lc)), 0);
  // A terminal row that never got a response marks where it stopped on the bar.
  const terminal = noResponseTerminal(row, ladder);

  return (
    <div className="dt-timing-view" ref={paneRef}>
      {toolbar}
      {showInsights && bottleneck && (
        <div className="dt-timing-insight" data-kind="bottleneck">
          <span className="dt-timing-insight-icon" aria-hidden="true">
            ⚡
          </span>
          <div className="dt-timing-insight-body">
            <div className="dt-timing-insight-headline">
              <strong>{bottleneck.label}</strong> dominates this request — {formatMs(bottleneck.ms)} (
              {bottleneck.percent.toFixed(0)}% of total).
            </div>
            <div className="dt-timing-insight-hint">
              {bottleneck.what}. {bottleneck.hint}
            </div>
          </div>
        </div>
      )}
      {showInsights && warnings.map((w) => (
        <div key={w.phase} className="dt-timing-insight" data-kind="warning">
          <span className="dt-timing-insight-icon" aria-hidden="true">
            ⚠
          </span>
          <div className="dt-timing-insight-body">
            <div className="dt-timing-insight-headline">
              <strong>{w.label}</strong> is unusually high — {formatMs(w.ms)}.
            </div>
            <div className="dt-timing-insight-hint">
              {w.what}. {w.hint}
            </div>
          </div>
        </div>
      ))}

      {showContextStrip && <TimingContextStrip context={context} />}

      {/* The full at-a-glance ladder bar — the Waterfall popover's wide view:
          every phase as a cell (hatched when skipped — connection reused / not
          reached), the ▼ instant ticks, band brackets, and the on-the-wire span,
          so the whole story reads without a hover. Below it, the per-band rows
          carry the same numbers as a detailed legend. */}
      {showTimingBar && (
        <div className="dt-timing-chart">
          <HorizontalTimingChart ladder={ladder} queuedAtMs={queuedAtMs} terminal={terminal} />
        </div>
      )}

      {/* The full breakdown — all eight phases always in view, grouped into the
          three band columns under the bar's brackets; an absent setup step reads
          its reason (connection reused / not reached / n/a). The same legend the
          wide popover shows. */}
      {showPhaseGroups && (
        <div className="dt-timing-legend-section">
          <TimingLadderLegend ladder={ladder} />
        </div>
      )}

      {showTimingBar && (
        <div className="dt-timing-total">
          <span>
            Total time <span className="dt-timing-where">(queued → ended)</span>
          </span>
          <span>{formatTimeMs(totalMs)}</span>
        </div>
      )}

      {/* Streaming (response in, body still downloading): the host flags the
          unfinished request the same way. */}
      {unfinished && <div className="dt-timing-caution">CAUTION: request is not finished yet!</div>}

      {showServerTiming && serverTiming.length > 0 && <ServerTimingSection metrics={serverTiming} />}

      {showRepeats && repeatStats && <RepeatStatsSection stats={repeatStats} url={lc.url} />}
    </div>
  );
}

// ── In-flight partial ────────────────────────────────────────────────

/**
 * The host's partial Timing for a request still in flight (no HAR yet): the
 * Queued / Started instants from the live lifecycle, an open Stalled step while
 * the request hasn't left the queue, and the not-finished caution. Reads the
 * same {@link computeInFlightTiming} model the Waterfall live popover does, so
 * the two surfaces tell one story. Offsets are measured from the session
 * baseline (the tab's zero), matching the context strip's "Started".
 */
function InFlightTiming({ lc, baselineMs }: { lc: RequestLifecycle; baselineMs: number | null }) {
  const { queuedAtMs, startedAtMs, networkStarted } = computeInFlightTiming(lc, baselineMs ?? waterfallStartMs(lc));
  return (
    <>
      <div className="dt-timing-inflight-start">
        <div>Queued at {formatRelativeStart(queuedAtMs)}</div>
        {networkStarted && <div>Started at {formatRelativeStart(startedAtMs)}</div>}
      </div>
      {!networkStarted && (
        <div className="dt-kv" style={{ paddingTop: 4 }}>
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            Stalled:
          </span>
          <span className="dt-kv-val dt-col-muted">in progress…</span>
        </div>
      )}
      <div className="dt-timing-caution">CAUTION: request is not finished yet!</div>
    </>
  );
}

// ── Context strip ────────────────────────────────────────────────────

function ChipLabel({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'good' | 'warn' }) {
  return (
    <span className="dt-timing-chip" data-tone={tone ?? 'default'}>
      <span className="dt-timing-chip-label">{label}</span>
      <span className="dt-timing-chip-value">{value}</span>
    </span>
  );
}

function cacheTone(cache: CacheLabel | null): 'good' | 'muted' | undefined {
  if (cache == null || cache === 'miss') return 'muted';
  return 'good';
}

function TimingContextStrip({ context }: { context: ReturnType<typeof computeTimingContext> }) {
  const chips: React.ReactNode[] = [];
  if (context.httpVersion) chips.push(<ChipLabel key="http" label="Protocol" value={context.httpVersion} />);
  if (context.connectionReuse.reused) {
    chips.push(
      <ChipLabel
        key="conn"
        label="Connection"
        value={`reused${context.connectionReuse.openedBy ? ` · opened by ${shortUrl(context.connectionReuse.openedBy.url)}` : ''}`}
        tone="good"
      />,
    );
  } else if (context.connectionReuse.connectionId) {
    chips.push(<ChipLabel key="conn" label="Connection" value="new" />);
  }
  if (context.cache) chips.push(<ChipLabel key="cache" label="Cache" value={context.cache} tone={cacheTone(context.cache)} />);
  if (context.priority) chips.push(<ChipLabel key="prio" label="Priority" value={context.priority} />);
  if (context.startedAtMs != null) {
    chips.push(<ChipLabel key="start" label="Started" value={formatRelativeStart(context.startedAtMs)} />);
  }
  if (context.serverIp) chips.push(<ChipLabel key="ip" label="Server IP" value={context.serverIp} tone="muted" />);
  if (chips.length === 0) return null;
  return <div className="dt-timing-context-strip">{chips}</div>;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname : '');
  } catch {
    return url;
  }
}

// ── Server Timing ────────────────────────────────────────────────────

function ServerTimingSection({ metrics }: { metrics: readonly ServerTimingMetric[] }) {
  const measured = metrics.filter((m) => m.duration != null && m.duration > 0);
  const total = measured.reduce((s, m) => s + (m.duration ?? 0), 0);
  const barTotal = Math.max(total, 1);
  return (
    <details className="dt-section" open>
      <summary>Server Timing</summary>
      <div className="dt-server-timing">
        {metrics.map((m, i) => (
          <div key={`${m.name}-${i}`} className="dt-server-timing-row">
            <span className="dt-server-timing-name" title={m.description ?? undefined}>
              {m.name}
              {m.description && <span className="dt-server-timing-desc"> — {m.description}</span>}
            </span>
            {m.duration != null ? (
              <>
                <div className="dt-server-timing-track">
                  <div
                    className="dt-server-timing-bar"
                    style={{ width: `${Math.max(((m.duration ?? 0) / barTotal) * 100, 0.5)}%` }}
                  />
                </div>
                <span className="dt-server-timing-dur">{formatMs(m.duration)}</span>
              </>
            ) : (
              <span className="dt-server-timing-dur dt-col-muted">no duration</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Repeat-URL comparison ────────────────────────────────────────────

function RepeatStatsSection({ stats, url }: { stats: RepeatStats; url: string }) {
  const cacheBits: string[] = [];
  if (stats.cacheCounts.memory) cacheBits.push(`${stats.cacheCounts.memory} memory cache`);
  if (stats.cacheCounts.disk) cacheBits.push(`${stats.cacheCounts.disk} disk cache`);
  if (stats.cacheCounts.serviceWorker) cacheBits.push(`${stats.cacheCounts.serviceWorker} service worker`);
  if (stats.cacheCounts.miss) cacheBits.push(`${stats.cacheCounts.miss} miss`);
  const tone = stats.selectedIsSlowest ? 'warn' : stats.selectedIsFastest ? 'good' : undefined;
  return (
    <details className="dt-section" open>
      <summary>Repeats in this session</summary>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          URL hit count:
        </span>
        <span className="dt-kv-val">{stats.count}</span>
      </div>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          Fastest / median / slowest:
        </span>
        <span className="dt-kv-val">
          {formatMs(stats.fastestMs)} · {formatMs(stats.medianMs)} · {formatMs(stats.slowestMs)}
        </span>
      </div>
      {stats.selectedMs > 0 && (
        <div className="dt-kv">
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            This request:
          </span>
          <span className="dt-kv-val">
            <ChipLabel
              label=""
              value={`${formatMs(stats.selectedMs)}${stats.selectedIsSlowest ? ' (slowest)' : stats.selectedIsFastest ? ' (fastest)' : ''}`}
              tone={tone}
            />
          </span>
        </div>
      )}
      {cacheBits.length > 0 && (
        <div className="dt-kv">
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            Cache breakdown:
          </span>
          <span className="dt-kv-val">{cacheBits.join(' · ')}</span>
        </div>
      )}
      <div className="dt-kv dt-col-muted" style={{ marginTop: 4 }}>
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          URL:
        </span>
        <span className="dt-kv-val" title={url} style={{ wordBreak: 'break-all' }}>
          {url}
        </span>
      </div>
    </details>
  );
}

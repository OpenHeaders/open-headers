import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useCallback } from 'react';
import { useModifiedSettings, useResetSettings, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { ConnectionReuseInfo } from '../../data/connection-reuse';
import { formatTimeMs } from '../../data/timing/format-time';
import { computeInFlightTiming } from '../../data/timing/in-flight-timing';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { waterfallStartMs } from '../../data/network-columns';
import { parseServerTiming, type ServerTimingMetric } from '../../data/timing/server-timing';
import { computeTimingContext, type CacheLabel } from '../../data/timing/timing-context';
import {
  computeTransferRate,
  type ElapsedRung,
  findBottleneck,
  findWarnings,
  type TransferRate,
} from '../../data/timing/timing-insight';
import { noResponseTerminal, rowTimingLadder } from '../../data/timing/row-timing-ladder';
import type { RepeatStats } from '../../data/timing/timing-repeats';
import { formatSize } from '../traffic/formatters';
import { HorizontalTimingChart } from '../traffic/HorizontalTimingChart';
import { TimingLadderLegend } from '../traffic/TimingLadderLegend';
import { TIMING_VIEW_MENU_KEYS, TimingViewMenu } from './timing/TimingMenus';

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
  const t = useT();
  const lc = row.lifecycle;
  const [showInsights, setShowInsights] = useSetting('devpanelTiming.showInsights');
  const [showContextStrip, setShowContextStrip] = useSetting('devpanelTiming.showContextStrip');
  const [showPhaseGroups, setShowPhaseGroups] = useSetting('devpanelTiming.showPhaseGroups');
  const [showTimingBar, setShowTimingBar] = useSetting('devpanelTiming.showTimingBar');
  const [showServerTiming, setShowServerTiming] = useSetting('devpanelTiming.showServerTiming');
  const [showRepeats, setShowRepeats] = useSetting('devpanelTiming.showRepeats');
  const [showTransferRate, setShowTransferRate] = useSetting('devpanelTiming.showTransferRate');
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
  const toggleShowTransferRate = useCallback(
    () => setShowTransferRate(!showTransferRate),
    [showTransferRate, setShowTransferRate],
  );
  const viewMenuModified = useModifiedSettings(TIMING_VIEW_MENU_KEYS);
  const resetViewMenu = useResetSettings(TIMING_VIEW_MENU_KEYS);

  // Section header instead of a near-empty toolbar row: "Timing" reads
  // like the sibling sections (Server Timing, Transfer rate) and the
  // View menu rides its summary row, same as Raw Data's Export snippet.
  const timingSummary = (
    <summary>
      <span className="dt-timing-summary-label">{t('panel.inspector.sections.timing')}</span>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops summary toggle only; the menu is its own button. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same. */}
      <span className="dt-timing-summary-controls" onClick={(e) => e.stopPropagation()}>
        <TimingViewMenu
          showInsights={showInsights}
          showContextStrip={showContextStrip}
          showPhaseGroups={showPhaseGroups}
          showTimingBar={showTimingBar}
          showServerTiming={showServerTiming}
          showRepeats={showRepeats}
          showTransferRate={showTransferRate}
          modified={viewMenuModified}
          onToggleShowInsights={toggleShowInsights}
          onToggleShowContextStrip={toggleShowContextStrip}
          onToggleShowPhaseGroups={toggleShowPhaseGroups}
          onToggleShowTimingBar={toggleShowTimingBar}
          onToggleShowServerTiming={toggleShowServerTiming}
          onToggleShowRepeats={toggleShowRepeats}
          onToggleShowTransferRate={toggleShowTransferRate}
          onReset={resetViewMenu}
        />
      </span>
    </summary>
  );

  // One model across the popover + this tab: the ladder when a HAR has landed,
  // else the lifecycle-derived in-flight partial (the host's growing Timing).
  const ladder = rowTimingLadder(row);
  const har = currentHarEntry(lc);
  // Not finished: still in flight, or the body download never completed (a
  // document canceled mid-stream) — the host keeps the caution up for both.
  const unfinished = lc.completedAtMs == null || har?.response?._responseBodyIncomplete === true;
  const context = computeTimingContext(lc, connectionReuse, baselineMs);

  // No ladder and finished — genuinely nothing to time (rare; a finished row
  // with no `timings` block).
  if (!ladder && !unfinished) {
    return (
      <div className="dt-timing-view">
        <details className="dt-section" open>
          {timingSummary}
          <span className="dt-col-muted" style={{ padding: 12, display: 'inline-block' }}>
            {t('panel.inspector.timing.noData')}
          </span>
        </details>
      </div>
    );
  }

  // In flight with no HAR yet — show the host's partial Timing (Queued / Started
  // / open Stalled) and the not-finished caution instead of an empty pane.
  if (!ladder) {
    return (
      <div className="dt-timing-view">
        <details className="dt-section" open>
          {timingSummary}
          {showContextStrip && <TimingContextStrip context={context} />}
          <InFlightTiming lc={lc} baselineMs={baselineMs} />
        </details>
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
  const bottleneck = findBottleneck(t, elapsed, totalMs);
  const warnings = findWarnings(t, elapsed, bottleneck?.phase ?? null);
  const serverTiming = parseServerTiming(har?.response?.headers);
  // The queue moment as an offset from the session baseline (the tab's zero) —
  // added to the ladder's local instants for the absolute "… at" readings, the
  // same way the popover offsets from the timeline zero.
  const queuedAtMs = Math.max(waterfallStartMs(lc) - (baselineMs ?? waterfallStartMs(lc)), 0);
  // A terminal row that never got a response marks where it stopped on the bar.
  const terminal = noResponseTerminal(row, ladder);
  // Effective Content-Download throughput: body bytes over the wire ÷ the
  // receive leg. Encoded `bodySize` is the on-the-wire amount; fall back to the
  // decoded `content.size` when the exporter didn't report it. Null (section
  // hidden) for a cache hit / bodyless row where there's nothing to rate.
  const receiveRung = ladder.rungs.find((r) => r.key === 'receive');
  const receiveMs = receiveRung?.state.kind === 'elapsed' ? receiveRung.state.ms : 0;
  const resp = har?.response;
  const bodyBytes =
    resp && typeof resp.bodySize === 'number' && resp.bodySize > 0 ? resp.bodySize : resp?.content?.size;
  const transferRate = computeTransferRate(receiveMs, bodyBytes);

  return (
    <div className="dt-timing-view">
      <details className="dt-section" open>
      {timingSummary}
      {showInsights && bottleneck && (
        <div className="dt-timing-insight" data-kind="bottleneck">
          <span className="dt-timing-insight-icon" aria-hidden="true">
            ⚡
          </span>
          <div className="dt-timing-insight-body">
            <div className="dt-timing-insight-headline">
              <strong>{bottleneck.label}</strong>{' '}
              {t('panel.inspector.timing.insight.dominatesTail', {
                ms: formatMs(bottleneck.ms),
                percent: bottleneck.percent.toFixed(0),
              })}
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
              <strong>{w.label}</strong> {t('panel.inspector.timing.insight.unusuallyHighTail', { ms: formatMs(w.ms) })}
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
            {t('panel.inspector.timing.totalTime')}{' '}
            <span className="dt-timing-where">{t('panel.inspector.timing.totalWhere')}</span>
          </span>
          <span>{formatTimeMs(totalMs)}</span>
        </div>
      )}

      {/* Streaming (response in, body still downloading): the host flags the
          unfinished request the same way. */}
      {unfinished && <div className="dt-timing-caution">{t('panel.inspector.timing.caution')}</div>}
      </details>

      {showServerTiming && serverTiming.length > 0 && <ServerTimingSection metrics={serverTiming} />}

      {showRepeats && repeatStats && <RepeatStatsSection stats={repeatStats} url={lc.url} />}

      {showTransferRate && transferRate && <TransferRateSection rate={transferRate} />}
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
  const t = useT();
  const { queuedAtMs, startedAtMs, networkStarted } = computeInFlightTiming(lc, baselineMs ?? waterfallStartMs(lc));
  return (
    <>
      <div className="dt-timing-inflight-start">
        <div>{t('panel.inspector.timing.queuedAt', { offset: formatRelativeStart(queuedAtMs) })}</div>
        {networkStarted && (
          <div>{t('panel.inspector.timing.startedAt', { offset: formatRelativeStart(startedAtMs) })}</div>
        )}
      </div>
      {!networkStarted && (
        <div className="dt-kv" style={{ paddingTop: 4 }}>
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            Stalled:
          </span>
          <span className="dt-kv-val dt-col-muted">{t('panel.inspector.timing.inProgress')}</span>
        </div>
      )}
      <div className="dt-timing-caution">{t('panel.inspector.timing.caution')}</div>
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
  const t = useT();
  const chips: React.ReactNode[] = [];
  if (context.httpVersion) {
    chips.push(<ChipLabel key="http" label={t('panel.inspector.timing.chip.protocol')} value={context.httpVersion} />);
  }
  if (context.connectionReuse.reused) {
    const reused = t('panel.inspector.timing.chip.connectionReused');
    const openedBy = context.connectionReuse.openedBy
      ? ` · ${t('panel.inspector.timing.chip.openedBy', { url: shortUrl(context.connectionReuse.openedBy.url) })}`
      : '';
    chips.push(
      <ChipLabel
        key="conn"
        label={t('panel.inspector.timing.chip.connection')}
        value={`${reused}${openedBy}`}
        tone="good"
      />,
    );
  } else if (context.connectionReuse.connectionId) {
    chips.push(
      <ChipLabel
        key="conn"
        label={t('panel.inspector.timing.chip.connection')}
        value={t('panel.inspector.timing.chip.connectionNew')}
      />,
    );
  }
  if (context.cache) {
    chips.push(
      <ChipLabel
        key="cache"
        label={t('panel.inspector.timing.chip.cache')}
        value={context.cache}
        tone={cacheTone(context.cache)}
      />,
    );
  }
  if (context.priority) {
    chips.push(<ChipLabel key="prio" label={t('panel.inspector.timing.chip.priority')} value={context.priority} />);
  }
  if (context.startedAtMs != null) {
    chips.push(
      <ChipLabel
        key="start"
        label={t('panel.inspector.timing.chip.started')}
        value={formatRelativeStart(context.startedAtMs)}
      />,
    );
  }
  if (context.serverIp) {
    chips.push(
      <ChipLabel key="ip" label={t('panel.inspector.timing.chip.serverIp')} value={context.serverIp} tone="muted" />,
    );
  }
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
  const t = useT();
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
              <span className="dt-server-timing-dur dt-col-muted">{t('panel.inspector.timing.noDuration')}</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

// ── Transfer rate ────────────────────────────────────────────────────

/**
 * Effective Content-Download throughput — the body bytes that crossed the wire
 * divided by the `receive` leg. The same `528 B @ 603 KB/s` reading the host
 * surfaces, broken into a labeled amount-in-time row plus the derived rate, so
 * it reads as a diagnostic line rather than a terse annotation.
 */
function TransferRateSection({ rate }: { rate: TransferRate }) {
  const t = useT();
  return (
    <details className="dt-section" open>
      <summary>{t('panel.inspector.timing.transferRate.heading')}</summary>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          {t('panel.inspector.timing.transferRate.contentDownloaded')}
        </span>
        <span className="dt-kv-val">
          {t('panel.inspector.timing.transferRate.amount', {
            size: formatSize(rate.bytes),
            duration: formatMs(rate.ms),
          })}
        </span>
      </div>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          {t('panel.inspector.timing.transferRate.effectiveRate')}
        </span>
        <span className="dt-kv-val">{rate.formatted}</span>
      </div>
    </details>
  );
}

// ── Repeat-URL comparison ────────────────────────────────────────────

function RepeatStatsSection({ stats, url }: { stats: RepeatStats; url: string }) {
  const t = useT();
  // Cache-source words are Size-column parity vocabulary — the whole
  // breakdown line stays raw (figures + parity words, ' · ' joined).
  const cacheBits: string[] = [];
  if (stats.cacheCounts.memory) cacheBits.push(`${stats.cacheCounts.memory} memory cache`);
  if (stats.cacheCounts.disk) cacheBits.push(`${stats.cacheCounts.disk} disk cache`);
  if (stats.cacheCounts.serviceWorker) cacheBits.push(`${stats.cacheCounts.serviceWorker} service worker`);
  if (stats.cacheCounts.miss) cacheBits.push(`${stats.cacheCounts.miss} miss`);
  const tone = stats.selectedIsSlowest ? 'warn' : stats.selectedIsFastest ? 'good' : undefined;
  const selectedTag = stats.selectedIsSlowest
    ? ` ${t('panel.inspector.timing.repeats.slowestTag')}`
    : stats.selectedIsFastest
      ? ` ${t('panel.inspector.timing.repeats.fastestTag')}`
      : '';
  return (
    <details className="dt-section" open>
      <summary>{t('panel.inspector.timing.repeats.heading')}</summary>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          {t('panel.inspector.timing.repeats.hitCount')}
        </span>
        <span className="dt-kv-val">{stats.count}</span>
      </div>
      <div className="dt-kv">
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          {t('panel.inspector.timing.repeats.fastestMedianSlowest')}
        </span>
        <span className="dt-kv-val">
          {formatMs(stats.fastestMs)} · {formatMs(stats.medianMs)} · {formatMs(stats.slowestMs)}
        </span>
      </div>
      {stats.selectedMs > 0 && (
        <div className="dt-kv">
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            {t('panel.inspector.timing.repeats.thisRequest')}
          </span>
          <span className="dt-kv-val">
            <ChipLabel label="" value={`${formatMs(stats.selectedMs)}${selectedTag}`} tone={tone} />
          </span>
        </div>
      )}
      {cacheBits.length > 0 && (
        <div className="dt-kv">
          <span className="dt-kv-key" style={{ minWidth: 140 }}>
            {t('panel.inspector.timing.repeats.cacheBreakdown')}
          </span>
          <span className="dt-kv-val">{cacheBits.join(' · ')}</span>
        </div>
      )}
      <div className="dt-kv dt-col-muted" style={{ marginTop: 4 }}>
        <span className="dt-kv-key" style={{ minWidth: 140 }}>
          {t('panel.inspector.timing.repeats.url')}
        </span>
        <span className="dt-kv-val" title={url} style={{ wordBreak: 'break-all' }}>
          {url}
        </span>
      </div>
    </details>
  );
}

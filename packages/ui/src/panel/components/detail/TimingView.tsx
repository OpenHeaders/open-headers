import { computeTimingContext, type CacheLabel } from '../../data/timing-context';
import type { ConnectionReuseInfo } from '../../data/connection-reuse';
import { parseServerTiming, type ServerTimingMetric } from '../../data/server-timing';
import { computeTimingPhases, type TimingGroup } from '../../data/timing-phases';
import { computeTransferRate, findBottleneck, findWarnings } from '../../data/timing-insight';
import type { RepeatStats } from '../../data/timing-repeats';
import type { InspectorRequest } from '../../data/types';

const GROUP_LABEL: Record<TimingGroup, string> = {
  scheduling: 'Resource Scheduling',
  connection: 'Connection Start',
  transfer: 'Request/Response',
};

const GROUP_ORDER: readonly TimingGroup[] = ['scheduling', 'connection', 'transfer'];

function formatMs(ms: number): string {
  if (ms < 0.01) return '< 0.01 ms';
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRelativeStart(ms: number): string {
  if (ms < 1) return '0 ms';
  if (ms < 1000) return `+${ms.toFixed(0)} ms`;
  return `+${(ms / 1000).toFixed(2)} s`;
}

interface TimingViewProps {
  request: InspectorRequest;
  connectionReuse: ConnectionReuseInfo;
  repeatStats: RepeatStats | null;
  /** Session-baseline ms (typically the timestamp of the first observed entry). */
  baselineMs: number | null;
}

export default function TimingView({ request, connectionReuse, repeatStats, baselineMs }: TimingViewProps) {
  const har = request.harEntry;
  const data = computeTimingPhases(har);
  if (!data) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No timing data available.
      </span>
    );
  }

  const context = computeTimingContext(request, connectionReuse, baselineMs);
  const bottleneck = findBottleneck(data.phases, data.totalMs);
  const warnings = findWarnings(data.phases, bottleneck?.phase ?? null);
  const serverTiming = parseServerTiming(har.response?.headers);
  const receivePhase = data.phases.find((p) => p.key === 'receive');
  const transferRate = receivePhase
    ? computeTransferRate(receivePhase.ms, har.response?.content?.size ?? har.response?.bodySize)
    : null;
  const barTotal = Math.max(data.totalMs, 1);

  return (
    <div className="dt-timing-view">
      {bottleneck && (
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
      {warnings.map((w) => (
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

      <TimingContextStrip context={context} />

      {GROUP_ORDER.map((group) => {
        const phases = data.byGroup[group];
        if (phases.length === 0) return null;
        return (
          <details key={group} className="dt-section" open>
            <summary>{GROUP_LABEL[group]}</summary>
            {phases.map((p) => (
              <div key={p.key} className="dt-kv">
                <span className="dt-kv-key" style={{ minWidth: 140 }}>
                  {p.label}:
                </span>
                <span className="dt-kv-val">{formatMs(p.ms)}</span>
                {p.key === 'receive' && transferRate && (
                  <span className="dt-timing-rate">
                    · {formatBytes(transferRate.bytes)} @ {transferRate.formatted}
                  </span>
                )}
              </div>
            ))}
          </details>
        );
      })}

      <div className="dt-timing-bar-section">
        <div className="dt-timing-bar">
          {data.phases.map((p) => (
            <div
              key={p.key}
              className="dt-timing-bar-segment"
              style={{
                width: `${Math.max((p.ms / barTotal) * 100, 0.5)}%`,
                background: p.color,
              }}
              title={`${p.label}: ${formatMs(p.ms)}`}
            />
          ))}
        </div>
        <div className="dt-timing-bar-legend">
          {data.phases.map((p) => (
            <span key={p.key} className="dt-timing-legend-item">
              <span className="dt-timing-legend-swatch" style={{ background: p.color }} />
              {p.label}: {formatMs(p.ms)}
            </span>
          ))}
        </div>
      </div>

      <div className="dt-timing-total">
        <strong>Total:</strong> {formatMs(data.totalMs)}
      </div>

      {serverTiming.length > 0 && <ServerTimingSection metrics={serverTiming} />}

      {repeatStats && <RepeatStatsSection stats={repeatStats} url={request.url} />}
    </div>
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

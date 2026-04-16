import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

interface TimingPhase {
  key: string;
  label: string;
  ms: number;
  color: string;
}

const PHASE_CONFIG: Array<{ key: string; label: string; color: string }> = [
  { key: 'blocked', label: 'Stalled', color: '#ccc' },
  { key: 'dns', label: 'DNS Lookup', color: '#6ecba4' },
  { key: 'connect', label: 'Initial connection', color: '#f0a73c' },
  { key: 'ssl', label: 'SSL', color: '#c689d6' },
  { key: 'send', label: 'Request sent', color: '#79b6e8' },
  { key: 'wait', label: 'Waiting for server', color: '#79d279' },
  { key: 'receive', label: 'Content Download', color: '#5c9aef' },
];

function buildPhases(timings: NonNullable<InspectorHarEntry['timings']>): TimingPhase[] {
  const phases: TimingPhase[] = [];
  for (const cfg of PHASE_CONFIG) {
    const raw = (timings as Record<string, unknown>)[cfg.key];
    const ms = typeof raw === 'number' && raw >= 0 ? raw : 0;
    if (ms > 0 || cfg.key === 'wait') {
      phases.push({ key: cfg.key, label: cfg.label, ms, color: cfg.color });
    }
  }
  return phases;
}

function formatMs(ms: number): string {
  if (ms < 0.01) return '< 0.01 ms';
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

interface TimingViewProps {
  har: InspectorHarEntry;
}

export default function TimingView({ har }: TimingViewProps) {
  if (!har.timings) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No timing data available.
      </span>
    );
  }

  const phases = buildPhases(har.timings);
  const totalMs = phases.reduce((sum, p) => sum + p.ms, 0);
  const barTotal = Math.max(totalMs, 1);

  return (
    <div className="dt-timing-view">
      <details className="dt-section" open>
        <summary>Resource Scheduling</summary>
        {(() => {
          const queued = har.timings.blocked;
          if (queued == null || queued < 0) return <div className="dt-kv dt-col-muted">No queueing data.</div>;
          return (
            <div className="dt-kv">
              <span className="dt-kv-key" style={{ minWidth: 140 }}>
                Queued at:
              </span>
              <span className="dt-kv-val">{formatMs(queued)}</span>
            </div>
          );
        })()}
      </details>

      <details className="dt-section" open>
        <summary>Connection Start</summary>
        {(() => {
          const dns = har.timings.dns;
          const connect = har.timings.connect;
          const ssl = har.timings.ssl;
          const hasData = (dns != null && dns >= 0) || (connect != null && connect >= 0) || (ssl != null && ssl >= 0);
          if (!hasData) return <div className="dt-kv dt-col-muted">No connection data.</div>;
          return (
            <>
              {dns != null && dns >= 0 && (
                <div className="dt-kv">
                  <span className="dt-kv-key" style={{ minWidth: 140 }}>
                    DNS Lookup:
                  </span>
                  <span className="dt-kv-val">{formatMs(dns)}</span>
                </div>
              )}
              {connect != null && connect >= 0 && (
                <div className="dt-kv">
                  <span className="dt-kv-key" style={{ minWidth: 140 }}>
                    Initial connection:
                  </span>
                  <span className="dt-kv-val">{formatMs(connect)}</span>
                </div>
              )}
              {ssl != null && ssl >= 0 && (
                <div className="dt-kv">
                  <span className="dt-kv-key" style={{ minWidth: 140 }}>
                    SSL:
                  </span>
                  <span className="dt-kv-val">{formatMs(ssl)}</span>
                </div>
              )}
            </>
          );
        })()}
      </details>

      <details className="dt-section" open>
        <summary>Request/Response</summary>
        {har.timings.send != null && har.timings.send >= 0 && (
          <div className="dt-kv">
            <span className="dt-kv-key" style={{ minWidth: 140 }}>
              Request sent:
            </span>
            <span className="dt-kv-val">{formatMs(har.timings.send)}</span>
          </div>
        )}
        {har.timings.wait != null && har.timings.wait >= 0 && (
          <div className="dt-kv">
            <span className="dt-kv-key" style={{ minWidth: 140 }}>
              Waiting for server:
            </span>
            <span className="dt-kv-val">{formatMs(har.timings.wait)}</span>
          </div>
        )}
        {har.timings.receive != null && har.timings.receive >= 0 && (
          <div className="dt-kv">
            <span className="dt-kv-key" style={{ minWidth: 140 }}>
              Content Download:
            </span>
            <span className="dt-kv-val">{formatMs(har.timings.receive)}</span>
          </div>
        )}
      </details>

      <div className="dt-timing-bar-section">
        <div className="dt-timing-bar">
          {phases.map((p) => (
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
          {phases
            .filter((p) => p.ms > 0)
            .map((p) => (
              <span key={p.key} className="dt-timing-legend-item">
                <span className="dt-timing-legend-swatch" style={{ background: p.color }} />
                {p.label}: {formatMs(p.ms)}
              </span>
            ))}
        </div>
      </div>

      {har.time != null && (
        <div className="dt-timing-total">
          <strong>Total:</strong> {formatMs(har.time)}
        </div>
      )}
    </div>
  );
}

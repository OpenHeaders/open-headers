/**
 * Console tool-window (CDP Control Plane, Phase G2). Renders the per-tab
 * console stream the engine captures on a Debug-mode tab — the page's own
 * `console.*` output plus uncaught exceptions — so a user debugging with Open
 * Headers never has to leave for the browser's native console.
 *
 * Observation-only: the entries arrive over the `oh-console:<tabId>` port
 * (owned by `useConsoleClient` at the panel root, so the buffer survives
 * tool-window switches), and the only action here is a client-local Clear that
 * empties the view without touching the engine's retained log.
 *
 * Never-silent: capture only works on a CDP-attached, in-scope tab, so when
 * the inspected tab is out of that scope the view says why and (when the master
 * switch is simply off) offers to turn Debug mode on. Any already-captured
 * entries stay readable under a "capture stopped" banner rather than vanishing.
 */

import { ClearOutlined } from '@ant-design/icons';
import type { ConsoleEntry, ConsoleLevel } from '@openheaders/core/console-stream';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { Button, Segmented, Tooltip } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { useStickToBottom } from './detail/streams/use-stick-to-bottom';
import { formatClock } from '../data/format-time';
import { useInspectedTabCdp } from '../data/use-inspected-tab-cdp';

interface ConsoleViewProps {
  entries: readonly ConsoleEntry[];
  /** Client-local clear — empties the view, leaves the engine log intact. */
  onClear: () => void;
  onHide: () => void;
}

type LevelFilter = 'all' | 'warnings' | 'errors';

/** Severity-threshold level filter: "Warnings" keeps warnings *and* errors. */
function passesLevel(level: ConsoleLevel, filter: LevelFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'errors') return level === 'error';
  return level === 'warning' || level === 'error';
}

interface ConsoleSourceLocation {
  short: string;
  full: string;
}

/** CDP frame line/column numbers are 0-based; display them 1-based. */
function sourceLocation(entry: ConsoleEntry): ConsoleSourceLocation | null {
  if (!entry.url) return null;
  const line = entry.lineNumber != null ? `:${entry.lineNumber + 1}` : '';
  const col = entry.lineNumber != null && entry.columnNumber != null ? `:${entry.columnNumber + 1}` : '';
  let label = entry.url;
  try {
    const u = new URL(entry.url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    label = last || u.hostname;
  } catch {
    // Non-URL origin (eval / anonymous) — show the raw string.
  }
  return { short: `${label}${line}`, full: `${entry.url}${line}${col}` };
}

interface ConsoleRow {
  entry: ConsoleEntry;
  text: string;
  location: ConsoleSourceLocation | null;
}

export function ConsoleView({ entries, onClear, onHide }: ConsoleViewProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [textFilter, setTextFilter] = useState('');
  const { hasCdpCapability, cdpEnabled, cdpOwned } = useInspectedTabCdp();
  const [, setCdpEnabled] = useSetting('inspection.cdpEnabled');

  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<ConsoleRow[]>(() => {
    const needle = textFilter.trim().toLowerCase();
    const result: ConsoleRow[] = [];
    for (const entry of entries) {
      if (!passesLevel(entry.level, levelFilter)) continue;
      const text = entry.args.map((a) => a.text).join(' ');
      const location = sourceLocation(entry);
      if (needle && !text.toLowerCase().includes(needle) && !(location?.full.toLowerCase().includes(needle) ?? false)) {
        continue;
      }
      result.push({ entry, text, location });
    }
    return result;
  }, [entries, levelFilter, textFilter]);

  const { onScroll } = useStickToBottom(bodyRef, rows.length);

  // Capture is live only on a CDP-attached, in-scope tab. "Debug mode off" is
  // the one out-of-scope case we can resolve in place (flip the master switch);
  // an in-scope-but-unpinned tab is steered from Debug mode itself.
  const capturing = cdpOwned;
  const canEnableDebug = hasCdpCapability && !cdpEnabled;

  const enableDebug = (): void => setCdpEnabled(true);

  return (
    <div className="dt-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-console-toolbar">
            <Segmented<LevelFilter>
              size="small"
              value={levelFilter}
              onChange={setLevelFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Warnings', value: 'warnings' },
                { label: 'Errors', value: 'errors' },
              ]}
            />
            <input
              type="text"
              className="dt-console-filter-input"
              placeholder="Filter"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
            <Tooltip title="Clear console" placement="bottom">
              <button type="button" className="dt-console-clear-btn" onClick={onClear} aria-label="Clear console">
                <ClearOutlined />
              </button>
            </Tooltip>
          </div>
        }
      />

      <div className="dt-console-body" ref={bodyRef} onScroll={onScroll}>
        {entries.length === 0 ? (
          <ConsoleEmpty
            hasCdpCapability={hasCdpCapability}
            cdpEnabled={cdpEnabled}
            capturing={capturing}
            onEnableDebug={canEnableDebug ? enableDebug : undefined}
          />
        ) : (
          <>
            {!capturing && (
              <div className="dt-console-banner">
                <span>
                  Capture stopped —{' '}
                  {cdpEnabled
                    ? 'this tab left Debug mode’s scope. Showing the last captured output.'
                    : 'Debug mode is off. Showing the last captured output.'}
                </span>
                {canEnableDebug && (
                  <Button size="small" type="link" onClick={enableDebug}>
                    Enable Debug mode
                  </Button>
                )}
              </div>
            )}
            {rows.length === 0 ? (
              <div className="dt-empty">No console entries match your filter.</div>
            ) : (
              rows.map((row, i) => (
                <div
                  // Arrival order is stable and entries are append-only, so the
                  // index is a safe key for this list.
                  key={i}
                  className="dt-console-row"
                  data-level={row.entry.level}
                  data-source={row.entry.source}
                >
                  <span className="dt-console-dot" />
                  <span className="dt-console-time">{formatClock(row.entry.timestamp, 'local')}</span>
                  <span className="dt-console-msg" title={row.text}>
                    {row.text}
                  </span>
                  {row.location && (
                    <span className="dt-console-loc" title={row.location.full}>
                      {row.location.short}
                    </span>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConsoleEmptyProps {
  hasCdpCapability: boolean;
  cdpEnabled: boolean;
  capturing: boolean;
  onEnableDebug?: () => void;
}

function ConsoleEmpty({ hasCdpCapability, cdpEnabled, capturing, onEnableDebug }: ConsoleEmptyProps) {
  if (!hasCdpCapability) {
    return (
      <div className="dt-empty-hero">
        <strong>Console capture needs Debug mode</strong>
        <span className="dt-empty-hero-sub">Debug-mode inspection isn’t available in this browser.</span>
      </div>
    );
  }
  if (capturing) {
    return (
      <div className="dt-empty-hero">
        <strong>No console output yet</strong>
        <span className="dt-empty-hero-sub">
          This tab’s log messages and uncaught exceptions will appear here as they happen.
        </span>
      </div>
    );
  }
  if (!cdpEnabled) {
    return (
      <div className="dt-empty-hero">
        <strong>Enable Debug mode to view console logs</strong>
        <span className="dt-empty-hero-sub">
          Open Headers captures this tab’s console output and uncaught exceptions while Debug mode is on.
        </span>
        {onEnableDebug && (
          <Button type="primary" onClick={onEnableDebug}>
            Enable Debug mode
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="dt-empty-hero">
      <strong>This tab is outside Debug mode’s scope</strong>
      <span className="dt-empty-hero-sub">
        Bring it into scope from Debug mode — change the scope or pin this tab — to capture its console output.
      </span>
    </div>
  );
}

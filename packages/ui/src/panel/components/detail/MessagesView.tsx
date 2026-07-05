/**
 * MessagesView — WebSocket frame log for an upgraded HTTP connection,
 * matching the host's Messages tab:
 *
 *   - Toolbar: Clear all, All / Send / Receive direction filter, regex
 *     filter (invalid patterns degrade to a literal match).
 *   - Grid: Data | Length | Time. Time is the one sortable column,
 *     ascending by default; the list follows the tail while parked at
 *     the bottom (same pin semantics as the main traffic table).
 *   - Selecting a row opens the payload preview in a resizable pane —
 *     JSON tree / verbatim text for text frames, a Base64 / Hex / UTF-8
 *     viewer for binary frames. The grid/payload split is a standard
 *     Allotment sash; a toolbar toggle swaps stacked (default) for
 *     side-by-side, same affordance as the workbench editors.
 *   - "Clear all" hides everything received so far for this request
 *     (view-local; the underlying lifecycle list is untouched).
 *
 * Data sources and the honest empty states are unchanged from the
 * first slice: the live `lifecycle.messages` plane is preferred, the
 * HAR `_webSocketMessages` dialect is the fallback, and the heuristic
 * capture path (which can see neither) explains itself.
 */

import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { useMemo, useRef, useState } from 'react';
import MessagePreview from './streams/MessagePreview';
import StreamGridToolbar, { type WsDirectionFilter } from './streams/StreamGridToolbar';
import { compileStreamFilter } from './streams/stream-filter';
import { formatStreamTime, streamTimeTooltip } from './streams/stream-time';
import { useMessagesSplitLayout } from './streams/use-messages-split-layout';
import { useStickToBottom } from './streams/use-stick-to-bottom';
import {
  frameDataLabel,
  frameLengthLabel,
  opcodeDescription,
  type WsDisplayFrame,
  wsDisplayFrames,
} from './streams/ws-frames';

export function hasWebSocketMessages(har: InspectorHarEntry): boolean {
  const msgs = har._webSocketMessages;
  return Array.isArray(msgs) && msgs.length > 0;
}

type SortDirection = 'asc' | 'desc';

interface MessagesViewProps {
  lifecycle: RequestLifecycle;
  har: InspectorHarEntry | null;
  /** Which correlator feeds the tab — drives the honest empty-state copy. */
  source: LifecycleSource;
}

function directionClass(type: WsDisplayFrame['type']): string {
  if (type === 'send') return 'dt-ws-row--send';
  if (type === 'error') return 'dt-ws-row--error';
  return 'dt-ws-row--recv';
}

function directionArrow(type: WsDisplayFrame['type']): string {
  if (type === 'send') return '⬆';
  if (type === 'error') return '⚠';
  return '⬇';
}

export default function MessagesView({ lifecycle, har, source }: MessagesViewProps) {
  const [direction, setDirection] = useState<WsDirectionFilter>('all');
  const [filterText, setFilterText] = useState('');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [clearedCount, setClearedCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useMessagesSplitLayout();

  const all = useMemo(() => wsDisplayFrames(lifecycle, har), [lifecycle, har]);

  const visible = useMemo(() => {
    const regex = compileStreamFilter(filterText, 'literal');
    const afterClear = clearedCount > 0 ? all.filter((f) => f.index >= clearedCount) : all;
    const filtered = afterClear.filter(
      (f) => (direction === 'all' || f.type === direction) && (!regex || regex.test(f.data)),
    );
    // Arrival order is time order; a stable index tiebreak keeps
    // equal-millisecond frames in wire order under both directions.
    if (sortDir === 'desc') {
      return [...filtered].sort((a, b) => b.atMs - a.atMs || b.index - a.index);
    }
    return filtered;
  }, [all, clearedCount, direction, filterText, sortDir]);

  const { onScroll } = useStickToBottom(listRef, visible.length);

  if (all.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        {source === 'cdp'
          ? 'No WebSocket frames exchanged yet.'
          : 'WebSocket frames are only visible with debug mode enabled for this tab.'}
      </div>
    );
  }

  const dropped = lifecycle.messagesDropped ?? 0;
  const selected = selectedIndex != null ? (all.find((f) => f.index === selectedIndex) ?? null) : null;

  const onClear = () => {
    // Hide everything observed so far: the next frame's index is the floor.
    setClearedCount(all.length > 0 ? all[all.length - 1].index + 1 : 0);
    setSelectedIndex(null);
  };

  const selectRelative = (delta: -1 | 1) => {
    if (visible.length === 0) return;
    const pos = selectedIndex == null ? -1 : visible.findIndex((f) => f.index === selectedIndex);
    const next = pos < 0 ? (delta === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, pos + delta));
    setSelectedIndex(visible[next].index);
  };

  return (
    <div className="dt-ws-view">
      <StreamGridToolbar
        onClear={onClear}
        directionFilter={{ value: direction, onChange: setDirection }}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterPlaceholder="Filter using regex (example: (web)?socket)"
        layoutToggle={{ layout, onChange: setLayout }}
      />
      {dropped > 0 && (
        <div className="dt-ws-truncation">
          Showing the latest {all.length} frames — {dropped} older {dropped === 1 ? 'frame' : 'frames'} dropped.
        </div>
      )}
      {/* Allotment captures its orientation at mount and ignores later
        `vertical` prop changes, so remount on `layout` change via `key` —
        same discipline as the workbench request editor. */}
      <div className="dt-ws-split">
        <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
          <Allotment.Pane minSize={layout === 'vertical' ? 80 : 200} preferredSize="60%">
            <div
              className="dt-ws-list"
              ref={listRef}
              onScroll={onScroll}
              role="listbox"
              aria-label="WebSocket messages"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  selectRelative(1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  selectRelative(-1);
                }
              }}
            >
              <div className="dt-ws-row dt-ws-row-header">
                <span className="dt-ws-dir" aria-hidden="true" />
                <span className="dt-ws-data">Data</span>
                <span className="dt-ws-len">Length</span>
                <button
                  type="button"
                  className="dt-ws-time dt-ws-sort-btn"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  title="Sort by time"
                >
                  Time <span aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>
                </button>
              </div>
              {visible.map((m) => {
                const isSelected = m.index === selectedIndex;
                return (
                  <div
                    key={`ws-${m.index}`}
                    className={`dt-ws-row ${directionClass(m.type)}${isSelected ? ' dt-ws-row--selected' : ''}`}
                    title={opcodeDescription(m.opcode, m.mask)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedIndex(m.index)}
                  >
                    <span className="dt-ws-dir" aria-hidden="true">
                      {directionArrow(m.type)}
                    </span>
                    <span className="dt-ws-data">{frameDataLabel(m)}</span>
                    <span className="dt-ws-len">{frameLengthLabel(m)}</span>
                    <span className="dt-ws-time" title={streamTimeTooltip(m.atMs)}>
                      {formatStreamTime(m.atMs)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={layout === 'vertical' ? 60 : 160}>
            <div className="dt-ws-preview">
              <MessagePreview frame={selected} />
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

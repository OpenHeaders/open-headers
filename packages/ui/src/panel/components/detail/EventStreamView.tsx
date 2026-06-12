/**
 * EventStreamView — Server-Sent Events log for a `text/event-stream`
 * response, matching the host's EventStream tab:
 *
 *   - Toolbar: Clear all + regex filter matching the event name, id and
 *     data (an invalid pattern matches nothing until it parses).
 *   - Grid: Id | Type | Data | Time — Id / Type / Time sortable, Time
 *     ascending by default; the list follows the tail while parked at
 *     the bottom.
 *   - "Clear all" hides everything received so far (view-local).
 *
 * Two sources, one display shape:
 *   - `lifecycle.messages` (kind `sse`) — the LIVE plane, preferred
 *     whenever present; carries per-event wall-clock times.
 *   - the finished response body — the heuristic fallback: parse the SSE
 *     wire format out of the body text once the host delivers it. These
 *     events carry no time (the wire format has none), so their Time
 *     cells stay empty. For long-running streams that never finish
 *     during the session the body stays empty, so this leg honestly
 *     shows nothing until close.
 */

import type { RequestLifecycle, SseStreamMessage } from '@openheaders/core/request-lifecycle';
import { useMemo, useRef, useState } from 'react';
import { currentResponseBody, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import StreamGridToolbar from './streams/StreamGridToolbar';
import { compileStreamFilter } from './streams/stream-filter';
import { formatStreamTime, streamTimeTooltip } from './streams/stream-time';
import { useStickToBottom } from './streams/use-stick-to-bottom';

interface SseEvent {
  /** Stable identity within the request — index in the source list. */
  index: number;
  id?: string;
  event: string;
  data: string;
  /** Wall-clock ms — live plane only; body-parsed events carry none. */
  atMs?: number;
}

function parseSse(body: string): Omit<SseEvent, 'index'>[] {
  if (!body) return [];
  const out: Omit<SseEvent, 'index'>[] = [];
  const blocks = body.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let id: string | undefined;
    let eventType = 'message';
    const dataLines: string[] = [];
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'id') id = value;
      else if (field === 'event') eventType = value || 'message';
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0 && !id) continue;
    out.push({ id, event: eventType, data: dataLines.join('\n') });
  }
  return out;
}

export function isEventStream(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('text/event-stream');
}

function isSseStreamMessage(m: { kind: string }): m is SseStreamMessage {
  return m.kind === 'sse';
}

/** The live plane's events, projected to the display shape. */
function liveSseEvents(lifecycle: RequestLifecycle): SseEvent[] {
  return (lifecycle.messages ?? [])
    .filter(isSseStreamMessage)
    .map((m, index) => ({ index, id: m.eventId || undefined, event: m.eventName, data: m.data, atMs: m.atMs }));
}

type SortColumn = 'id' | 'type' | 'time';
type SortDirection = 'asc' | 'desc';

function compareEvents(a: SseEvent, b: SseEvent, column: SortColumn): number {
  if (column === 'time') return (a.atMs ?? 0) - (b.atMs ?? 0) || a.index - b.index;
  const av = column === 'id' ? (a.id ?? '') : a.event;
  const bv = column === 'id' ? (b.id ?? '') : b.event;
  return av < bv ? -1 : av > bv ? 1 : a.index - b.index;
}

interface EventStreamViewProps {
  row: InspectorRowWithFires;
}

export default function EventStreamView({ row }: EventStreamViewProps) {
  const [filterText, setFilterText] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('time');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [clearedCount, setClearedCount] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => liveSseEvents(row.lifecycle), [row.lifecycle]);
  const body = live.length > 0 ? '' : (currentResponseBody(row.lifecycle)?.content ?? '');
  const parsed = useMemo(() => parseSse(body).map((ev, index) => ({ ...ev, index })), [body]);
  const all = live.length > 0 ? live : parsed;

  const visible = useMemo(() => {
    const regex = compileStreamFilter(filterText, 'never');
    const afterClear = clearedCount > 0 ? all.filter((ev) => ev.index >= clearedCount) : all;
    const filtered = afterClear.filter(
      (ev) => !regex || regex.test(ev.event) || regex.test(ev.id ?? '') || regex.test(ev.data),
    );
    const sorted = [...filtered].sort((a, b) => compareEvents(a, b, sortColumn));
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [all, clearedCount, filterText, sortColumn, sortDir]);

  const { onScroll } = useStickToBottom(listRef, visible.length);

  if (all.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24, textAlign: 'center' }}>
        {body
          ? 'No parseable SSE events in the response body.'
          : 'No events captured. Server-sent streams are only materialized once the request finishes; long-running streams may not populate here until the connection closes.'}
      </div>
    );
  }

  const dropped = row.lifecycle.messagesDropped ?? 0;

  const onSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  };

  const sortMarker = (column: SortColumn) =>
    sortColumn === column ? (
      <span aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>
    ) : null;

  return (
    <div className="dt-sse-view">
      <StreamGridToolbar
        onClear={() => setClearedCount(all.length > 0 ? all[all.length - 1].index + 1 : 0)}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterPlaceholder="Filter using regex (example: https?)"
      />
      {live.length > 0 && dropped > 0 && (
        <div className="dt-sse-truncation">
          Showing the latest {all.length} events — {dropped} older {dropped === 1 ? 'event' : 'events'} dropped.
        </div>
      )}
      <div className="dt-sse-list" ref={listRef} onScroll={onScroll}>
        <div className="dt-sse-row dt-sse-row-header">
          <button type="button" className="dt-sse-id dt-sse-sort-btn" onClick={() => onSort('id')} title="Sort by id">
            Id {sortMarker('id')}
          </button>
          <button
            type="button"
            className="dt-sse-type dt-sse-sort-btn"
            onClick={() => onSort('type')}
            title="Sort by type"
          >
            Type {sortMarker('type')}
          </button>
          <span className="dt-sse-data">Data</span>
          <button
            type="button"
            className="dt-sse-time dt-sse-sort-btn"
            onClick={() => onSort('time')}
            title="Sort by time"
          >
            Time {sortMarker('time')}
          </button>
        </div>
        {visible.map((ev) => (
          <div key={`sse-${ev.index}`} className="dt-sse-row">
            <span className="dt-sse-id dt-col-muted">{ev.id ?? ''}</span>
            <span className="dt-sse-type">{ev.event}</span>
            <span className="dt-sse-data" title={ev.data}>
              {ev.data}
            </span>
            <span className="dt-sse-time" title={ev.atMs != null ? streamTimeTooltip(ev.atMs) : undefined}>
              {ev.atMs != null ? formatStreamTime(ev.atMs) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

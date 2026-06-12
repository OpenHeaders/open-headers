/**
 * EventStreamView — Server-Sent Events log for a `text/event-stream`
 * response.
 *
 * Two sources, one display shape:
 *   - `lifecycle.messages` (kind `sse`) — the LIVE plane: events parsed
 *     by the network stack and streamed per `message-appended` update by
 *     the deep-inspection correlator, growing while the stream is open.
 *     Preferred whenever present.
 *   - the finished response body — the heuristic fallback: parse the SSE
 *     wire format out of the body text once the host delivers it. For
 *     long-running streams that never finish during the session the body
 *     stays empty, so this leg honestly shows nothing until close.
 *
 * SSE wire format (the fallback parser): events separated by blank
 * lines; `id:` / `event:` (defaults to "message") / `data:` (multiple
 * lines concatenate with `\n`) / `retry:`; `:`-prefixed lines are
 * comments.
 */

import type { RequestLifecycle, SseStreamMessage } from '@openheaders/core/request-lifecycle';
import { useMemo } from 'react';
import { currentResponseBody, type InspectorRowWithFires } from '../../data/inspector-row-projection';

interface SseEvent {
  id?: string;
  event: string;
  data: string;
}

function parseSse(body: string): SseEvent[] {
  if (!body) return [];
  const out: SseEvent[] = [];
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
  return (lifecycle.messages ?? []).filter(isSseStreamMessage).map((m) => ({
    id: m.eventId || undefined,
    event: m.eventName,
    data: m.data,
  }));
}

interface EventStreamViewProps {
  row: InspectorRowWithFires;
}

export default function EventStreamView({ row }: EventStreamViewProps) {
  const live = liveSseEvents(row.lifecycle);
  const body = live.length > 0 ? '' : (currentResponseBody(row.lifecycle)?.content ?? '');
  const parsed = useMemo(() => parseSse(body), [body]);
  const events = live.length > 0 ? live : parsed;

  if (events.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24, textAlign: 'center' }}>
        {body
          ? 'No parseable SSE events in the response body.'
          : 'No events captured. Server-sent streams are only materialized once the request finishes; long-running streams may not populate here until the connection closes.'}
      </div>
    );
  }

  const dropped = row.lifecycle.messagesDropped ?? 0;

  return (
    <div className="dt-sse-view">
      {live.length > 0 && dropped > 0 && (
        <div className="dt-sse-truncation">
          Showing the latest {events.length} events — {dropped} older {dropped === 1 ? 'event' : 'events'} dropped.
        </div>
      )}
      <div className="dt-sse-row dt-sse-row-header">
        <span className="dt-sse-id">Id</span>
        <span className="dt-sse-type">Type</span>
        <span className="dt-sse-data">Data</span>
      </div>
      <div className="dt-sse-list">
        {events.map((ev, i) => (
          <div key={`sse-${i}-${ev.id ?? ''}`} className="dt-sse-row">
            <span className="dt-sse-id dt-col-muted">{ev.id ?? ''}</span>
            <span className="dt-sse-type">{ev.event}</span>
            <pre className="dt-sse-data">{ev.data}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

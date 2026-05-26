/**
 * EventStreamView — Server-Sent Events frame log for a `text/event-stream`
 * response.
 *
 * The HTTP response body is a stream of events separated by blank
 * lines. Each event consists of line prefixes:
 *   - `id: <id>`
 *   - `event: <type>`     (defaults to "message" if absent)
 *   - `data: <payload>`   (multiple `data:` lines concatenate with `\n`)
 *   - `retry: <ms>`
 *   - lines starting with `:` are comments
 *
 * The host's body API hands us the full body text once the request
 * finishes; for long-running streams that never finish during the
 * DevTools session the body may be empty.
 */

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

interface EventStreamViewProps {
  row: InspectorRowWithFires;
}

export default function EventStreamView({ row }: EventStreamViewProps) {
  const body = currentResponseBody(row.lifecycle)?.content ?? '';
  const events = useMemo(() => parseSse(body), [body]);

  if (events.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24, textAlign: 'center' }}>
        {body
          ? 'No parseable SSE events in the response body.'
          : 'No events captured. Server-sent streams are only materialized once the request finishes; long-running streams may not populate here until the connection closes.'}
      </div>
    );
  }

  return (
    <div className="dt-sse-view">
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

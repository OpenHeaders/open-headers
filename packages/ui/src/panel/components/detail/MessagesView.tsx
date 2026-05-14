/**
 * MessagesView — WebSocket frame log for an upgraded HTTP connection.
 *
 * Reads from the non-standard `har._webSocketMessages` extension that
 * Chrome annotates onto HAR entries whose request upgraded to
 * WebSocket. Each frame has:
 *   - `type`: 'send' | 'receive'
 *   - `time`: wall-clock seconds (HAR uses `time` in seconds for this
 *     extension — unlike the main HAR.time field which is in ms)
 *   - `opcode`: WebSocket opcode (1 = text, 2 = binary, 8 = close,
 *     9 = ping, 10 = pong)
 *   - `data`: text payload (binary frames show as base64/empty string)
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

interface WsMessage {
  type: 'send' | 'receive';
  time: number;
  opcode: number;
  data: string;
}

const OPCODE_LABEL: Record<number, string> = {
  1: 'Text',
  2: 'Binary',
  8: 'Close',
  9: 'Ping',
  10: 'Pong',
};

function isWsMessage(v: unknown): v is WsMessage {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (r.type === 'send' || r.type === 'receive') && typeof r.time === 'number';
}

export function hasWebSocketMessages(har: InspectorHarEntry): boolean {
  const msgs = har._webSocketMessages;
  return Array.isArray(msgs) && msgs.length > 0;
}

function formatWsTimestamp(seconds: number): string {
  const d = new Date(seconds * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

interface MessagesViewProps {
  har: InspectorHarEntry;
}

export default function MessagesView({ har }: MessagesViewProps) {
  const raw = har._webSocketMessages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        This request did not exchange any WebSocket frames.
      </div>
    );
  }
  const messages = raw.filter(isWsMessage);

  return (
    <div className="dt-ws-view">
      <div className="dt-ws-row dt-ws-row-header">
        <span className="dt-ws-dir" aria-hidden="true" />
        <span className="dt-ws-data">Data</span>
        <span className="dt-ws-len">Length</span>
        <span className="dt-ws-time">Time</span>
      </div>
      <div className="dt-ws-list">
        {messages.map((m, i) => {
          const dirCls = m.type === 'send' ? 'dt-ws-dir--send' : 'dt-ws-dir--recv';
          const arrow = m.type === 'send' ? '\u2191' : '\u2193';
          const label = OPCODE_LABEL[m.opcode] ?? `Op ${m.opcode}`;
          const len = new Blob([m.data ?? '']).size;
          return (
            <div key={`ws-${i}-${m.time}`} className={`dt-ws-row ${dirCls}`} title={label}>
              <span className="dt-ws-dir" aria-hidden="true">
                {arrow}
              </span>
              <span className="dt-ws-data" title={m.data}>
                {m.data}
              </span>
              <span className="dt-ws-len">{len}</span>
              <span className="dt-ws-time">{formatWsTimestamp(m.time)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

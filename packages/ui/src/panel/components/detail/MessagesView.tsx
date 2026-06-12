/**
 * MessagesView — WebSocket frame log for an upgraded HTTP connection.
 *
 * Two sources, one display shape:
 *   - `lifecycle.messages` (kind `ws`) — the LIVE plane: frames streamed
 *     per `message-appended` update by the deep-inspection correlator,
 *     growing while the socket is open. Preferred whenever present.
 *   - `har._webSocketMessages` — the host HAR extension dialect
 *     (`{type, time(wall seconds), opcode, data}`), the fallback for
 *     entries that arrived with frames already attached (e.g. imports).
 *
 * The heuristic capture path can see neither (webRequest has no frame
 * events and the host's devtools feed never delivers WS entries), so a
 * `websocket` row without messages renders an honest empty state.
 *
 * Frame vocabulary: `send` / `receive` data frames (opcode 1 text,
 * 2 binary-as-base64, 8 close, 9/10 ping/pong) plus `error` frames
 * (opcode −1, the transport error message as data) — the host stores
 * errors in the same list.
 */

import type { LifecycleSource, RequestLifecycle, WsStreamMessage } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

interface WsDisplayMessage {
  type: 'send' | 'receive' | 'error';
  /** Wall-clock ms. */
  atMs: number;
  opcode: number;
  data: string;
}

const OPCODE_LABEL: Record<number, string> = {
  [-1]: 'Error',
  1: 'Text',
  2: 'Binary',
  8: 'Close',
  9: 'Ping',
  10: 'Pong',
};

/** HAR-dialect frame — `time` is wall-clock SECONDS (unlike HAR's ms). */
function isHarWsMessage(v: unknown): v is { type: 'send' | 'receive' | 'error'; time: number; opcode?: number; data?: string } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (r.type === 'send' || r.type === 'receive' || r.type === 'error') && typeof r.time === 'number';
}

function isWsStreamMessage(m: { kind: string }): m is WsStreamMessage {
  return m.kind === 'ws';
}

/** The display list — live plane first, HAR dialect fallback. */
function wsDisplayMessages(lifecycle: RequestLifecycle, har: InspectorHarEntry | null): WsDisplayMessage[] {
  const live = (lifecycle.messages ?? []).filter(isWsStreamMessage);
  if (live.length > 0) {
    return live.map((m) => ({ type: m.type, atMs: m.atMs, opcode: m.opcode, data: m.data }));
  }
  const raw = har?._webSocketMessages;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isHarWsMessage).map((m) => ({
    type: m.type,
    atMs: m.time * 1000,
    opcode: typeof m.opcode === 'number' ? m.opcode : 1,
    data: m.data ?? '',
  }));
}

export function hasWebSocketMessages(har: InspectorHarEntry): boolean {
  const msgs = har._webSocketMessages;
  return Array.isArray(msgs) && msgs.length > 0;
}

function formatWsTimestamp(atMs: number): string {
  const d = new Date(atMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

interface MessagesViewProps {
  lifecycle: RequestLifecycle;
  har: InspectorHarEntry | null;
  /** Which correlator feeds the tab — drives the honest empty-state copy. */
  source: LifecycleSource;
}

export default function MessagesView({ lifecycle, har, source }: MessagesViewProps) {
  const messages = wsDisplayMessages(lifecycle, har);
  if (messages.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        {source === 'cdp'
          ? 'No WebSocket frames exchanged yet.'
          : 'WebSocket frames are only visible with deep request inspection enabled for this tab.'}
      </div>
    );
  }

  const dropped = lifecycle.messagesDropped ?? 0;

  return (
    <div className="dt-ws-view">
      {dropped > 0 && (
        <div className="dt-ws-truncation">
          Showing the latest {messages.length} frames — {dropped} older {dropped === 1 ? 'frame' : 'frames'} dropped.
        </div>
      )}
      <div className="dt-ws-row dt-ws-row-header">
        <span className="dt-ws-dir" aria-hidden="true" />
        <span className="dt-ws-data">Data</span>
        <span className="dt-ws-len">Length</span>
        <span className="dt-ws-time">Time</span>
      </div>
      <div className="dt-ws-list">
        {messages.map((m, i) => {
          const dirCls = m.type === 'send' ? 'dt-ws-dir--send' : m.type === 'error' ? 'dt-ws-dir--error' : 'dt-ws-dir--recv';
          const arrow = m.type === 'send' ? '↑' : m.type === 'error' ? '⚠' : '↓';
          const label = OPCODE_LABEL[m.opcode] ?? `Op ${m.opcode}`;
          const len = new Blob([m.data ?? '']).size;
          return (
            <div key={`ws-${i}-${m.atMs}`} className={`dt-ws-row ${dirCls}`} title={label}>
              <span className="dt-ws-dir" aria-hidden="true">
                {arrow}
              </span>
              <span className="dt-ws-data" title={m.data}>
                {m.data}
              </span>
              <span className="dt-ws-len">{len}</span>
              <span className="dt-ws-time">{formatWsTimestamp(m.atMs)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

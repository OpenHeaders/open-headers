/**
 * WsMessageTimeline — the message-list surface for WebSocket sessions,
 * ONE list across both phases: live (fed from `wsStreamEvent` frames
 * while the session is open) and materialized (fed from the
 * snapshot's direction-tagged capture, session timestamps joined
 * positionally). A SIBLING of the SSE and gRPC lists on the same
 * shared recipes — `useVirtualRowWindow`, pinned row heights,
 * append-only item identity, jump pill, identity scroll anchor —
 * never a parameterization of either (the ratified sibling law).
 *
 * The timeline is ONE event log in call order: "Connecting" and
 * "Disconnected / Stopped / Failed" sit at the chronological edges,
 * and "Connected" sits before the first message — a WebSocket client
 * cannot write before the handshake settles, so no interleave
 * arithmetic exists (the gRPC `headAtMessage` machinery has no WS
 * twin by construction). Rows read direction glyph · payload preview
 * · right-aligned session time; binary frames render an honest byte
 * label and their base64 in the expanded viewer (payloads verbatim —
 * decode is display-side). WS payloads carry no declared types, so
 * the gRPC list's type chips and group-by-type have no sibling here.
 *
 * Sort rides the `requests.wsMessagesNewestFirst` SETTING (global,
 * toolbar-written — the choice survives Connect/Disconnect remounts),
 * newest-first by default. Search, direction filter and Clear are
 * display-only — the capture is never touched. Timestamps are
 * session-only (the ratified law): absent rows simply render no time.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  DisconnectOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { parseEngineIoFrame, SOCKET_IO_PACKET_TYPES } from '@openheaders/core/socketio';
import type { WebSocketFlavor } from '@openheaders/core/types';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { Button, ConfigProvider, Dropdown, Input, Segmented, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';

const { Text } = Typography;

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
const PREVIEW_MAX_CHARS = 400;

/** Pinned border-box height of every single-line row — the virtual
 *  window's arithmetic depends on heights being exact by construction. */
const SINGLE_ROW_PX = 28;
/** Pinned height of an expanded row's mini viewer (180px editor +
 *  1px divider). */
const VIEWER_PX = 181;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** One timeline message — the live wire item and the snapshot message
 *  share this shape (atMs rides only the live one; materialized times
 *  join via `timestamps`). */
export interface WsTimelineItem {
  direction: 'up' | 'down';
  dataBase64: string;
  binary: boolean;
}

/** How the session ended — drives the ended lifecycle row. */
export type WsTimelineEndedBy = 'close' | 'stop' | 'error';

export interface WsTimelineLifecycle {
  /** Session-only Connect-departure time. */
  startedAt?: number;
  /** True once the handshake settled. */
  connected: boolean;
  /** Session-only handshake-settled time. */
  connectedAt?: number;
  /** The negotiated subprotocol, named on the Connected row. */
  protocol?: string;
  /** Absent while the session is open — the live phase. */
  endedBy?: WsTimelineEndedBy;
  endedAt?: number;
  /** The close/failure detail riding the ended row — "1000 normal
   *  closure", the honest no-Close-frame note, or the classified
   *  error. Assembled by the pane; rendered verbatim. */
  endedMessage?: string;
}

interface WsMessageTimelineProps {
  /** Message log — append-only during the live phase (the array
   *  reference stays stable; `count` is the committed prefix), the
   *  snapshot's capture once materialized. */
  items: readonly WsTimelineItem[];
  count: number;
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[];
  lifecycle: WsTimelineLifecycle;
  /** Messages that rolled off the retention window — an honest notice
   *  row above the list when non-zero. */
  droppedMessages?: number;
  /** Session wire family — `socketio` decodes engine.io/socket.io
   *  frames into event and control rows (display-side only; the
   *  capture stays verbatim). Absent = raw. */
  flavor?: WebSocketFlavor;
}

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. */
type ListEntry =
  | { key: string; kind: 'sent' | 'connected' | 'ended' | 'waiting' | 'noMatches' }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number };

type DirectionFilter = 'all' | 'up' | 'down';

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Lifecycle label for how the session ended. */
function endedLabel(endedBy: WsTimelineEndedBy, t: Translate): string {
  switch (endedBy) {
    case 'close':
      return t('workbench.editors.websocket.timeline.disconnected');
    case 'stop':
      return t('workbench.editors.websocket.timeline.stopped');
    case 'error':
      return t('workbench.editors.websocket.timeline.failed');
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return '';
    }
  }
}

/** Last entry index whose top offset is at or above `scrollTop`. */
function entryIndexAt(prefix: readonly number[], scrollTop: number): number {
  let lo = 0;
  let hi = prefix.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (prefix[mid] <= scrollTop) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** A message's display view — text frames decode display-side (json
 *  highlighting when the payload parses), binary frames stay base64. */
export interface WsMessageView {
  kind: 'text' | 'json' | 'binary';
  /** Decoded text (text/json) or the base64 payload (binary). */
  text: string;
  byteLength: number;
}

/**
 * Display-side decode of one socket.io frame — the capture stays the
 * verbatim wire text; this view names what the frame IS so the row
 * reads like the protocol event it carries. `event` / `ack` carry a
 * compact preview for the row and a pretty payload for the viewer.
 */
export type WsSioView =
  | { kind: 'engineOpen' }
  | { kind: 'engineClose' }
  | { kind: 'ping' }
  | { kind: 'pong' }
  | { kind: 'connect'; namespace: string }
  | { kind: 'connectAck'; namespace: string }
  | { kind: 'connectError' }
  | { kind: 'disconnect'; namespace: string }
  | { kind: 'event'; name: string | null; ackId: number | null; argsPreview: string; payloadPretty: string }
  | { kind: 'ack'; ackId: number | null; payloadPretty: string }
  | { kind: 'binaryAttachments'; attachments: number };

/** Decode one socket.io wire frame into its display view; `null` when
 *  the text carries no recognizable engine.io grammar (renders raw). */
function sioViewOfText(text: string, direction: 'up' | 'down'): WsSioView | null {
  const frame = parseEngineIoFrame(text);
  switch (frame.kind) {
    case 'open':
      return { kind: 'engineOpen' };
    case 'close':
      return { kind: 'engineClose' };
    case 'ping':
      return { kind: 'ping' };
    case 'pong':
      return { kind: 'pong' };
    case 'packet':
      break;
    default:
      return null;
  }
  const packet = frame.packet;
  const prettyOf = (json: string | null): string => {
    if (json === null || json === '') return '';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };
  switch (packet.type) {
    case SOCKET_IO_PACKET_TYPES.connect:
      return direction === 'up'
        ? { kind: 'connect', namespace: packet.namespace }
        : { kind: 'connectAck', namespace: packet.namespace };
    case SOCKET_IO_PACKET_TYPES.disconnect:
      return { kind: 'disconnect', namespace: packet.namespace };
    case SOCKET_IO_PACKET_TYPES.connectError:
      return { kind: 'connectError' };
    case SOCKET_IO_PACKET_TYPES.event: {
      if (packet.dataJson !== null) {
        try {
          const parsed: unknown = JSON.parse(packet.dataJson);
          if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            const args = parsed.slice(1);
            return {
              kind: 'event',
              name: parsed[0],
              ackId: packet.ackId,
              argsPreview: args.length > 0 ? JSON.stringify(args) : '',
              payloadPretty: JSON.stringify(args, null, 2),
            };
          }
        } catch {
          // Fall through to the nameless event below.
        }
      }
      return {
        kind: 'event',
        name: null,
        ackId: packet.ackId,
        argsPreview: packet.dataJson ?? '',
        payloadPretty: prettyOf(packet.dataJson),
      };
    }
    case SOCKET_IO_PACKET_TYPES.ack:
      return { kind: 'ack', ackId: packet.ackId, payloadPretty: prettyOf(packet.dataJson) };
    case SOCKET_IO_PACKET_TYPES.binaryEvent:
    case SOCKET_IO_PACKET_TYPES.binaryAck:
      return { kind: 'binaryAttachments', attachments: packet.attachments };
    default:
      return null;
  }
}

/** Per-item view/preview caches — item identity is append-only, so a
 *  WeakMap never serves a stale decode. */
interface WsFrameDerivations {
  viewOf: (item: WsTimelineItem) => WsMessageView;
  previewOf: (item: WsTimelineItem) => string;
  /** Socket.IO display decode; always `null` on the raw flavor and on
   *  binary frames. */
  sioOf: (item: WsTimelineItem) => WsSioView | null;
}

function makeWsFrameDerivations(decodeSio: boolean): WsFrameDerivations {
  const viewCache = new WeakMap<WsTimelineItem, WsMessageView>();
  const previewCache = new WeakMap<WsTimelineItem, string>();
  const sioCache = new WeakMap<WsTimelineItem, WsSioView | null>();
  const viewOf = (item: WsTimelineItem): WsMessageView => {
    const hit = viewCache.get(item);
    if (hit !== undefined) return hit;
    let view: WsMessageView;
    // A malformed payload string decodes to nothing — the row still
    // renders (empty text / zero bytes) rather than throwing.
    const bytes = decodeBase64Bytes(item.dataBase64) ?? new Uint8Array(0);
    if (item.binary) {
      view = { kind: 'binary', text: item.dataBase64, byteLength: bytes.byteLength };
    } else {
      const text = new TextDecoder().decode(bytes);
      const trimmed = text.trimStart();
      let kind: 'text' | 'json' = 'text';
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(text);
          kind = 'json';
        } catch {
          kind = 'text';
        }
      }
      view = { kind, text, byteLength: bytes.byteLength };
    }
    viewCache.set(item, view);
    return view;
  };
  const previewOf = (item: WsTimelineItem): string => {
    const hit = previewCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const preview = view.kind === 'binary' ? '' : view.text.replace(/\n\s*/g, ' ').slice(0, PREVIEW_MAX_CHARS);
    previewCache.set(item, preview);
    return preview;
  };
  const sioOf = (item: WsTimelineItem): WsSioView | null => {
    if (!decodeSio || item.binary) return null;
    const hit = sioCache.get(item);
    if (hit !== undefined) return hit;
    const sio = sioViewOfText(viewOf(item).text, item.direction);
    sioCache.set(item, sio);
    return sio;
  };
  return { viewOf, previewOf, sioOf };
}

/** Row label for the socket.io CONTROL frames — `null` for the event
 *  and ack rows, which render their own anatomy. */
function sioControlLabel(sio: WsSioView, t: Translate): string | null {
  switch (sio.kind) {
    case 'engineOpen':
      return t('workbench.editors.websocket.timeline.sio.engineOpen');
    case 'engineClose':
      return t('workbench.editors.websocket.timeline.sio.engineClose');
    case 'ping':
      return t('workbench.editors.websocket.timeline.sio.ping');
    case 'pong':
      return t('workbench.editors.websocket.timeline.sio.pong');
    case 'connect':
      return t('workbench.editors.websocket.timeline.sio.connect', { namespace: sio.namespace });
    case 'connectAck':
      return t('workbench.editors.websocket.timeline.sio.connected', { namespace: sio.namespace });
    case 'connectError':
      return t('workbench.editors.websocket.timeline.sio.connectError');
    case 'disconnect':
      return t('workbench.editors.websocket.timeline.sio.disconnect', { namespace: sio.namespace });
    case 'binaryAttachments':
      return t('workbench.editors.websocket.timeline.sio.binaryAttachments', { count: sio.attachments });
    case 'event':
    case 'ack':
      return null;
    default: {
      const _exhaustive: never = sio;
      void _exhaustive;
      return null;
    }
  }
}

const WsMessageTimeline: React.FC<WsMessageTimelineProps> = ({
  items,
  count,
  timestamps,
  lifecycle,
  droppedMessages = 0,
  flavor,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [wrapLines, setWrapLines] = useState(true);
  // Sort direction is a SETTING — global, user-owned, written by this
  // toolbar and the Settings page alike; a Connect/Disconnect remount
  // never resets it.
  const [newestFirst, setNewestFirst] = useSetting('requests.wsMessagesNewestFirst');

  const derive = useMemo(() => makeWsFrameDerivations(flavor === 'socketio'), [flavor]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const awayFromNewEdgeRef = useRef(false);
  const prevCountRef = useRef(count);
  const anchorRef = useRef<{ key: string; offset: number } | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const jumpToNewest = (toNewest: boolean) => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = toNewest ? 0 : el.scrollHeight;
    awayFromNewEdgeRef.current = false;
    anchorRef.current = null;
    setHasNewMessages(false);
  };

  // A new message log (new session, materialized snapshot) resets the
  // display state — indexes are positional in the log they were
  // minted against.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items identity IS the reset signal.
  useEffect(() => {
    setSearch('');
    setDirectionFilter('all');
    setClearedCount(0);
    setExpanded(new Set<number>());
    setHasNewMessages(false);
    awayFromNewEdgeRef.current = false;
    anchorRef.current = null;
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [items]);

  // Flipping the order lands the user at the new edge, pill cleared.
  useEffect(() => {
    jumpToNewest(newestFirst);
    // biome-ignore lint/correctness/useExhaustiveDependencies: jumpToNewest reads only refs.
  }, [newestFirst]);

  useEffect(() => {
    const grew = count > prevCountRef.current;
    prevCountRef.current = count;
    if (grew && awayFromNewEdgeRef.current) setHasNewMessages(true);
  }, [count]);

  // Every message index passing the search + direction filter, arrival
  // (call) order ascending — one linear pass of primitive work per
  // commit/keystroke. The haystack is the decoded preview — search
  // matches what the user can see (binary rows have no text to match).
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: number[] = [];
    for (let i = clearedCount; i < count; i++) {
      const item = items[i];
      if (directionFilter !== 'all' && item.direction !== directionFilter) continue;
      if (needle !== '' && !derive.previewOf(item).toLowerCase().includes(needle)) continue;
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, search, directionFilter, derive]);

  const filtering = search.trim() !== '' || directionFilter !== 'all';
  const live = lifecycle.endedBy === undefined;

  // The flat display list the virtual window runs over — ONE event
  // log: Connecting at one chronological edge, Connected before the
  // first message (no interleave arithmetic — the client cannot write
  // pre-handshake), the ended row at the other edge. Waiting/no-match
  // notices sit at the edge new rows land on.
  const entries = useMemo(() => {
    const out: ListEntry[] = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const notice: ListEntry | null =
      live && count === 0
        ? { key: 'waiting', kind: 'waiting' }
        : filtering && visibleRows.length === 0 && count > clearedCount
          ? { key: 'none', kind: 'noMatches' }
          : null;

    const tokens: Array<number | 'connected'> = [];
    if (lifecycle.connected) tokens.push('connected');
    for (const index of visibleRows) tokens.push(index);
    if (newestFirst) tokens.reverse();

    if (newestFirst) {
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
      if (notice) out.push(notice);
    } else {
      out.push({ key: 'sent', kind: 'sent' });
    }
    for (const token of tokens) {
      if (token === 'connected') out.push({ key: 'connected', kind: 'connected' });
      else pushRow(token);
    }
    if (newestFirst) {
      out.push({ key: 'sent', kind: 'sent' });
    } else {
      if (notice) out.push(notice);
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
    }
    return out;
  }, [newestFirst, lifecycle.connected, lifecycle.endedBy, live, count, clearedCount, filtering, visibleRows, expanded]);

  const heights = useMemo(() => entries.map((e) => (e.kind === 'viewer' ? VIEWER_PX : SINGLE_ROW_PX)), [entries]);

  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx, prefix } = useVirtualRowWindow(
    scrollerRef,
    heights,
    entries.length > 0,
  );

  // Restore the identity anchor before paint after every list change:
  // following the new edge pins to it; a reading user keeps the row
  // under their viewport top exactly where it was.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0) return;
    if (!awayFromNewEdgeRef.current) {
      const edgeTop = newestFirst ? 0 : Math.max(0, (prefix[prefix.length - 1] ?? 0) - el.clientHeight);
      if (Math.abs(el.scrollTop - edgeTop) > 1) {
        el.scrollTop = edgeTop;
        onWindowScroll();
      }
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const idx = entries.findIndex((entry) => entry.key === anchor.key);
    if (idx < 0) return;
    const next = prefix[idx] + anchor.offset;
    if (Math.abs(el.scrollTop - next) > 1) {
      el.scrollTop = next;
      onWindowScroll();
    }
  }, [entries, prefix, newestFirst, onWindowScroll]);

  const toggleRow = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const singleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: SINGLE_ROW_PX,
    boxSizing: 'border-box',
    padding: '0 10px',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    overflow: 'hidden',
  };

  const lifecycleRowStyle: React.CSSProperties = {
    ...singleRowStyle,
    color: token.colorTextSecondary,
    fontSize: 12,
  };

  const lifecycleTime = (ts: number | undefined): React.ReactNode =>
    ts !== undefined ? (
      <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
        {formatMessageTime(ts)}
      </span>
    ) : null;

  const renderEntry = (entry: ListEntry): React.ReactNode => {
    switch (entry.kind) {
      case 'sent':
        return (
          <div key={entry.key} data-testid="ws-timeline-sent-row" style={lifecycleRowStyle}>
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.websocket.timeline.connecting')}
            </span>
            {lifecycleTime(lifecycle.startedAt)}
          </div>
        );
      case 'connected':
        return (
          <div key={entry.key} data-testid="ws-timeline-connected-row" style={lifecycleRowStyle}>
            <LinkOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lifecycle.protocol !== undefined && lifecycle.protocol !== ''
                ? t('workbench.editors.websocket.timeline.connectedProtocol', { protocol: lifecycle.protocol })
                : t('workbench.editors.websocket.timeline.connected')}
            </span>
            {lifecycleTime(lifecycle.connectedAt)}
          </div>
        );
      case 'ended': {
        if (lifecycle.endedBy === undefined) return null;
        return (
          <div key={entry.key} data-testid="ws-timeline-ended-row" style={lifecycleRowStyle}>
            {lifecycle.endedBy === 'close' ? (
              <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            ) : (
              <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            )}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endedLabel(lifecycle.endedBy, t)}
              {lifecycle.endedMessage ? ` — ${lifecycle.endedMessage}` : ''}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
          </div>
        );
      }
      case 'waiting':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.websocket.timeline.waiting')}</span>
          </div>
        );
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.websocket.timeline.noMatches')}</span>
          </div>
        );
      case 'row': {
        const item = items[entry.index];
        const up = item.direction === 'up';
        const isExpanded = expanded.has(entry.index);
        const ts = timestamps?.[entry.index];
        const view = derive.viewOf(item);
        const sio = derive.sioOf(item);
        const sioLabel = sio !== null ? sioControlLabel(sio, t) : null;
        const sioEventLike = sio !== null && (sio.kind === 'event' || sio.kind === 'ack') ? sio : null;
        // Decoded payload cell: control frames read as subdued protocol
        // rows; event/ack rows carry their name and correlation id.
        let sioCell: React.ReactNode = null;
        if (sioLabel !== null) {
          sioCell = (
            <span
              style={{
                ...cellFont,
                fontStyle: 'italic',
                color: token.colorTextTertiary,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sioLabel}
            </span>
          );
        } else if (sioEventLike !== null) {
          sioCell = (
            <span
              style={{
                ...cellFont,
                color: token.colorTextSecondary,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <span style={{ color: token.colorText, fontWeight: 600, flexShrink: 0 }} data-testid="ws-sio-event-name">
                {sioEventLike.kind === 'event'
                  ? (sioEventLike.name ?? t('workbench.editors.websocket.timeline.sio.eventNoName'))
                  : t('workbench.editors.websocket.timeline.sio.ack')}
              </span>
              {sioEventLike.ackId !== null && (
                <span style={{ color: token.colorTextTertiary, flexShrink: 0 }} data-testid="ws-sio-ack-id">
                  #{sioEventLike.ackId}
                </span>
              )}
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sioEventLike.kind === 'event'
                  ? sioEventLike.argsPreview
                  : sioEventLike.payloadPretty.replace(/\n\s*/g, ' ')}
              </span>
            </span>
          );
        }
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            data-testid="ws-timeline-message-row"
            onClick={() => toggleRow(entry.index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleRow(entry.index);
              }
            }}
            style={{ ...singleRowStyle, cursor: 'pointer' }}
          >
            {/* Boxed direction badge — ↑ amber, ↓ blue on their tinted
                backgrounds (the gRPC/Postman anatomy). */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 4,
                flexShrink: 0,
                background: up ? token.colorWarningBgHover : token.colorPrimaryBg,
              }}
            >
              {up ? (
                <ArrowUpOutlined
                  aria-label={t('workbench.editors.websocket.timeline.sentAria')}
                  style={{ fontSize: 11, color: token.colorTextSecondary }}
                />
              ) : (
                <ArrowDownOutlined
                  aria-label={t('workbench.editors.websocket.timeline.receivedAria')}
                  style={{ fontSize: 11, color: token.colorTextSecondary }}
                />
              )}
            </span>
            {sioCell ?? (
              <span
                style={{
                  ...cellFont,
                  color: token.colorTextSecondary,
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(view.kind === 'binary' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
                }}
              >
                {view.kind === 'binary'
                  ? t('workbench.editors.websocket.timeline.binaryMessage', { bytes: view.byteLength })
                  : derive.previewOf(item)}
              </span>
            )}
            {ts !== undefined && (
              <span
                data-testid="ws-timeline-message-time"
                style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
              >
                {formatMessageTime(ts)}
              </span>
            )}
          </div>
        );
      }
      case 'viewer': {
        const item = items[entry.index];
        let view = derive.viewOf(item);
        // The expanded viewer of a decoded event/ack shows the payload
        // arguments pretty-printed — the row already names the frame;
        // control frames keep the verbatim wire text.
        const sio = derive.sioOf(item);
        if (sio?.kind === 'event') view = { ...view, kind: 'json', text: sio.payloadPretty };
        else if (sio?.kind === 'ack') view = { ...view, kind: 'json', text: sio.payloadPretty };
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-message-viewer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            style={{ height: VIEWER_PX - 1, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            <CodeEditor
              value={view.text}
              language={view.kind === 'json' ? 'json' : 'text'}
              readOnly
              fill
              variableAutoComplete={false}
              wordWrapOverride={wrapLines ? 'on' : 'off'}
            />
          </div>
        );
      }
      default: {
        const _exhaustive: never = entry;
        void _exhaustive;
        return null;
      }
    }
  };

  const menuOptionLabel = (label: string, checked: boolean): React.ReactNode => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      {label}
      {checked && <CheckOutlined style={{ color: token.colorPrimary }} />}
    </span>
  );

  return (
    <div
      data-testid="ws-message-timeline"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.websocket.timeline.searchMessages')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="ws-timeline-search"
          style={{ maxWidth: 260 }}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.websocket.timeline.messageCount', { count: count - clearedCount })}
        </Text>
        {droppedMessages > 0 && (
          <Text type="warning" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="ws-timeline-dropped">
            {t('workbench.editors.websocket.timeline.dropped', { count: droppedMessages })}
          </Text>
        )}
        <span style={{ marginLeft: 'auto' }} />
        <ConfigProvider theme={{ token: { motion: false } }}>
          <Segmented
            size="small"
            value={directionFilter}
            onChange={(value) => setDirectionFilter(value as DirectionFilter)}
            data-testid="ws-timeline-direction-filter"
            options={[
              { value: 'all', label: t('workbench.editors.websocket.timeline.filterAll') },
              { value: 'up', label: `↑ ${t('workbench.editors.websocket.timeline.filterSent')}` },
              { value: 'down', label: `↓ ${t('workbench.editors.websocket.timeline.filterReceived')}` },
            ]}
          />
        </ConfigProvider>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={sortMenuOpen}
          onOpenChange={(open, info) => {
            if (info.source === 'menu') return;
            setSortMenuOpen(open);
          }}
          menu={{
            items: [
              {
                key: 'newest',
                label: menuOptionLabel(t('workbench.editors.websocket.timeline.newestFirst'), newestFirst),
                onClick: () => setNewestFirst(true),
              },
              {
                key: 'oldest',
                label: menuOptionLabel(t('workbench.editors.websocket.timeline.oldestFirst'), !newestFirst),
                onClick: () => setNewestFirst(false),
              },
            ],
          }}
        >
          <Tooltip
            title={t('workbench.editors.websocket.timeline.sortOrder')}
            placement="bottom"
            open={sortMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              icon={<SortAscendingOutlined />}
              data-testid="ws-timeline-sort"
              aria-label={t('workbench.editors.websocket.timeline.sortOrder')}
            />
          </Tooltip>
        </Dropdown>
        <Tooltip
          title={
            wrapLines
              ? t('workbench.editors.request.response.body.unwrapLines')
              : t('workbench.editors.request.response.body.wrapLines')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={<WrapLinesIcon />}
            onClick={() => setWrapLines((prev) => !prev)}
            aria-label={t('workbench.editors.request.response.body.wrapLines')}
            style={wrapLines ? { background: token.colorBgTextActive } : undefined}
          />
        </Tooltip>
        <Tooltip title={t('workbench.editors.websocket.timeline.clearMessages')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            data-testid="ws-timeline-clear"
            onClick={() => setClearedCount(count)}
            aria-label={t('workbench.editors.websocket.timeline.clearMessages')}
          />
        </Tooltip>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {hasNewMessages && (
          <Button
            size="small"
            type="primary"
            shape="round"
            icon={newestFirst ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            data-testid="ws-timeline-new-messages"
            onClick={() => jumpToNewest(newestFirst)}
            style={{
              position: 'absolute',
              ...(newestFirst ? { top: 8 } : { bottom: 8 }),
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              fontSize: 11,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            {t('workbench.editors.websocket.timeline.newMessages')}
          </Button>
        )}
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const away = newestFirst ? el.scrollTop > 4 : el.scrollHeight - el.scrollTop - el.clientHeight > 4;
            awayFromNewEdgeRef.current = away;
            if (away) {
              const idx = entryIndexAt(prefix, el.scrollTop);
              const entry = entries[idx];
              if (entry) anchorRef.current = { key: entry.key, offset: el.scrollTop - prefix[idx] };
            } else {
              anchorRef.current = null;
              setHasNewMessages(false);
            }
            onWindowScroll();
          }}
          className="rules-thin-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            overscrollBehavior: 'contain',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
          }}
        >
          <div aria-hidden style={{ height: topPadPx }} />
          {entries.slice(start, end).map(renderEntry)}
          <div aria-hidden style={{ height: bottomPadPx }} />
        </div>
      </div>
    </div>
  );
};

export default WsMessageTimeline;

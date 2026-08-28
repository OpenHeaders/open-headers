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
 * "Disconnected / Stopped" sit at the chronological edges (a settled
 * pre-open failure renders its classified error row at the new edge
 * instead), and "Connected" (expandable to the handshake facts as
 * key: value rows) sits before the first message — a WebSocket client
 * cannot write before the handshake settles, so no interleave
 * arithmetic exists (the gRPC `headAtMessage` machinery has no WS
 * twin by construction). Rows read direction glyph · payload preview
 * · right-aligned session time; binary frames render an honest byte
 * label and their base64 in the expanded viewer (payloads verbatim —
 * decode is display-side). WS payloads carry no declared types, so
 * the gRPC list's type chips have no sibling here.
 *
 * Sort and grouping ride the `requests.wsMessages*` SETTINGS (global,
 * toolbar-written — the choices survive Connect/Disconnect remounts),
 * newest-first by default. "Group by direction" and — on the socketio
 * flavor, where names decode — "Group by event" are CLUSTERING, not
 * sorting: rows partition under collapsible headers whose identity
 * composes from the enabled axes (both on = the COMPOUND (event,
 * direction) pair, one header level; named EVENT frames group by
 * name, everything else buckets by its wire-grammar kind). Arrival
 * order stays intact within each group, group order ANCHORS to first
 * appearance, an optional per-group row limit keeps each group's N
 * newest rows watchable (headers keep real totals), and the group
 * spanning the
 * viewport top pins its header as a clickable sticky overlay. Grouped
 * mode is not a timeline, so the Connected row joins "Connecting" at
 * the chronological edge instead of sitting before the first message.
 * Search, direction filter and Clear are display-only — the capture is
 * never touched. Timestamps are session-only (the ratified law):
 * absent rows simply render no time.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  DownOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { WsHandshakeHeaderWire } from '@openheaders/core/bridge';
import type { MessageKey } from '@openheaders/i18n';
import { parseEngineIoFrame, SOCKET_IO_PACKET_TYPES } from '@openheaders/core/socketio';
import type { WebSocketFlavor } from '@openheaders/core/types';
import { decodeBase64Bytes, wsCloseCodePhrase } from '@openheaders/core/utils';
import { Button, ConfigProvider, Dropdown, Input, Segmented, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';
import { wsAutoHeaderDefs } from './ws-auto-headers';

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
/** Line heights of the expanded lifecycle blocks — the lines carry
 *  these explicitly so the virtual window's arithmetic stays exact by
 *  construction: a heading is 18px, a fact row 20px, the block pads
 *  6px top and bottom over a 1px divider. */
const DETAIL_HEADING_PX = 18;
const DETAIL_ROW_PX = 20;
const DETAIL_CHROME_PX = 13;
/** One level of the sheets' outline — every item sits one step under
 *  its heading (Handshake Details, Request Headers, Response Headers
 *  share the top level). */
const DETAIL_INDENT_PX = 12;
/** The caret column every level-0 line reserves — the section heads
 *  draw their caret in it, the heading leaves it blank — so the three
 *  labels share one text column and their items indent from it. */
const DETAIL_CARET_PX = 14;
/** Where the items under a level-0 line start. */
const DETAIL_ITEM_PX = DETAIL_CARET_PX + DETAIL_INDENT_PX;
/** The Disconnected row's block — one detail line. */
const ENDED_DETAIL_PX = DETAIL_ROW_PX + DETAIL_CHROME_PX;

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
export type WsTimelineEndedBy = 'close' | 'stop';

export interface WsTimelineLifecycle {
  /** Session-only Connect-departure time. */
  startedAt?: number;
  /** True once the handshake settled. */
  connected: boolean;
  /** Session-only handshake-settled time. */
  connectedAt?: number;
  /** The handshake facts behind the Connected row's expandable
   *  details — what the platform socket exposes (the negotiated
   *  subprotocol and extensions) and what the executor stamped (the
   *  dialed URL, the request headers it composed), assembled by the
   *  pane; rendered verbatim, absence as absence. */
  handshake?: {
    protocol: string;
    extensions: string;
    url?: string;
    requestHeaders?: readonly WsHandshakeHeaderWire[];
  };
  /** Classified pre-open failure — the session never opened. Rendered
   *  as an error row at the timeline's new edge; never set beside
   *  `endedBy` or `aborted`. */
  errorMessage?: string;
  /** The pre-open end was USER-initiated (Cancel / Stop) — the neutral
   *  "Connection aborted" info row renders at the error row's slot
   *  instead of the error tint. Never set beside `errorMessage` (an
   *  abort carries no message) or `endedBy`. */
  aborted?: true;
  /** Absent while the session is open — the live phase. */
  endedBy?: WsTimelineEndedBy;
  endedAt?: number;
  /** The Close frame behind the Disconnected row's detail line —
   *  code + reason verbatim, `null` when the connection severed
   *  without one; absent on a Stop. */
  close?: { code: number; reason: string } | null;
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
  /** Events-tab listen filter (socketio): incoming EVENT frames whose
   *  decoded name is NOT in this list hide from the display — control
   *  frames, sent frames and nameless events always show, and the
   *  capture is never touched. Absent = no filter. */
  listenedEvents?: readonly string[];
}

/** One group's identity — composed from the ENABLED grouping axes:
 *  the marks a header renders are exactly the non-null fields, and
 *  `key` (also the collapse / un-window / sticky handle) is unique per
 *  axis combination. */
interface WsGroupIdentity {
  key: string;
  direction: 'up' | 'down' | null;
  name: string | null;
}

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. */
type ListEntry =
  | {
      key: string;
      kind: 'sent' | 'connected' | 'handshakeDetail' | 'error' | 'errorDetail' | 'ended' | 'endedDetail' | 'noMatches';
    }
  | { key: string; kind: 'header'; group: WsGroupIdentity; count: number; collapsed: boolean }
  /** "Show N older messages" at a windowed group's older edge; the
   *  un-windowed state's re-window action lives on the group header. */
  | { key: string; kind: 'groupMore'; group: WsGroupIdentity; hidden: number }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number };

type DirectionFilter = 'all' | 'up' | 'down';

/** Stable badge palette for decoded event-name group tags — the same
 *  name always lands on the same color (the SSE badge recipe). */
const EVENT_BADGE_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

function eventBadgeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return EVENT_BADGE_COLORS[hash % EVENT_BADGE_COLORS.length];
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** The upgrade request's HTTP form of a socket URL — what the wire
 *  GET actually named. */
function upgradeRequestUrl(url: string): string {
  return url.replace(/^ws(s?):\/\//i, 'http$1://');
}

/** The Connected row's request-header sheet: the dialing host's
 *  auto-generated set (registry order) with the executor's stamped
 *  rows laid over it by name — a user row that names an auto header
 *  replaces it, the rest append. Values the socket computes and never
 *  exposes stay named as such. */
function handshakeRequestRows(
  handshake: NonNullable<WsTimelineLifecycle['handshake']>,
  t: Translate,
): Array<{ key: string; value: string }> {
  const host = (() => {
    if (handshake.url === undefined) return undefined;
    try {
      return new URL(handshake.url).host;
    } catch {
      return undefined;
    }
  })();
  const rows = wsAutoHeaderDefs().map((def) => ({
    key: def.key,
    value:
      def.value ??
      (def.key === 'Host' && host !== undefined
        ? host
        : def.key === 'Sec-WebSocket-Key'
          ? t('workbench.editors.websocket.timeline.keyGenerated')
          : t('workbench.editors.request.headers.calculated')),
  }));
  for (const stamped of handshake.requestHeaders ?? []) {
    const index = rows.findIndex((r) => r.key.toLowerCase() === stamped.key.toLowerCase());
    if (index === -1) rows.push({ key: stamped.key, value: stamped.value });
    else rows[index] = { key: rows[index].key, value: stamped.value };
  }
  return rows;
}

/** The 101's exposed response headers — the negotiated subprotocol
 *  and extensions are all the platform socket hands back. */
function handshakeResponseRows(
  handshake: NonNullable<WsTimelineLifecycle['handshake']>,
): Array<{ key: string; value: string }> {
  return [
    ...(handshake.protocol !== '' ? [{ key: 'Sec-WebSocket-Protocol', value: handshake.protocol }] : []),
    ...(handshake.extensions !== '' ? [{ key: 'Sec-WebSocket-Extensions', value: handshake.extensions }] : []),
  ];
}

/** Which header sections of the sheets are open — the two heads
 *  toggle independently and both sheets share the state. */
interface HeaderSectionsOpen {
  request: boolean;
  response: boolean;
}

/** Height of the Connected row's expanded block for its row counts
 *  and the open sections. */
function handshakeDetailPx(requestRows: number, responseRows: number, open: HeaderSectionsOpen): number {
  // Heading, three request facts, the two section heads, then each
  // open section's rows (the response section always shows at least
  // the honesty note).
  const lines = 3 + 2 + (open.request ? requestRows : 0) + (open.response ? Math.max(responseRows, 1) : 0);
  return DETAIL_HEADING_PX + lines * DETAIL_ROW_PX + DETAIL_CHROME_PX;
}

/** Height of the error row's expanded block: the error line, then the
 *  attempted handshake (heading, two request facts, the request-header
 *  head and its rows when open) when the session stamped one. */
function errorDetailPx(requestRows: number | null, open: HeaderSectionsOpen): number {
  if (requestRows === null) return DETAIL_ROW_PX + DETAIL_CHROME_PX;
  const handshakeLines = 2 + 1 + (open.request ? requestRows : 0);
  return DETAIL_ROW_PX + DETAIL_HEADING_PX + handshakeLines * DETAIL_ROW_PX + DETAIL_CHROME_PX;
}

/** Lifecycle label for how the session ended — naming the peer when
 *  the session stamped its URL. */
function endedLabel(endedBy: WsTimelineEndedBy, url: string | undefined, t: Translate): string {
  switch (endedBy) {
    case 'close':
      return url !== undefined
        ? t('workbench.editors.websocket.timeline.disconnectedFrom', { url })
        : t('workbench.editors.websocket.timeline.disconnected');
    case 'stop':
      return t('workbench.editors.websocket.timeline.stopped');
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
  listenedEvents,
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
  const [handshakeExpanded, setHandshakeExpanded] = useState(false);
  // The Disconnected row opens on its detail line by default — one
  // line, the close verdict the user came to read; the error row opens
  // on the failure and the handshake it attempted.
  const [endedExpanded, setEndedExpanded] = useState(true);
  const [errorExpanded, setErrorExpanded] = useState(true);
  const [sectionsOpen, setSectionsOpen] = useState<HeaderSectionsOpen>({ request: true, response: true });
  const toggleSection = (section: keyof HeaderSectionsOpen) =>
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  const [wrapLines, setWrapLines] = useState(true);
  // Sort direction and grouping are SETTINGS — global, user-owned,
  // written by this toolbar and the Settings page alike; a Connect/
  // Disconnect remount never resets them.
  const [newestFirst, setNewestFirst] = useSetting('requests.wsMessagesNewestFirst');
  const [groupByDirection, setGroupByDirection] = useSetting('requests.wsMessagesGroupByDirection');
  // The second grouping axis — the decoded Socket.IO event name. Only
  // the socketio flavor decodes names, so the axis (and its menu item)
  // exists there alone; both axes on = COMPOUND (event, direction)
  // group identity, still one header level.
  const [groupByEvent, setGroupByEvent] = useSetting('requests.wsMessagesGroupByEvent');
  // Watch-both-groups-at-once: each group shows only its N newest
  // rows (the window slides as messages arrive); 0 = no limit.
  const [groupRowLimit, setGroupRowLimit] = useSetting('requests.wsMessagesGroupRowLimit');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // Per-group escape hatch from the row-limit window — display-local
  // (like collapse), so lifting one group's window never touches the
  // global setting or the other group.
  const [unwindowedGroups, setUnwindowedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // The group whose rows span the viewport top — its header pins as an
  // overlay (a CSS-sticky header would virtualize out of the DOM), so
  // the group identity + total stay visible and collapsible mid-scroll.
  const [stickyGroup, setStickyGroup] = useState<string | null>(null);
  // Right inset for the sticky overlay — measured scrollbar width (+
  // the scroller's border), so the overlay never covers the thumb.
  const [stickyRightInset, setStickyRightInset] = useState(1);

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
    setHandshakeExpanded(false);
    setCollapsedGroups(new Set<string>());
    setUnwindowedGroups(new Set<string>());
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
  const listenedSet = useMemo(
    () => (listenedEvents !== undefined ? new Set(listenedEvents) : null),
    [listenedEvents],
  );

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: number[] = [];
    for (let i = clearedCount; i < count; i++) {
      const item = items[i];
      if (directionFilter !== 'all' && item.direction !== directionFilter) continue;
      // Events-tab listen filter — named incoming events only; control
      // frames, sent frames and nameless events always show.
      if (listenedSet !== null && item.direction === 'down') {
        const sio = derive.sioOf(item);
        if (sio?.kind === 'event' && sio.name !== null && !listenedSet.has(sio.name)) continue;
      }
      if (needle !== '' && !derive.previewOf(item).toLowerCase().includes(needle)) continue;
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, search, directionFilter, listenedSet, derive]);

  const displayRows = useMemo(
    () => (newestFirst ? [...visibleRows].reverse() : visibleRows),
    [visibleRows, newestFirst],
  );

  // The event-name axis exists only where names decode — the socketio
  // flavor; a raw session ignores the persisted toggle entirely.
  const groupByEventActive = groupByEvent && flavor === 'socketio';

  // Partition the display rows under group headers — identity composed
  // from the ENABLED axes (direction, decoded event name, or the
  // compound pair). Named EVENT frames group by their name; everything
  // else buckets by its wire-grammar kind (ping, pong, ack, connect,
  // …; 'message' for undecodable/raw frames) — untranslated, the SSE
  // precedent. Group order ANCHORS to each identity's first appearance
  // in the log — a group never trades places once minted. The sort
  // direction flips the reading of that fixed order, and rows within a
  // group keep the arrival order.
  const groups = useMemo(() => {
    if (!groupByDirection && !groupByEventActive) return null;
    const eventNameOf = (item: WsTimelineItem): string => {
      const sio = derive.sioOf(item);
      if (sio === null) return 'message';
      switch (sio.kind) {
        case 'event':
          return sio.name ?? 'event';
        case 'ack':
          return 'ack';
        case 'ping':
          return 'ping';
        case 'pong':
          return 'pong';
        case 'engineOpen':
          return 'open';
        case 'engineClose':
          return 'close';
        case 'connect':
        case 'connectAck':
          return 'connect';
        case 'connectError':
          return 'connect_error';
        case 'disconnect':
          return 'disconnect';
        case 'binaryAttachments':
          return 'binary';
        default: {
          const _exhaustive: never = sio;
          void _exhaustive;
          return 'message';
        }
      }
    };
    const identityOf = (item: WsTimelineItem): WsGroupIdentity => {
      const name = groupByEventActive ? eventNameOf(item) : null;
      const direction = groupByDirection ? item.direction : null;
      const key =
        direction !== null && name !== null ? `${direction}:${name}` : direction !== null ? direction : `e:${name}`;
      return { key, direction, name };
    };
    const firstSeen = new Map<string, number>();
    for (let i = clearedCount; i < count; i++) {
      const key = identityOf(items[i]).key;
      if (!firstSeen.has(key)) firstSeen.set(key, i);
    }
    const byKey = new Map<string, { identity: WsGroupIdentity; indexes: number[] }>();
    for (const index of displayRows) {
      const identity = identityOf(items[index]);
      const bucket = byKey.get(identity.key);
      if (bucket) bucket.indexes.push(index);
      else byKey.set(identity.key, { identity, indexes: [index] });
    }
    const anchored = [...byKey.values()].sort(
      (a, b) => (firstSeen.get(a.identity.key) ?? 0) - (firstSeen.get(b.identity.key) ?? 0),
    );
    return newestFirst ? anchored.reverse() : anchored;
  }, [displayRows, groupByDirection, groupByEventActive, items, count, clearedCount, newestFirst, derive]);

  const filtering = search.trim() !== '' || directionFilter !== 'all';
  const live = lifecycle.endedBy === undefined && lifecycle.errorMessage === undefined && lifecycle.aborted !== true;

  // The flat display list the virtual window runs over — ONE event
  // log: Connecting at one chronological edge, Connected before the
  // first message (no interleave arithmetic — the client cannot write
  // pre-handshake), the ended row at the other edge. Grouped mode is
  // clustering, not a timeline, so the Connected row joins Connecting
  // at the chronological edge instead. Waiting/no-match notices sit at
  // the edge new rows land on; each group's entry-index range feeds
  // the sticky header.
  const { entries, groupRanges } = useMemo(() => {
    const out: ListEntry[] = [];
    const ranges: Array<{ key: string; startEntry: number; endEntry: number }> = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const pushConnected = () => {
      out.push({ key: 'connected', kind: 'connected' });
      // The details block always sits directly under its row — the
      // expanded message-viewer discipline, both sort orders.
      if (handshakeExpanded && lifecycle.handshake !== undefined) {
        out.push({ key: 'handshakeDetail', kind: 'handshakeDetail' });
      }
    };
    const pushEnded = () => {
      out.push({ key: 'ended', kind: 'ended' });
      if (endedExpanded) out.push({ key: 'endedDetail', kind: 'endedDetail' });
    };
    const notice: ListEntry | null =
      filtering && visibleRows.length === 0 && count > clearedCount ? { key: 'none', kind: 'noMatches' } : null;

    // The error/aborted row sits at the ended row's chronological slot
    // — the two never coexist (a pre-open end has no opened-session
    // end).
    const preOpenEnd = lifecycle.errorMessage !== undefined || lifecycle.aborted === true;
    const pushError = () => {
      out.push({ key: 'error', kind: 'error' });
      if (errorExpanded && lifecycle.errorMessage !== undefined) out.push({ key: 'errorDetail', kind: 'errorDetail' });
    };

    // Top chronological edge.
    if (newestFirst) {
      if (lifecycle.endedBy !== undefined) pushEnded();
      if (preOpenEnd) pushError();
      if (notice) out.push(notice);
    } else {
      out.push({ key: 'sent', kind: 'sent' });
      if (groups !== null && lifecycle.connected) pushConnected();
    }

    if (groups !== null) {
      for (const { identity, indexes } of groups) {
        const startEntry = out.length;
        const collapsed = collapsedGroups.has(identity.key);
        out.push({ key: `h${identity.key}`, kind: 'header', group: identity, count: indexes.length, collapsed });
        if (!collapsed) {
          // displayRows order puts a group's newest member first in
          // newest-first and last in oldest-first — the limit window
          // slices the newest end either way. A group the user
          // un-windowed shows everything, with a re-window toggle in
          // the same slot the "show older" affordance occupies.
          const windowed = groupRowLimit > 0 && !unwindowedGroups.has(identity.key) && indexes.length > groupRowLimit;
          const shown = windowed
            ? newestFirst
              ? indexes.slice(0, groupRowLimit)
              : indexes.slice(-groupRowLimit)
            : indexes;
          const more: ListEntry | null = windowed
            ? { key: `m${identity.key}`, kind: 'groupMore', group: identity, hidden: indexes.length - shown.length }
            : null;
          // The toggle sits at the group's OLDER edge — where the
          // hidden rows would continue: below the shown tail in
          // newest-first, right under the header in oldest-first.
          if (!newestFirst && more) out.push(more);
          for (const index of shown) pushRow(index);
          if (newestFirst && more) out.push(more);
        }
        ranges.push({ key: identity.key, startEntry, endEntry: out.length });
      }
    } else {
      const tokens: Array<number | 'connected'> = [];
      if (lifecycle.connected) tokens.push('connected');
      for (const index of visibleRows) tokens.push(index);
      if (newestFirst) tokens.reverse();
      for (const token of tokens) {
        if (token === 'connected') pushConnected();
        else pushRow(token);
      }
    }

    // Bottom chronological edge.
    if (newestFirst) {
      if (groups !== null && lifecycle.connected) pushConnected();
      out.push({ key: 'sent', kind: 'sent' });
    } else {
      if (notice) out.push(notice);
      if (preOpenEnd) pushError();
      if (lifecycle.endedBy !== undefined) pushEnded();
    }
    return { entries: out, groupRanges: ranges };
  }, [
    newestFirst,
    lifecycle.connected,
    lifecycle.handshake,
    lifecycle.errorMessage,
    lifecycle.aborted,
    lifecycle.endedBy,
    live,
    count,
    clearedCount,
    filtering,
    visibleRows,
    groups,
    expanded,
    handshakeExpanded,
    endedExpanded,
    errorExpanded,
    collapsedGroups,
    groupRowLimit,
    unwindowedGroups,
  ]);

  // The handshake sheet's rows — computed once per handshake so the
  // block's height and its render agree by construction.
  const handshakeSheet = useMemo(() => {
    const handshake = lifecycle.handshake;
    if (handshake === undefined) return null;
    const requestRows = handshakeRequestRows(handshake, t);
    const responseRows = handshakeResponseRows(handshake);
    return {
      requestRows,
      responseRows,
      heightPx: handshakeDetailPx(requestRows.length, responseRows.length, sectionsOpen),
    };
  }, [lifecycle.handshake, t, sectionsOpen]);

  const heights = useMemo(
    () =>
      entries.map((e) =>
        e.kind === 'viewer'
          ? VIEWER_PX
          : e.kind === 'handshakeDetail'
            ? (handshakeSheet?.heightPx ?? 0)
            : e.kind === 'endedDetail'
              ? ENDED_DETAIL_PX
              : e.kind === 'errorDetail'
                ? errorDetailPx(handshakeSheet?.requestRows.length ?? null, sectionsOpen)
                : SINGLE_ROW_PX,
      ),
    [entries, handshakeSheet, sectionsOpen],
  );

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

  // Which group's rows span the viewport top — its header pins as the
  // sticky overlay. Recomputed on scroll and after list mutations;
  // meaningless (null) on an unlaid-out viewport.
  const updateStickyGroup = (el: HTMLElement) => {
    if (el.clientHeight === 0 || groupRanges.length === 0) {
      setStickyGroup(null);
      return;
    }
    // offsetWidth − clientWidth = both borders + the vertical
    // scrollbar; the overlay already sits 1px in for the left border.
    setStickyRightInset(Math.max(1, el.offsetWidth - el.clientWidth - 1));
    const idx = entryIndexAt(prefix, el.scrollTop);
    const range = groupRanges.find((r) => idx >= r.startEntry && idx < r.endEntry);
    setStickyGroup(range ? range.key : null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateStickyGroup derives from entries/prefix, which ARE the deps.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) updateStickyGroup(el);
  }, [entries, prefix]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupWindow = (key: string) => {
    setUnwindowedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Trailing expand slot — fixed width on EVERY row so the
  // right-aligned timestamps line up in one column; expandable rows
  // render their chevron in it, the rest leave it empty.
  const expandSlot = (expanded: boolean | null): React.ReactNode => (
    <span
      aria-hidden
      style={{ width: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {expanded !== null &&
        (expanded ? (
          <UpOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        ) : (
          <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        ))}
    </span>
  );

  // Boxed direction badge — ↑ amber, ↓ blue on their tinted
  // backgrounds (the gRPC list's anatomy), shared by message rows and
  // group headers so the two directions read apart at a glance.
  const directionBadge = (up: boolean): React.ReactNode => (
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
  );

  /** One group-header row — shared by the in-list entry and the sticky
   *  overlay (same anatomy, same collapse action, distinct testid).
   *  The marks are the identity's enabled axes: direction badge +
   *  Sent/Received label, decoded event-name tag, or both (the
   *  compound grouping). */
  const renderGroupHeaderRow = (
    group: WsGroupIdentity,
    memberCount: number,
    collapsed: boolean,
    testid: string,
    key?: string,
  ): React.ReactNode => (
    <div
      key={key}
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      data-testid={testid}
      onClick={() => toggleGroup(group.key)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleGroup(group.key);
        }
      }}
      style={{ ...singleRowStyle, background: token.colorFillQuaternary, cursor: 'pointer' }}
    >
      <CaretRightOutlined
        aria-hidden
        rotate={collapsed ? 0 : 90}
        style={{ fontSize: 10, color: token.colorTextTertiary }}
      />
      {group.direction !== null && (
        <>
          {directionBadge(group.direction === 'up')}
          <Text strong style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            {group.direction === 'up'
              ? t('workbench.editors.websocket.timeline.filterSent')
              : t('workbench.editors.websocket.timeline.filterReceived')}
          </Text>
        </>
      )}
      {group.name !== null && (
        <Tag
          data-testid="ws-timeline-group-badge"
          color={eventBadgeColor(group.name)}
          style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0 }}
        >
          {group.name}
        </Tag>
      )}
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.websocket.timeline.messageCount', { count: memberCount })}
      </Text>
      {/* Re-window action for an un-windowed group — a group-level
          mode switch, so it rides the header (beside the total, past a
          divider) rather than a positional row. Clicks stay off the
          header's collapse action. */}
      {!collapsed && groupRowLimit > 0 && unwindowedGroups.has(group.key) && memberCount > groupRowLimit && (
        <>
          <span aria-hidden style={{ width: 1, height: 14, background: token.colorBorderSecondary }} />
          <span
            role="button"
            tabIndex={0}
            data-testid="ws-timeline-group-rewindow"
            onClick={(event) => {
              event.stopPropagation();
              toggleGroupWindow(group.key);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                toggleGroupWindow(group.key);
              }
            }}
            style={{ fontSize: 11, color: token.colorPrimary, whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            {t('shared.timelineGroup.showNewestOnly', { count: groupRowLimit })}
          </span>
        </>
      )}
    </div>
  );

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
            {expandSlot(null)}
          </div>
        );
      case 'connected': {
        const expandable = lifecycle.handshake !== undefined;
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-connected-row"
            {...(expandable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-expanded': handshakeExpanded,
                  className: 'oh-stream-row',
                  onClick: () => setHandshakeExpanded((prev) => !prev),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setHandshakeExpanded((prev) => !prev);
                    }
                  },
                }
              : {})}
            style={{ ...lifecycleRowStyle, ...(expandable ? { cursor: 'pointer' } : {}) }}
          >
            <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorSuccess }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lifecycle.handshake?.url !== undefined
                ? t('workbench.editors.websocket.timeline.connectedTo', { url: lifecycle.handshake.url })
                : t('workbench.editors.websocket.timeline.connected')}
            </span>
            {lifecycleTime(lifecycle.connectedAt)}
            {expandSlot(expandable ? handshakeExpanded : null)}
          </div>
        );
      }
      case 'handshakeDetail': {
        const handshake = lifecycle.handshake;
        if (handshake === undefined || handshakeSheet === null) return null;
        // The reference sheet: the upgrade request's facts, then the
        // request headers as composed and the 101's exposed answers —
        // values verbatim, absence named as the absence it is.
        const lineStyle: React.CSSProperties = {
          ...cellFont,
          lineHeight: `${DETAIL_ROW_PX}px`,
          height: DETAIL_ROW_PX,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        };
        const factRow = (label: string, value: string, indent = 0): React.ReactNode => (
          <div key={`${indent}:${label}`} style={{ ...lineStyle, paddingLeft: indent }}>
            <span style={{ color: token.colorTextSecondary }}>{label}: </span>
            <span style={{ color: token.colorInfoText }}>"{value}"</span>
          </div>
        );
        const sectionRow = (section: keyof HeaderSectionsOpen, label: string): React.ReactNode => (
          <div
            key={section}
            role="button"
            tabIndex={0}
            aria-expanded={sectionsOpen[section]}
            data-testid={`ws-timeline-${section}-headers-head`}
            onClick={() => toggleSection(section)}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleSection(section);
              }
            }}
            style={{ ...lineStyle, color: token.colorTextTertiary, cursor: 'pointer' }}
          >
            <span style={{ display: 'inline-block', width: DETAIL_CARET_PX }}>
              {sectionsOpen[section] ? '▾' : '▸'}
            </span>
            {label}
          </div>
        );
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-handshake-details"
            style={{
              height: handshakeSheet.heightPx,
              boxSizing: 'border-box',
              padding: '6px 10px 6px 37px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                lineHeight: `${DETAIL_HEADING_PX}px`,
                height: DETAIL_HEADING_PX,
                paddingLeft: DETAIL_CARET_PX,
                color: token.colorTextTertiary,
              }}
            >
              {t('workbench.editors.websocket.timeline.handshakeDetails')}
            </div>
            {factRow(
              t('workbench.editors.websocket.timeline.requestUrl'),
              handshake.url !== undefined ? upgradeRequestUrl(handshake.url) : '',
              DETAIL_ITEM_PX,
            )}
            {factRow(t('workbench.editors.websocket.timeline.requestMethod'), 'GET', DETAIL_ITEM_PX)}
            {factRow(t('workbench.editors.websocket.timeline.statusCode'), '101 Switching Protocols', DETAIL_ITEM_PX)}
            {sectionRow('request', t('workbench.editors.websocket.timeline.requestHeaders'))}
            {sectionsOpen.request &&
              handshakeSheet.requestRows.map((row) => factRow(row.key, row.value, DETAIL_ITEM_PX))}
            {sectionRow('response', t('workbench.editors.websocket.timeline.responseHeaders'))}
            {sectionsOpen.response &&
              (handshakeSheet.responseRows.length > 0 ? (
                handshakeSheet.responseRows.map((row) => factRow(row.key, row.value, DETAIL_ITEM_PX))
              ) : (
                <div style={{ ...lineStyle, paddingLeft: DETAIL_ITEM_PX, color: token.colorTextTertiary }}>
                  {t('workbench.editors.websocket.session.handshakeNote')}
                </div>
              ))}
          </div>
        );
      }
      case 'error': {
        // A user abort is not a failure — the neutral info row.
        if (lifecycle.aborted === true) {
          return (
            <div key={entry.key} data-testid="ws-timeline-aborted-row" style={lifecycleRowStyle}>
              <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('workbench.editors.websocket.timeline.aborted')}
              </span>
              {lifecycleTime(lifecycle.endedAt)}
              {expandSlot(null)}
            </div>
          );
        }
        if (lifecycle.errorMessage === undefined) return null;
        const url = lifecycle.handshake?.url;
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-error-row"
            role="button"
            tabIndex={0}
            aria-expanded={errorExpanded}
            className="oh-stream-row"
            onClick={() => setErrorExpanded((prev) => !prev)}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setErrorExpanded((prev) => !prev);
              }
            }}
            style={{ ...lifecycleRowStyle, cursor: 'pointer' }}
          >
            <CloseCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorError }} />
            <span
              title={url !== undefined ? undefined : lifecycle.errorMessage}
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: token.colorError,
              }}
            >
              {url !== undefined
                ? t('workbench.editors.websocket.timeline.couldNotConnect', { url })
                : lifecycle.errorMessage}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
            {expandSlot(errorExpanded)}
          </div>
        );
      }
      case 'errorDetail': {
        if (lifecycle.errorMessage === undefined) return null;
        const handshake = lifecycle.handshake;
        const lineStyle: React.CSSProperties = {
          ...cellFont,
          lineHeight: `${DETAIL_ROW_PX}px`,
          height: DETAIL_ROW_PX,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        };
        const factRow = (label: string, value: string, indent = 0): React.ReactNode => (
          <div key={`${indent}:${label}`} style={{ ...lineStyle, paddingLeft: indent }}>
            <span style={{ color: token.colorTextSecondary }}>{label}: </span>
            <span style={{ color: token.colorInfoText }}>"{value}"</span>
          </div>
        );
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-error-details"
            style={{
              height: errorDetailPx(handshakeSheet?.requestRows.length ?? null, sectionsOpen),
              boxSizing: 'border-box',
              padding: '6px 10px 6px 37px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{ fontSize: 12, lineHeight: `${DETAIL_ROW_PX}px`, height: DETAIL_ROW_PX, whiteSpace: 'nowrap' }}
            >
              <span style={{ fontWeight: 600, color: token.colorText }}>
                {t('workbench.editors.websocket.timeline.errorLabel')}:{' '}
              </span>
              <span data-testid="ws-session-error-detail" style={{ color: token.colorTextSecondary }}>
                {lifecycle.errorMessage}
              </span>
            </div>
            {handshake !== undefined && handshakeSheet !== null && (
              <>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: `${DETAIL_HEADING_PX}px`,
                    height: DETAIL_HEADING_PX,
                    paddingLeft: DETAIL_CARET_PX,
                    color: token.colorTextTertiary,
                  }}
                >
                  {t('workbench.editors.websocket.timeline.handshakeDetails')}
                </div>
                {factRow(
                  t('workbench.editors.websocket.timeline.requestUrl'),
                  handshake.url !== undefined ? upgradeRequestUrl(handshake.url) : '',
                  DETAIL_ITEM_PX,
                )}
                {factRow(t('workbench.editors.websocket.timeline.requestMethod'), 'GET', DETAIL_ITEM_PX)}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={sectionsOpen.request}
                  data-testid="ws-timeline-request-headers-head"
                  onClick={() => toggleSection('request')}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleSection('request');
                    }
                  }}
                  style={{ ...lineStyle, color: token.colorTextTertiary, cursor: 'pointer' }}
                >
                  <span style={{ display: 'inline-block', width: DETAIL_CARET_PX }}>
                    {sectionsOpen.request ? '▾' : '▸'}
                  </span>
                  {t('workbench.editors.websocket.timeline.requestHeaders')}
                </div>
                {sectionsOpen.request &&
                  handshakeSheet.requestRows.map((row) => factRow(row.key, row.value, DETAIL_ITEM_PX))}
              </>
            )}
          </div>
        );
      }
      case 'ended': {
        if (lifecycle.endedBy === undefined) return null;
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-ended-row"
            role="button"
            tabIndex={0}
            aria-expanded={endedExpanded}
            className="oh-stream-row"
            onClick={() => setEndedExpanded((prev) => !prev)}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setEndedExpanded((prev) => !prev);
              }
            }}
            style={{ ...lifecycleRowStyle, cursor: 'pointer' }}
          >
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endedLabel(lifecycle.endedBy, lifecycle.handshake?.url, t)}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
            {expandSlot(endedExpanded)}
          </div>
        );
      }
      case 'endedDetail': {
        if (lifecycle.endedBy === undefined) return null;
        // The close verdict: the code with its registry phrase in bold,
        // then the server's reason verbatim or the code's meaning; a
        // severed connection and a Stop say what they are.
        let lead = '';
        let detail: string;
        if (lifecycle.endedBy === 'stop') {
          detail = t('workbench.editors.websocket.timeline.stoppedDetail');
        } else if (lifecycle.close === null || lifecycle.close === undefined) {
          detail = t('workbench.editors.websocket.session.noCloseFrame');
        } else {
          const phrase = wsCloseCodePhrase(lifecycle.close.code);
          lead = phrase !== null ? `${lifecycle.close.code} ${phrase}:` : `${lifecycle.close.code}:`;
          detail =
            lifecycle.close.reason !== ''
              ? lifecycle.close.reason
              : phrase !== null
                ? t(`workbench.editors.websocket.timeline.closeCode.${lifecycle.close.code}` as MessageKey)
                : t('workbench.editors.websocket.timeline.closeCode.unknown');
        }
        return (
          <div
            key={entry.key}
            data-testid="ws-timeline-ended-details"
            style={{
              height: ENDED_DETAIL_PX,
              boxSizing: 'border-box',
              padding: '6px 10px 6px 37px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
              fontSize: 12,
              lineHeight: `${DETAIL_ROW_PX}px`,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {lead !== '' && <span style={{ fontWeight: 600, color: token.colorText }}>{lead} </span>}
            <span style={{ color: token.colorTextSecondary }}>{detail}</span>
          </div>
        );
      }
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.websocket.timeline.noMatches')}</span>
          </div>
        );
      case 'header':
        return renderGroupHeaderRow(entry.group, entry.count, entry.collapsed, 'ws-timeline-group-header', entry.key);
      case 'groupMore':
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            className="oh-stream-row"
            data-testid="ws-timeline-group-more"
            onClick={() => toggleGroupWindow(entry.group.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleGroupWindow(entry.group.key);
              }
            }}
            style={{ ...singleRowStyle, cursor: 'pointer', fontSize: 12, color: token.colorPrimary }}
          >
            {t('shared.timelineGroup.showOlder', { count: entry.hidden })}
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
            className="oh-stream-row"
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
            {directionBadge(up)}
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
            {expandSlot(isExpanded)}
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
              { type: 'divider' },
              {
                key: 'group',
                label: menuOptionLabel(t('workbench.editors.websocket.timeline.groupByDirection'), groupByDirection),
                onClick: () => setGroupByDirection(!groupByDirection),
              },
              ...(flavor === 'socketio'
                ? [
                    {
                      key: 'group-event',
                      label: menuOptionLabel(t('workbench.editors.websocket.timeline.groupByEvent'), groupByEvent),
                      onClick: () => setGroupByEvent(!groupByEvent),
                    },
                  ]
                : []),
              {
                key: 'group-limit',
                label: t('workbench.editors.websocket.timeline.rowsPerGroup'),
                disabled: !groupByDirection && !groupByEventActive,
                children: [0, 1, 3, 5, 10].map((n) => ({
                  key: `group-limit-${n}`,
                  label: menuOptionLabel(
                    n === 0 ? t('workbench.editors.websocket.timeline.noLimit') : String(n),
                    groupRowLimit === n,
                  ),
                  onClick: () => setGroupRowLimit(n),
                })),
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
        {stickyGroup !== null && groups !== null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 1,
              right: stickyRightInset,
              zIndex: 1,
              background: token.colorBgContainer,
              borderTopLeftRadius: 4,
              overflow: 'hidden',
            }}
          >
            {(() => {
              const source = groups.find((g) => g.identity.key === stickyGroup);
              return source !== undefined
                ? renderGroupHeaderRow(
                    source.identity,
                    source.indexes.length,
                    collapsedGroups.has(source.identity.key),
                    'ws-timeline-sticky-header',
                  )
                : null;
            })()}
          </div>
        )}
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
            updateStickyGroup(el);
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

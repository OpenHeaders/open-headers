/**
 * MqttMessageTimeline — the message-list surface for MQTT sessions,
 * ONE list across both phases: live (fed from `mqttStreamEvent` items
 * while the session is open) and materialized (fed from the snapshot's
 * event capture, session timestamps joined positionally). A SIBLING of
 * the SSE / gRPC / WS lists on the same shared recipes —
 * `useVirtualRowWindow`, pinned row heights, append-only item
 * identity, jump pill, identity scroll anchor — never a
 * parameterization of any (the ratified sibling law).
 *
 * The timeline is ONE event log in packet order: "Connecting" and
 * "Disconnected / Stopped" sit at the chronological edges, "Connected"
 * (expandable to the CONNACK facts as key: value rows) sits before the
 * first item, and the
 * subscription lifecycle facts — Subscribed-with-grant /
 * Unsubscribed — render at their TRUE chronological positions because
 * they ride the same item log as the messages (live Subscribe toggles
 * land mid-session). Message rows read direction glyph · topic chip
 * (color DERIVED from the topic string — display-side, never stored) ·
 * QoS / Retained / DUP tags · payload preview · byte count ·
 * right-aligned session time; payloads that do not decode as text
 * render an honest byte label with their base64 in the expanded viewer
 * (payloads verbatim — decode is display-side).
 *
 * Sort rides the `requests.mqttMessagesNewestFirst` SETTING (global,
 * toolbar-written — the choice survives Connect/Disconnect remounts).
 * Search, the direction filter, the TOPIC filter and Clear are
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
  DownOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { Button, ConfigProvider, Dropdown, Input, Segmented, Select, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import { grantLabel } from './session-display';
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
/** Pinned height of the Connected row's expanded CONNACK block —
 *  heading (18px) + four fact rows (20px each) + 6px paddings + 1px
 *  divider; the lines carry these heights explicitly so the virtual
 *  window's arithmetic stays exact by construction. */
const CONNACK_DETAIL_PX = 111;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** One timeline item — the live wire item and the snapshot event share
 *  this shape (atMs rides only the live one; materialized times join
 *  via `timestamps`). */
export type MqttTimelineItem =
  | {
      kind: 'message';
      direction: 'up' | 'down';
      topic: string;
      payloadBase64: string;
      qos: 0 | 1 | 2;
      retain: boolean;
      dup: boolean;
    }
  | { kind: 'subscribed'; grants: Array<{ topicFilter: string; reasonCode: number }> }
  | { kind: 'unsubscribed'; topicFilters: string[] };

/** How the session ended — drives the ended lifecycle row. */
export type MqttTimelineEndedBy = 'close' | 'stop';

export interface MqttTimelineLifecycle {
  /** Session-only Connect-departure time. */
  startedAt?: number;
  /** True once the CONNACK accepted. */
  connected: boolean;
  /** Session-only CONNACK-accepted time. */
  connectedAt?: number;
  /** The CONNACK facts behind the Connected row's expandable details —
   *  assembled by the pane (the version knob scopes which numeric
   *  space names the code); rendered verbatim as key: value rows.
   *  `remainingLength` is the frame's Remaining Length as observed on
   *  the wire — absent on captures that predate the fact, rendered as
   *  the absence it is. */
  connack?: { reasonCode: number; reasonName?: string; sessionPresent: boolean; remainingLength?: number };
  /** Absent while the session is open — the live phase. */
  endedBy?: MqttTimelineEndedBy;
  endedAt?: number;
  /** The end detail riding the ended row — the clean Disconnect, the
   *  broker's verbatim reason, or the severed-connection note.
   *  Assembled by the pane; rendered verbatim. */
  endedMessage?: string;
}

interface MqttMessageTimelineProps {
  /** Item log — append-only during the live phase (the array reference
   *  stays stable; `count` is the committed prefix), the snapshot's
   *  capture once materialized. */
  items: readonly MqttTimelineItem[];
  count: number;
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[];
  lifecycle: MqttTimelineLifecycle;
  /** Events that rolled off the retention window — an honest notice
   *  above the list when non-zero. */
  droppedMessages?: number;
}

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. */
type ListEntry =
  | { key: string; kind: 'sent' | 'connected' | 'connackDetail' | 'ended' | 'waiting' | 'noMatches' }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number };

type DirectionFilter = 'all' | 'up' | 'down';

/** Stable per-topic chip palette — the same topic always lands on the
 *  same color (DISPLAY-derived from the string, never stored). */
const TOPIC_BADGE_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

function topicBadgeColor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = (hash * 31 + topic.charCodeAt(i)) >>> 0;
  return TOPIC_BADGE_COLORS[hash % TOPIC_BADGE_COLORS.length];
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
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

/** A message's display view — text payloads decode display-side (json
 *  highlighting when the payload parses), binary payloads stay base64
 *  (the wire carries no text/binary marker, so the split is an honest
 *  display heuristic over the decoded bytes). */
export interface MqttMessageView {
  kind: 'text' | 'json' | 'binary';
  /** Decoded text (text/json) or the base64 payload (binary). */
  text: string;
  byteLength: number;
}

/** Control characters outside \t \n \r mark a payload as binary for
 *  DISPLAY — so does a UTF-8 decode that needed replacement chars. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the binary display heuristic inspects control bytes by design.
const BINARY_MARKS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

/** Per-item view/preview caches — item identity is append-only, so a
 *  WeakMap never serves a stale decode. */
function makeMqttFrameDerivations(): {
  viewOf: (item: MqttTimelineItem & { kind: 'message' }) => MqttMessageView;
  previewOf: (item: MqttTimelineItem & { kind: 'message' }) => string;
} {
  const viewCache = new WeakMap<MqttTimelineItem, MqttMessageView>();
  const previewCache = new WeakMap<MqttTimelineItem, string>();
  const viewOf = (item: MqttTimelineItem & { kind: 'message' }): MqttMessageView => {
    const hit = viewCache.get(item);
    if (hit !== undefined) return hit;
    // A malformed payload string decodes to nothing — the row still
    // renders (empty text / zero bytes) rather than throwing.
    const bytes = decodeBase64Bytes(item.payloadBase64) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(bytes);
    let view: MqttMessageView;
    if (BINARY_MARKS.test(text)) {
      view = { kind: 'binary', text: item.payloadBase64, byteLength: bytes.byteLength };
    } else {
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
  const previewOf = (item: MqttTimelineItem & { kind: 'message' }): string => {
    const hit = previewCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const preview = view.kind === 'binary' ? '' : view.text.replace(/\n\s*/g, ' ').slice(0, PREVIEW_MAX_CHARS);
    previewCache.set(item, preview);
    return preview;
  };
  return { viewOf, previewOf };
}

const MqttMessageTimeline: React.FC<MqttMessageTimelineProps> = ({
  items,
  count,
  timestamps,
  lifecycle,
  droppedMessages = 0,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [connackExpanded, setConnackExpanded] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  // Sort direction is a SETTING — global, user-owned, written by this
  // toolbar and the Settings page alike; a Connect/Disconnect remount
  // never resets it.
  const [newestFirst, setNewestFirst] = useSetting('requests.mqttMessagesNewestFirst');

  const derive = useMemo(() => makeMqttFrameDerivations(), []);

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

  // A new item log (new session, materialized snapshot) resets the
  // display state — indexes are positional in the log they were
  // minted against.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items identity IS the reset signal.
  useEffect(() => {
    setSearch('');
    setDirectionFilter('all');
    setTopicFilter(null);
    setClearedCount(0);
    setExpanded(new Set<number>());
    setConnackExpanded(false);
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

  // The TOPIC filter's option set — every distinct topic the log has
  // seen, in first-appearance order (display-side; never stored).
  const seenTopics = useMemo(() => {
    const topics: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const item = items[i];
      if (item.kind !== 'message' || seen.has(item.topic)) continue;
      seen.add(item.topic);
      topics.push(item.topic);
    }
    return topics;
  }, [items, count]);

  // Every item index passing the filters, packet order ascending — one
  // linear pass of primitive work per commit/keystroke. The search
  // haystack is the decoded preview plus the topic — search matches
  // what the user can see; the direction and topic filters gate
  // MESSAGE rows only (the subscription lifecycle facts always show).
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: number[] = [];
    for (let i = clearedCount; i < count; i++) {
      const item = items[i];
      if (item.kind === 'message') {
        if (directionFilter !== 'all' && item.direction !== directionFilter) continue;
        if (topicFilter !== null && item.topic !== topicFilter) continue;
        if (
          needle !== '' &&
          !derive.previewOf(item).toLowerCase().includes(needle) &&
          !item.topic.toLowerCase().includes(needle)
        ) {
          continue;
        }
      }
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, search, directionFilter, topicFilter, derive]);

  const filtering = search.trim() !== '' || directionFilter !== 'all' || topicFilter !== null;
  const live = lifecycle.endedBy === undefined;

  // The flat display list the virtual window runs over — ONE event
  // log: Connecting at one chronological edge, Connected (with the
  // CONNACK detail) before the first item, the ended row at the other
  // edge; subscription facts sit wherever the log recorded them.
  const entries = useMemo(() => {
    const out: ListEntry[] = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const messageCount = visibleRows.length;
    const notice: ListEntry | null =
      live && count === 0
        ? { key: 'waiting', kind: 'waiting' }
        : filtering && messageCount === 0 && count > clearedCount
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
    for (const entry of tokens) {
      if (entry === 'connected') {
        out.push({ key: 'connected', kind: 'connected' });
        // The details block always sits directly under its row — the
        // expanded message-viewer discipline, both sort orders.
        if (connackExpanded && lifecycle.connack !== undefined) {
          out.push({ key: 'connackDetail', kind: 'connackDetail' });
        }
      } else {
        pushRow(entry);
      }
    }
    if (newestFirst) {
      out.push({ key: 'sent', kind: 'sent' });
    } else {
      if (notice) out.push(notice);
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
    }
    return out;
  }, [
    newestFirst,
    lifecycle.connected,
    lifecycle.connack,
    lifecycle.endedBy,
    live,
    count,
    clearedCount,
    filtering,
    visibleRows,
    expanded,
    connackExpanded,
  ]);

  const heights = useMemo(
    () =>
      entries.map((e) =>
        e.kind === 'viewer' ? VIEWER_PX : e.kind === 'connackDetail' ? CONNACK_DETAIL_PX : SINGLE_ROW_PX,
      ),
    [entries],
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

  // Boxed direction badge — ↑ amber, ↓ blue on their tinted
  // backgrounds (the gRPC/WS anatomy).
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
          aria-label={t('workbench.editors.mqtt.timeline.sentAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      ) : (
        <ArrowDownOutlined
          aria-label={t('workbench.editors.mqtt.timeline.receivedAria')}
          style={{ fontSize: 11, color: token.colorTextSecondary }}
        />
      )}
    </span>
  );

  const topicChip = (topic: string): React.ReactNode => (
    <Tag
      data-testid="mqtt-timeline-topic-chip"
      color={topicBadgeColor(topic)}
      style={{
        marginInlineEnd: 0,
        fontSize: 11,
        lineHeight: '18px',
        flexShrink: 1,
        minWidth: 0,
        maxWidth: 220,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {topic}
    </Tag>
  );

  const factTag = (label: string, testid: string): React.ReactNode => (
    <Tag style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', flexShrink: 0 }} data-testid={testid}>
      {label}
    </Tag>
  );

  const renderEntry = (entry: ListEntry): React.ReactNode => {
    switch (entry.kind) {
      case 'sent':
        return (
          <div key={entry.key} data-testid="mqtt-timeline-sent-row" style={lifecycleRowStyle}>
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.mqtt.timeline.connecting')}
            </span>
            {lifecycleTime(lifecycle.startedAt)}
          </div>
        );
      case 'connected': {
        const expandable = lifecycle.connack !== undefined;
        return (
          <div
            key={entry.key}
            data-testid="mqtt-timeline-connected-row"
            {...(expandable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-expanded': connackExpanded,
                  className: 'oh-stream-row',
                  onClick: () => setConnackExpanded((prev) => !prev),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setConnackExpanded((prev) => !prev);
                    }
                  },
                }
              : {})}
            style={{ ...lifecycleRowStyle, ...(expandable ? { cursor: 'pointer' } : {}) }}
          >
            <LinkOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.mqtt.timeline.connected')}
            </span>
            {lifecycleTime(lifecycle.connectedAt)}
            {expandable &&
              (connackExpanded ? (
                <UpOutlined aria-hidden style={{ fontSize: 9, color: token.colorTextTertiary, flexShrink: 0 }} />
              ) : (
                <DownOutlined aria-hidden style={{ fontSize: 9, color: token.colorTextTertiary, flexShrink: 0 }} />
              ))}
          </div>
        );
      }
      case 'connackDetail': {
        const connack = lifecycle.connack;
        if (connack === undefined) return null;
        // The CONNACK facts as key: value rows — wire field names raw,
        // the reason code verbatim with its spec name beside it.
        const factRow = (label: string, value: string): React.ReactNode => (
          <div
            key={label}
            style={{
              ...cellFont,
              lineHeight: '20px',
              height: 20,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ color: token.colorTextSecondary }}>{label}: </span>
            <span style={{ color: token.colorText }}>{value}</span>
          </div>
        );
        return (
          <div
            key={entry.key}
            data-testid="mqtt-timeline-connack-details"
            style={{
              height: CONNACK_DETAIL_PX,
              boxSizing: 'border-box',
              padding: '6px 10px 6px 37px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ ...cellFont, fontSize: 11, lineHeight: '18px', height: 18, color: token.colorTextTertiary }}>
              CONNACK
            </div>
            {factRow('cmd', 'connack')}
            {factRow('length', connack.remainingLength !== undefined ? String(connack.remainingLength) : '—')}
            {factRow(
              'reasonCode',
              `${connack.reasonCode}${connack.reasonName !== undefined ? ` (${connack.reasonName})` : ''}`,
            )}
            {factRow('sessionPresent', connack.sessionPresent ? 'true' : 'false')}
          </div>
        );
      }
      case 'ended': {
        if (lifecycle.endedBy === undefined) return null;
        return (
          <div key={entry.key} data-testid="mqtt-timeline-ended-row" style={lifecycleRowStyle}>
            {lifecycle.endedBy === 'close' ? (
              <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            ) : (
              <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            )}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lifecycle.endedBy === 'close'
                ? t('workbench.editors.mqtt.timeline.disconnected')
                : t('workbench.editors.mqtt.timeline.stopped')}
              {lifecycle.endedMessage ? ` — ${lifecycle.endedMessage}` : ''}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
          </div>
        );
      }
      case 'waiting':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.mqtt.timeline.waiting')}</span>
          </div>
        );
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.mqtt.timeline.noMatches')}</span>
          </div>
        );
      case 'row': {
        const item = items[entry.index];
        const ts = timestamps?.[entry.index];
        if (item.kind === 'subscribed') {
          const detail = item.grants
            .map((grant) => `${grant.topicFilter} (${grantLabel(grant.reasonCode, t)})`)
            .join(', ');
          return (
            <div key={entry.key} data-testid="mqtt-timeline-subscribed-row" style={lifecycleRowStyle}>
              <PlusCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('workbench.editors.mqtt.timeline.subscribed', { detail })}
              </span>
              {lifecycleTime(ts)}
            </div>
          );
        }
        if (item.kind === 'unsubscribed') {
          return (
            <div key={entry.key} data-testid="mqtt-timeline-unsubscribed-row" style={lifecycleRowStyle}>
              <MinusCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('workbench.editors.mqtt.timeline.unsubscribed', { detail: item.topicFilters.join(', ') })}
              </span>
              {lifecycleTime(ts)}
            </div>
          );
        }
        const up = item.direction === 'up';
        const isExpanded = expanded.has(entry.index);
        const view = derive.viewOf(item);
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            className="oh-stream-row"
            data-testid="mqtt-timeline-message-row"
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
            {topicChip(item.topic)}
            {item.qos > 0 && factTag(`QoS ${item.qos}`, 'mqtt-timeline-qos-tag')}
            {item.retain && factTag(t('workbench.editors.mqtt.timeline.retainedTag'), 'mqtt-timeline-retained-tag')}
            {item.dup && factTag('DUP', 'mqtt-timeline-dup-tag')}
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
                ? t('workbench.editors.mqtt.timeline.binaryMessage', { bytes: view.byteLength })
                : derive.previewOf(item)}
            </span>
            <span
              style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
              data-testid="mqtt-timeline-byte-count"
            >
              {t('workbench.editors.mqtt.timeline.byteCount', { bytes: view.byteLength })}
            </span>
            {ts !== undefined && (
              <span
                data-testid="mqtt-timeline-message-time"
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
        if (item.kind !== 'message') return null;
        const view = derive.viewOf(item);
        return (
          <div
            key={entry.key}
            data-testid="mqtt-timeline-message-viewer"
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

  const messageTotal = useMemo(() => {
    let total = 0;
    for (let i = clearedCount; i < count; i++) if (items[i].kind === 'message') total++;
    return total;
  }, [items, count, clearedCount]);

  return (
    <div
      data-testid="mqtt-message-timeline"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.mqtt.timeline.searchMessages')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="mqtt-timeline-search"
          style={{ maxWidth: 220 }}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.mqtt.timeline.messageCount', { count: messageTotal })}
        </Text>
        {droppedMessages > 0 && (
          <Text type="warning" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="mqtt-timeline-dropped">
            {t('workbench.editors.mqtt.timeline.dropped', { count: droppedMessages })}
          </Text>
        )}
        <span style={{ marginLeft: 'auto' }} />
        {seenTopics.length > 0 && (
          <Select
            size="small"
            allowClear
            placeholder={t('workbench.editors.mqtt.timeline.topicFilterAll')}
            value={topicFilter}
            options={seenTopics.map((topic) => ({ value: topic, label: topic }))}
            onChange={(next: string | undefined) => setTopicFilter(next ?? null)}
            style={{ minWidth: 140, maxWidth: 220 }}
            data-testid="mqtt-timeline-topic-filter"
          />
        )}
        <ConfigProvider theme={{ token: { motion: false } }}>
          <Segmented
            size="small"
            value={directionFilter}
            onChange={(value) => setDirectionFilter(value as DirectionFilter)}
            data-testid="mqtt-timeline-direction-filter"
            options={[
              { value: 'all', label: t('workbench.editors.mqtt.timeline.filterAll') },
              { value: 'up', label: `↑ ${t('workbench.editors.mqtt.timeline.filterSent')}` },
              { value: 'down', label: `↓ ${t('workbench.editors.mqtt.timeline.filterReceived')}` },
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
                label: menuOptionLabel(t('workbench.editors.mqtt.timeline.newestFirst'), newestFirst),
                onClick: () => setNewestFirst(true),
              },
              {
                key: 'oldest',
                label: menuOptionLabel(t('workbench.editors.mqtt.timeline.oldestFirst'), !newestFirst),
                onClick: () => setNewestFirst(false),
              },
            ],
          }}
        >
          <Tooltip
            title={t('workbench.editors.mqtt.timeline.sortOrder')}
            placement="bottom"
            open={sortMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              icon={<SortAscendingOutlined />}
              data-testid="mqtt-timeline-sort"
              aria-label={t('workbench.editors.mqtt.timeline.sortOrder')}
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
        <Tooltip title={t('workbench.editors.mqtt.timeline.clearMessages')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            data-testid="mqtt-timeline-clear"
            onClick={() => setClearedCount(count)}
            aria-label={t('workbench.editors.mqtt.timeline.clearMessages')}
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
            data-testid="mqtt-timeline-new-messages"
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
            {t('workbench.editors.mqtt.timeline.newMessages')}
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

export default MqttMessageTimeline;

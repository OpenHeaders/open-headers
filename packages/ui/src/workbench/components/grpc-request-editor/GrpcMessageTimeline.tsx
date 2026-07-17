/**
 * GrpcMessageTimeline — the message-list surface for streaming gRPC
 * calls, ONE list across both phases: live (fed from `grpcStreamEvent`
 * frames while the invoke is in flight) and materialized (fed from the
 * snapshot's direction-tagged frames, session timestamps joined
 * positionally). A SIBLING of the SSE event list on the same shared
 * recipes — `useVirtualRowWindow`, pinned row heights, append-only
 * item identity, jump pill — with the anatomy a gRPC call needs:
 * direction glyphs (↑ sent / ↓ received), a direction filter, and
 * lifecycle rows (Request sent at the top; Response received once the
 * head is in; Call completed / stopped / failed at the bottom).
 * Arrival order, oldest first — a call is a conversation, and new
 * messages land at the bottom edge the view follows until the user
 * scrolls away (then the jump pill floats instead of content moving
 * under them).
 *
 * Rows expand into a mini viewer over the frame's decoded payload —
 * schema-driven canonical JSON against the rpc's request type (↑) or
 * response type (↓), the structural decode when the type doesn't
 * resolve, raw base64 otherwise (`deriveGrpcFrameView`, the F5.2
 * display-only posture). Search and Clear are display-only — the
 * capture is never touched. Per-item derivations cache on item
 * identity and reset when the registry or the resolved types change.
 * Timestamps are session-only (the ratified Phase E law): absent — on
 * a re-opened saved exchange — rows simply render no time.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  DisconnectOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ProtoRegistry } from '@openheaders/core/proto';
import { Button, Input, Segmented, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import CodeEditor from '../shared/CodeEditor';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';
import { deriveGrpcFrameView, type GrpcMessageView } from './response-decode';

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

/** One timeline message — the live wire item and the snapshot frame
 *  share this shape (atMs rides only the live one; materialized times
 *  join via `timestamps`). */
export interface GrpcTimelineItem {
  direction?: 'up' | 'down';
  dataBase64: string;
  compressed: boolean;
}

/** How the call ended — drives the bottom lifecycle row. */
export type GrpcTimelineEndedBy = 'complete' | 'stop' | 'error';

export interface GrpcTimelineLifecycle {
  /** Call target — `/service/rpc` on the invoked authority. */
  target: string;
  /** Session-only invoke-departure time. */
  startedAt?: number;
  /** True once the response head arrived. */
  headArrived: boolean;
  /** Session-only head-arrival time. */
  connectedAt?: number;
  /** Absent while frames are still arriving — the live phase. */
  endedBy?: GrpcTimelineEndedBy;
  endedAt?: number;
  /** `0 OK`-style status label riding the completed row. */
  statusLabel?: string;
  /** Failure text riding `endedBy: 'error'`. */
  endedMessage?: string;
}

interface GrpcMessageTimelineProps {
  /** Message log — append-only during the live phase (the array
   *  reference stays stable; `count` is the committed prefix), the
   *  snapshot's frames once materialized. */
  items: readonly GrpcTimelineItem[];
  count: number;
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[];
  lifecycle: GrpcTimelineLifecycle;
  registry: ProtoRegistry | null;
  /** The rpc's resolved request type — ↑ frames decode as it. */
  inputType: string | null;
  /** The rpc's resolved response type — ↓ frames decode as it. */
  outputType: string | null;
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

/** Lifecycle label for how the call ended. */
function endedLabel(endedBy: GrpcTimelineEndedBy, t: Translate): string {
  switch (endedBy) {
    case 'complete':
      return t('workbench.editors.grpc.timeline.completed');
    case 'stop':
      return t('workbench.editors.grpc.timeline.stopped');
    case 'error':
      return t('workbench.editors.grpc.timeline.failed');
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

/** Per-item view/preview caches, minted per (registry, types) tuple so
 *  a spec rebuild re-derives instead of serving stale decodes. */
interface FrameDerivations {
  viewOf: (item: GrpcTimelineItem) => GrpcMessageView;
  previewOf: (item: GrpcTimelineItem) => string;
}

function makeFrameDerivations(
  registry: ProtoRegistry | null,
  inputType: string | null,
  outputType: string | null,
): FrameDerivations {
  const viewCache = new WeakMap<GrpcTimelineItem, GrpcMessageView>();
  const previewCache = new WeakMap<GrpcTimelineItem, string>();
  const viewOf = (item: GrpcTimelineItem): GrpcMessageView => {
    const hit = viewCache.get(item);
    if (hit !== undefined) return hit;
    const view = deriveGrpcFrameView(item, registry, item.direction === 'up' ? inputType : outputType);
    viewCache.set(item, view);
    return view;
  };
  const previewOf = (item: GrpcTimelineItem): string => {
    const hit = previewCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const text =
      view.kind === 'schema' || view.kind === 'structural'
        ? view.text.replace(/\n\s*/g, ' ')
        : view.kind === 'raw'
          ? view.base64
          : '';
    const preview = text.slice(0, PREVIEW_MAX_CHARS);
    previewCache.set(item, preview);
    return preview;
  };
  return { viewOf, previewOf };
}

const GrpcMessageTimeline: React.FC<GrpcMessageTimelineProps> = ({
  items,
  count,
  timestamps,
  lifecycle,
  registry,
  inputType,
  outputType,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [wrapLines, setWrapLines] = useState(true);

  const derive = useMemo(
    () => makeFrameDerivations(registry, inputType, outputType),
    [registry, inputType, outputType],
  );

  // New messages land at the bottom edge; while the user reads away
  // from it, a jump pill floats instead of content shifting.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const awayFromBottomRef = useRef(false);
  const prevCountRef = useRef(count);
  // Identity anchor recorded on every scroll — restored after list
  // mutations so content never shifts under a reading user.
  const anchorRef = useRef<{ key: string; offset: number } | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const jumpToNewest = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    awayFromBottomRef.current = false;
    anchorRef.current = null;
    setHasNewMessages(false);
  };

  // A new message log (new invoke, materialized snapshot) resets the
  // display state — indexes are positional in the log they were
  // minted against.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items identity IS the reset signal.
  useEffect(() => {
    setSearch('');
    setDirectionFilter('all');
    setClearedCount(0);
    setExpanded(new Set<number>());
    setHasNewMessages(false);
    awayFromBottomRef.current = false;
    anchorRef.current = null;
  }, [items]);

  useEffect(() => {
    const grew = count > prevCountRef.current;
    prevCountRef.current = count;
    if (grew && awayFromBottomRef.current) setHasNewMessages(true);
  }, [count]);

  // Every message index passing the search + direction filter, arrival
  // order — one linear pass of primitive work per commit/keystroke.
  const displayRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: number[] = [];
    for (let i = clearedCount; i < count; i++) {
      const item = items[i];
      if (directionFilter !== 'all' && (item.direction ?? 'down') !== directionFilter) continue;
      if (needle !== '' && !derive.previewOf(item).toLowerCase().includes(needle)) continue;
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, search, directionFilter, derive]);

  const filtering = search.trim() !== '' || directionFilter !== 'all';
  const live = lifecycle.endedBy === undefined;

  const entries = useMemo(() => {
    const out: ListEntry[] = [];
    out.push({ key: 'sent', kind: 'sent' });
    if (lifecycle.headArrived) out.push({ key: 'connected', kind: 'connected' });
    if (live && count === 0) out.push({ key: 'waiting', kind: 'waiting' });
    if (filtering && displayRows.length === 0 && count > clearedCount) out.push({ key: 'none', kind: 'noMatches' });
    for (const index of displayRows) {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    }
    if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
    return out;
  }, [lifecycle.headArrived, lifecycle.endedBy, live, count, clearedCount, filtering, displayRows, expanded]);

  const heights = useMemo(() => entries.map((e) => (e.kind === 'viewer' ? VIEWER_PX : SINGLE_ROW_PX)), [entries]);

  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx, prefix } = useVirtualRowWindow(
    scrollerRef,
    heights,
    entries.length > 0,
  );

  // Follow the bottom edge unless the user scrolled away; a reading
  // user keeps the row under their viewport top exactly where it was.
  // Skipped on an unlaid-out (jsdom) viewport, where everything
  // renders anyway.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0) return;
    if (!awayFromBottomRef.current) {
      const edgeTop = Math.max(0, (prefix[prefix.length - 1] ?? 0) - el.clientHeight);
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
  }, [entries, prefix, onWindowScroll]);

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
          <div key={entry.key} data-testid="grpc-timeline-sent-row" style={lifecycleRowStyle}>
            <SendOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.grpc.timeline.requestSent', { target: lifecycle.target })}
            </span>
            {lifecycleTime(lifecycle.startedAt)}
          </div>
        );
      case 'connected':
        return (
          <div key={entry.key} data-testid="grpc-timeline-connected-row" style={lifecycleRowStyle}>
            <CheckCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.grpc.timeline.responseReceived')}
            </span>
            {lifecycleTime(lifecycle.connectedAt)}
          </div>
        );
      case 'ended': {
        if (lifecycle.endedBy === undefined) return null;
        return (
          <div key={entry.key} data-testid="grpc-timeline-ended-row" style={lifecycleRowStyle}>
            <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endedLabel(lifecycle.endedBy, t)}
              {lifecycle.statusLabel ? ` · ${lifecycle.statusLabel}` : ''}
              {lifecycle.endedMessage ? ` — ${lifecycle.endedMessage}` : ''}
            </span>
            {lifecycleTime(lifecycle.endedAt)}
          </div>
        );
      }
      case 'waiting':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.grpc.timeline.waiting')}</span>
          </div>
        );
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.grpc.timeline.noMatches')}</span>
          </div>
        );
      case 'row': {
        const item = items[entry.index];
        const up = item.direction === 'up';
        const isExpanded = expanded.has(entry.index);
        const ts = timestamps?.[entry.index];
        const view = derive.viewOf(item);
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            data-testid="grpc-timeline-message-row"
            onClick={() => toggleRow(entry.index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleRow(entry.index);
              }
            }}
            style={{ ...singleRowStyle, cursor: 'pointer' }}
          >
            {up ? (
              <ArrowUpOutlined
                aria-label={t('workbench.editors.grpc.timeline.sentAria')}
                style={{ fontSize: 10, color: token.colorSuccess, flexShrink: 0 }}
              />
            ) : (
              <ArrowDownOutlined
                aria-label={t('workbench.editors.grpc.timeline.receivedAria')}
                style={{ fontSize: 10, color: token.colorPrimary, flexShrink: 0 }}
              />
            )}
            <span
              style={{
                ...cellFont,
                color: token.colorTextSecondary,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...(view.kind === 'compressed' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
              }}
            >
              {view.kind === 'compressed' ? t('workbench.editors.grpc.response.compressed') : derive.previewOf(item)}
            </span>
            {ts !== undefined && (
              <span
                data-testid="grpc-timeline-message-time"
                style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
              >
                {formatMessageTime(ts)}
              </span>
            )}
          </div>
        );
      }
      case 'viewer': {
        const view = derive.viewOf(items[entry.index]);
        const content =
          view.kind === 'schema' || view.kind === 'structural'
            ? { value: view.text, language: 'json' as const }
            : view.kind === 'raw'
              ? { value: view.base64, language: 'text' as const }
              : { value: '', language: 'text' as const };
        return (
          <div
            key={entry.key}
            data-testid="grpc-timeline-message-viewer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            style={{ height: VIEWER_PX - 1, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            <CodeEditor
              value={content.value}
              language={content.language}
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

  return (
    <div
      data-testid="grpc-message-timeline"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.grpc.timeline.searchMessages')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="grpc-timeline-search"
          style={{ maxWidth: 240 }}
        />
        <Segmented
          size="small"
          value={directionFilter}
          onChange={(value) => setDirectionFilter(value as DirectionFilter)}
          data-testid="grpc-timeline-direction-filter"
          options={[
            { value: 'all', label: t('workbench.editors.grpc.timeline.filterAll') },
            { value: 'up', label: `↑ ${t('workbench.editors.grpc.timeline.filterSent')}` },
            { value: 'down', label: `↓ ${t('workbench.editors.grpc.timeline.filterReceived')}` },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.grpc.timeline.messageCount', { count: count - clearedCount })}
        </Text>
        <span style={{ marginLeft: 'auto' }} />
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
        <Tooltip title={t('workbench.editors.grpc.timeline.clearMessages')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            data-testid="grpc-timeline-clear"
            onClick={() => setClearedCount(count)}
            aria-label={t('workbench.editors.grpc.timeline.clearMessages')}
          />
        </Tooltip>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {hasNewMessages && (
          <Button
            size="small"
            type="primary"
            shape="round"
            icon={<ArrowDownOutlined />}
            data-testid="grpc-timeline-new-messages"
            onClick={jumpToNewest}
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              fontSize: 11,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            {t('workbench.editors.grpc.timeline.newMessages')}
          </Button>
        )}
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const away = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
            awayFromBottomRef.current = away;
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

export default GrpcMessageTimeline;

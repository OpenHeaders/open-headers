/**
 * ResponseSseEventList — the event-LIST surface for text/event-stream
 * bodies, ONE list across both phases: live (fed from the stream
 * frames while the send is in flight) and materialized (fed from the
 * parsed snapshot). One row per wire event, newest-first by default
 * with an arrival-order sort toggle (a stream is a timeline — time is
 * its one meaningful order): direction glyph, colored event-name
 * badge, inline data preview, session-only timestamp, and an info
 * popover (id / size / retry). Comment blocks are their own rows.
 * Lifecycle rows — Connected at the oldest edge, closed/stopped/capped
 * at the newest, flipping with the sort — derive from the head state +
 * `streamedCapture`, never invented; at Stop/close the ended row
 * appends instead of the view switching. When events commit while the
 * user is scrolled away from the edge new rows land on, a jump pill
 * floats over the list (instant jump, no animation). "Group by event
 * name" is CLUSTERING, not sorting — rows partition under collapsible
 * name headers, arrival order intact within each group, group order
 * following the direction's "new edge first" reading.
 *
 * Rows expand into a mini viewer: the shared CodeEditor over the DATA
 * payload — lossless JSON print under the JSON grammar (int64 tokens
 * verbatim — the F3 law), per-line JSON documents printed in sequence,
 * the payload text otherwise (raw wire block for comment-only rows);
 * wrap toggles from the toolbar and Monaco's own Find covers in-viewer
 * search. Search and Clear are display-only — the capture is never
 * touched, and Copy/Raw elsewhere still see the wire body.
 *
 * Perf laws (S8): the live feed is an append-only array + committed
 * count, so existing rows never re-mint; the display window is capped
 * at SHOW_STEP newest rows ("show older" pages down); and the format
 * plane (Monaco) engages per-row on expand only. Event names —
 * `message` for unnamed data events, `comment` for heartbeat blocks —
 * are wire grammar terms and deliberately stay untranslated.
 */

import {
  ApiOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CaretRightOutlined,
  CheckOutlined,
  ClearOutlined,
  DisconnectOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Popover, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import CodeEditor from '../../shared/CodeEditor';
import { WrapLinesIcon } from './ViewPickerIcons';
import { parseLosslessJson, stringifyLossless } from './lossless-json';
import { formatBytes } from './response-format';
import type { SseEventItem } from './response-sse';

const { Text } = Typography;

/** Display window step — rows shown at once, and the page size each
 *  "show older" click adds. */
const SHOW_STEP = 200;

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
const PREVIEW_MAX_CHARS = 400;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** How the stream ended — drives the topmost lifecycle row. */
export type SseStreamEndedBy = 'end' | 'stop' | 'cap' | 'timeout' | 'error';

export interface SseListLifecycle {
  /** Connection target — the send's (final) URL. */
  url: string;
  /** Session-only head-arrival time; absent for re-opened saved bodies. */
  connectedAt?: number;
  /** Absent while frames are still arriving — the live phase. */
  endedBy?: SseStreamEndedBy;
  endedAt?: number;
  /** Failure text riding `endedBy: 'error'`. */
  endedMessage?: string;
}

interface ResponseSseEventListProps {
  /** Parsed event log — append-only during the live phase (the array
   *  reference stays stable; `count` is the committed prefix), the
   *  full snapshot parse once materialized. */
  items: readonly SseEventItem[];
  count: number;
  /** Session-only positional mint times (items[i] ↔ timestamps[i]);
   *  absent — or short — entries render no time. */
  timestamps?: readonly number[];
  lifecycle: SseListLifecycle;
}

/** Stable badge palette — the same event name always lands on the same
 *  color within and across streams. */
const BADGE_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

function badgeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

/** Badge identity of a record: its `event` name, the spec's default
 *  `message` for unnamed data events, `comment` for comment-only rows. */
function badgeOf(record: SseEventItem['record']): { name: string; kind: 'named' | 'message' | 'comment' } {
  if (typeof record.event === 'string' && record.event !== '') return { name: record.event, kind: 'named' };
  if (record.data === undefined && record.comment !== undefined) return { name: 'comment', kind: 'comment' };
  return { name: 'message', kind: 'message' };
}

// Per-item derivations cached off the item's identity — items are
// immutable once parsed, and the visible window re-derives per commit /
// keystroke, so recomputing per render would rescan payloads.
const previewCache = new WeakMap<SseEventItem, string>();

function previewOf(item: SseEventItem): string {
  const hit = previewCache.get(item);
  if (hit !== undefined) return hit;
  const data = item.record.data;
  let text: string;
  if (data === undefined) {
    const comment = item.record.comment;
    text = typeof comment === 'string' ? comment : item.raw;
  } else if (typeof data === 'string') {
    text = data;
  } else {
    // Lossless print collapsed to one line — the stripped newlines are
    // indentation only (string content stays JSON-escaped).
    text = stringifyLossless(data).replace(/\n\s*/g, ' ');
  }
  const preview = text.replace(/\n/g, ' ').slice(0, PREVIEW_MAX_CHARS);
  previewCache.set(item, preview);
  return preview;
}

const viewerCache = new WeakMap<SseEventItem, { value: string; language: 'json' | 'text' }>();

/** Expanded-row content — the event's DATA payload (id/event/retry
 *  live in the info popover): the lossless pretty print under the JSON
 *  grammar when the payload is JSON — including a multi-line payload
 *  whose data lines are each their own JSON document, printed in
 *  sequence — the verbatim payload text otherwise; comment-only rows
 *  fall back to the raw wire block. */
function viewerContentOf(item: SseEventItem): { value: string; language: 'json' | 'text' } {
  const hit = viewerCache.get(item);
  if (hit !== undefined) return hit;
  const data = item.record.data;
  let content: { value: string; language: 'json' | 'text' };
  if (data !== undefined && typeof data !== 'string') {
    content = { value: stringifyLossless(data), language: 'json' };
  } else if (typeof data === 'string') {
    const lines = data.split('\n').filter((line) => line.trim() !== '');
    const printed: string[] = [];
    let allJson = lines.length > 0;
    for (const line of lines) {
      const parsedLine = parseLosslessJson(line);
      if (parsedLine === null) {
        allJson = false;
        break;
      }
      printed.push(stringifyLossless(parsedLine.value));
    }
    content = allJson ? { value: printed.join('\n'), language: 'json' } : { value: data, language: 'text' };
  } else {
    content = { value: item.raw, language: 'text' };
  }
  viewerCache.set(item, content);
  return content;
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatEventTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Lifecycle label for how the stream ended. */
function endedLabel(endedBy: SseStreamEndedBy, t: Translate): string {
  switch (endedBy) {
    case 'end':
      return t('workbench.editors.request.response.sse.closed');
    case 'stop':
      return t('workbench.editors.request.response.sse.stopped');
    case 'cap':
      return t('workbench.editors.request.response.sse.capped');
    case 'timeout':
      return t('workbench.editors.request.response.sse.timedOut');
    case 'error':
      return t('workbench.editors.request.response.sse.failed');
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return '';
    }
  }
}

/** Info popover body — computed on first open, not per row render. */
const EventInfo: React.FC<{ item: SseEventItem }> = ({ item }) => {
  const t = useT();
  const { record, raw } = item;
  const rows: Array<[string, string]> = [];
  if (typeof record.id === 'string') rows.push([t('workbench.editors.request.response.sse.infoId'), record.id]);
  rows.push([
    t('workbench.editors.request.response.sse.infoSize'),
    formatBytes(new TextEncoder().encode(raw).length),
  ]);
  if (record.retry !== undefined) {
    rows.push([t('workbench.editors.request.response.sse.infoRetry'), String(record.retry)]);
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, rowGap: 2, fontSize: 12 }}>
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Text>
          <span style={cellFont}>{value}</span>
        </Fragment>
      ))}
    </div>
  );
};

const ResponseSseEventList: React.FC<ResponseSseEventListProps> = ({ items, count, timestamps, lifecycle }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [wrapLines, setWrapLines] = useState(true);
  const [shownLimit, setShownLimit] = useState(SHOW_STEP);
  // The stream is a timeline — the one meaningful order is arrival
  // time: newest-first by default, flippable to oldest-first. New rows
  // land at the top (newest-first) or the bottom (oldest-first); that
  // edge is where the jump pill points.
  const [newestFirst, setNewestFirst] = useState(true);
  // Clustering, not sorting: rows partition under event-name headers,
  // arrival order preserved within each group. Group order follows the
  // sort direction (first group = the one with the newest activity in
  // newest-first, the first-seen name in oldest-first).
  const [groupByName, setGroupByName] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // When the user has scrolled away from the edge where new rows land
  // and more events commit, a jump pill floats over the list instead
  // of the content moving under them.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const awayFromNewEdgeRef = useRef(false);
  const prevCountRef = useRef(count);
  const [hasNewEvents, setHasNewEvents] = useState(false);

  const jumpToNewest = (toNewest: boolean) => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = toNewest ? 0 : el.scrollHeight;
    awayFromNewEdgeRef.current = false;
    setHasNewEvents(false);
  };

  // A new event log (new send, new snapshot) resets the display state —
  // indexes are positional in the log the state was minted against.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items identity IS the reset signal.
  useEffect(() => {
    setSearch('');
    setClearedCount(0);
    setExpanded(new Set<number>());
    setShownLimit(SHOW_STEP);
    setCollapsedGroups(new Set<string>());
    setHasNewEvents(false);
    awayFromNewEdgeRef.current = false;
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
    if (!grew) return;
    if (awayFromNewEdgeRef.current) {
      setHasNewEvents(true);
      return;
    }
    // Following the new edge in oldest-first: appended rows push the
    // bottom away — pin back to it (newest-first needs nothing, the
    // top stays the top).
    if (!newestFirst) {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [count, newestFirst]);

  // Visible window, newest-first: walk down from the newest committed
  // event, apply the search + clear, cap at the display window. One
  // linear pass per commit/keystroke; matching scans the raw block
  // text (name, data, comments and unknown fields all live there).
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: number[] = [];
    let hiddenOlder = 0;
    for (let i = count - 1; i >= clearedCount; i--) {
      if (needle !== '' && !items[i].raw.toLowerCase().includes(needle)) continue;
      if (rows.length < shownLimit) rows.push(i);
      else hiddenOlder++;
    }
    return { rows, hiddenOlder };
  }, [items, count, clearedCount, search, shownLimit]);

  // The window always keeps the NEWEST rows; oldest-first only flips
  // the display order (≤ SHOW_STEP entries — a cheap copy).
  const displayRows = useMemo(
    () => (newestFirst ? visible.rows : [...visible.rows].reverse()),
    [visible, newestFirst],
  );

  // Partition the display window under event-name headers, insertion-
  // ordered over the direction-sorted rows — so group order follows
  // the same "newest edge first" reading the flat list has.
  const groups = useMemo(() => {
    if (!groupByName) return null;
    const byName = new Map<string, number[]>();
    for (const index of displayRows) {
      const name = badgeOf(items[index].record).name;
      const bucket = byName.get(name);
      if (bucket) bucket.push(index);
      else byName.set(name, [index]);
    }
    return [...byName.entries()];
  }, [displayRows, groupByName, items]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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

  const searching = search.trim() !== '';
  const live = lifecycle.endedBy === undefined;

  const lifecycleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorTextSecondary,
    fontSize: 12,
  };

  // Lifecycle rows sit at their chronological ends: connected at the
  // oldest edge, ended at the newest — so they flip with the sort. The
  // row at the very bottom of the scroller drops its divider.
  const endedRow =
    lifecycle.endedBy !== undefined ? (
      <div
        data-testid="oh-sse-lifecycle-row"
        style={{ ...lifecycleRowStyle, ...(newestFirst ? {} : { borderBottom: 'none' }) }}
      >
        <DisconnectOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
        <span>
          {endedLabel(lifecycle.endedBy, t)}
          {lifecycle.endedMessage ? ` — ${lifecycle.endedMessage}` : ''}
        </span>
        {lifecycle.endedAt !== undefined && (
          <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
            {formatEventTime(lifecycle.endedAt)}
          </span>
        )}
      </div>
    ) : null;

  const connectedRow = (
    <div
      data-testid="oh-sse-connected-row"
      style={{ ...lifecycleRowStyle, ...(newestFirst ? { borderBottom: 'none' } : {}) }}
    >
      <ApiOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t('workbench.editors.request.response.sse.connected', { url: lifecycle.url })}
      </span>
      {lifecycle.connectedAt !== undefined && (
        <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
          {formatEventTime(lifecycle.connectedAt)}
        </span>
      )}
    </div>
  );

  // One event row (+ its expanded mini viewer) — shared between the
  // flat list and the grouped view; `index` names one immutable event.
  const renderEventRow = (index: number) => {
    const item = items[index];
    const badge = badgeOf(item.record);
    const isExpanded = expanded.has(index);
    const ts = timestamps?.[index];
    const viewer = isExpanded ? viewerContentOf(item) : null;
    return (
      <Fragment key={index}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          data-testid="oh-sse-event-row"
          onClick={() => toggleRow(index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleRow(index);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            cursor: 'pointer',
          }}
        >
          <ArrowDownOutlined aria-hidden style={{ fontSize: 10, color: token.colorTextTertiary }} />
          <Tag
            data-testid="oh-sse-event-badge"
            color={badge.kind === 'named' ? badgeColor(badge.name) : undefined}
            style={{
              marginInlineEnd: 0,
              fontSize: 11,
              lineHeight: '18px',
              flexShrink: 0,
              ...(badge.kind === 'comment' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
            }}
          >
            {badge.name}
          </Tag>
          <span
            style={{
              ...cellFont,
              color: token.colorTextSecondary,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {previewOf(item)}
          </span>
          {ts !== undefined && (
            <span
              data-testid="oh-sse-event-time"
              style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
            >
              {formatEventTime(ts)}
            </span>
          )}
          <Popover content={<EventInfo item={item} />} placement="left">
            <InfoCircleOutlined
              data-testid="oh-sse-event-info"
              aria-label={t('workbench.editors.request.response.sse.eventInfoAria')}
              onClick={(event) => event.stopPropagation()}
              style={{ fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
            />
          </Popover>
        </div>
        {viewer !== null && (
          <div
            data-testid="oh-sse-event-viewer"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            style={{ height: 180, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            <CodeEditor
              value={viewer.value}
              language={viewer.language}
              readOnly
              fill
              variableAutoComplete={false}
              wordWrapOverride={wrapLines ? 'on' : 'off'}
            />
          </div>
        )}
      </Fragment>
    );
  };

  // "Show older" sits at the OLDEST edge of the window it extends.
  const showOlderRow =
    visible.hiddenOlder > 0 ? (
      <div style={{ ...lifecycleRowStyle, justifyContent: 'center' }}>
        <Button
          size="small"
          type="link"
          data-testid="oh-sse-show-older"
          style={{ fontSize: 11 }}
          onClick={() => setShownLimit((prev) => prev + SHOW_STEP)}
        >
          {t('workbench.editors.request.response.sse.showOlder', { count: visible.hiddenOlder })}
        </Button>
      </div>
    ) : null;

  return (
    <div
      data-testid="oh-sse-event-list"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.request.response.sse.searchEvents')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="oh-sse-search"
          style={{ maxWidth: 260 }}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.request.response.sse.eventCount', { count: count - clearedCount })}
        </Text>
        <span style={{ marginLeft: 'auto' }} />
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'newest',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    {t('workbench.editors.request.response.sse.newestFirst')}
                    {newestFirst && <CheckOutlined style={{ color: token.colorPrimary }} />}
                  </span>
                ),
                onClick: () => setNewestFirst(true),
              },
              {
                key: 'oldest',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    {t('workbench.editors.request.response.sse.oldestFirst')}
                    {!newestFirst && <CheckOutlined style={{ color: token.colorPrimary }} />}
                  </span>
                ),
                onClick: () => setNewestFirst(false),
              },
              { type: 'divider' },
              {
                key: 'group',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    {t('workbench.editors.request.response.sse.groupByName')}
                    {groupByName && <CheckOutlined style={{ color: token.colorPrimary }} />}
                  </span>
                ),
                onClick: () => setGroupByName((prev) => !prev),
              },
            ],
          }}
        >
          <Tooltip title={t('workbench.editors.request.response.sse.sortOrder')} placement="bottom">
            <Button
              size="small"
              type="text"
              icon={<SortAscendingOutlined />}
              data-testid="oh-sse-sort"
              aria-label={t('workbench.editors.request.response.sse.sortOrder')}
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
        <Tooltip title={t('workbench.editors.request.response.sse.clearEvents')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            data-testid="oh-sse-clear"
            onClick={() => setClearedCount(count)}
            aria-label={t('workbench.editors.request.response.sse.clearEvents')}
          />
        </Tooltip>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {hasNewEvents && (
          <Button
            size="small"
            type="primary"
            shape="round"
            icon={newestFirst ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            data-testid="oh-sse-new-events"
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
            {t('workbench.editors.request.response.sse.newEvents')}
          </Button>
        )}
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const away = newestFirst ? el.scrollTop > 4 : el.scrollHeight - el.scrollTop - el.clientHeight > 4;
            awayFromNewEdgeRef.current = away;
            if (!away) setHasNewEvents(false);
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
        {newestFirst ? endedRow : connectedRow}
        {live && count === 0 && (
          <div style={lifecycleRowStyle}>
            <span>{t('workbench.editors.request.response.sse.waiting')}</span>
          </div>
        )}
        {searching && visible.rows.length === 0 && count > clearedCount && (
          <div style={lifecycleRowStyle}>
            <span>{t('workbench.editors.request.response.sse.noMatches')}</span>
          </div>
        )}
        {!newestFirst && showOlderRow}
        {groups !== null
          ? groups.map(([name, indexes]) => {
              const collapsed = collapsedGroups.has(name);
              const headBadge = badgeOf(items[indexes[0]].record);
              return (
                <Fragment key={name}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={!collapsed}
                    data-testid="oh-sse-group-header"
                    onClick={() => toggleGroup(name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleGroup(name);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      background: token.colorFillQuaternary,
                      cursor: 'pointer',
                    }}
                  >
                    <CaretRightOutlined
                      aria-hidden
                      rotate={collapsed ? 0 : 90}
                      style={{ fontSize: 10, color: token.colorTextTertiary }}
                    />
                    <Tag
                      color={headBadge.kind === 'named' ? badgeColor(name) : undefined}
                      style={{
                        marginInlineEnd: 0,
                        fontSize: 11,
                        lineHeight: '18px',
                        flexShrink: 0,
                        ...(headBadge.kind === 'comment' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
                      }}
                    >
                      {name}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {t('workbench.editors.request.response.sse.eventCount', { count: indexes.length })}
                    </Text>
                  </div>
                  {!collapsed && indexes.map((index) => renderEventRow(index))}
                </Fragment>
              );
            })
          : displayRows.map((index) => renderEventRow(index))}
        {newestFirst && showOlderRow}
            // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only — an index names one immutable event.
        {newestFirst ? connectedRow : endedRow}
        </div>
      </div>
    </div>
  );
};

export default ResponseSseEventList;

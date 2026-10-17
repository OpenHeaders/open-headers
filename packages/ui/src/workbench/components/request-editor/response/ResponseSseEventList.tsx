/**
 * ResponseSseEventList — the event-LIST surface for text/event-stream
 * bodies, ONE list across both phases: live (fed from the stream
 * frames while the send is in flight) and materialized (fed from the
 * parsed snapshot). One row per wire event, newest-first by default
 * with an arrival-order sort toggle (a stream is a timeline — time is
 * its one meaningful order): direction glyph, event-name badge, the
 * data VERBATIM as the wire carried it (the lines joined by a space —
 * the browsers', Postman's and Bruno's row reading; formatting belongs
 * to the expanded viewer), session-only timestamp, and an info popover
 * (id / size / retry). Comment blocks are their own rows. The badge
 * colors only a name the wire carried; the spec's default `message`
 * (every unnamed data event — what an EventSource dispatches) and the
 * `comment` rows wear the quiet tone, so the server's own names stand
 * out while grouping and the name filter still see every row.
 * Lifecycle rows — Connected at the oldest edge, closed/stopped/capped
 * at the newest, flipping with the sort — derive from the head state +
 * `streamedCapture`, never invented; at Stop/close the ended row
 * appends instead of the view switching. When events commit while the
 * user is scrolled away from the edge new rows land on, a jump pill
 * floats over the list (instant jump, no animation). "Group by event
 * name" is CLUSTERING, not sorting — rows partition under collapsible
 * name headers, arrival order intact within each group, group order
 * ANCHORED to first appearance so groups never trade places mid-stream.
 * An optional per-group row limit shows only each group's N newest
 * events (the window slides as events arrive — several groups stay
 * watchable at once; headers keep the real totals), and the group
 * whose rows span the viewport top pins its header as a clickable
 * sticky overlay. Sort direction, grouping, and the row limit are the
 * `requests.sseEvents*` SETTINGS — the toolbar writes the same global
 * value the Settings page edits, so the choices survive Send/Stop
 * remounts and apply everywhere.
 *
 * The strip is the MQTT / WS / gRPC timelines': search, the lens menu
 * (all events / lifecycle only — a stream has one direction, so the
 * lens is the direction menu's whole remainder) and the count on the
 * left; the event-NAME filter (several names at once, over every name
 * the log has seen), Sort by, View (grouping, the row limit) and
 * Clear on the right. Every trigger is icon + label — the lens trigger
 * reads the filter in force, Sort by and View stay names — and the
 * menus ride antd's selection plane under `.oh-choice-menu` /
 * `.oh-view-menu` (the Editor menu's row anatomy). The count reads
 * `{shown} of {total}` while any filter is in force.
 *
 * Rows share the siblings' anatomy: every row's leading mark sits on
 * ONE 18px column — the boxed ↓ badge on an event row, the lifecycle
 * glyph centered in the same slot (the check for Connected; the ended
 * row's glyph follows the end kind — the disconnect mark for a close or
 * a Stop, the info mark for the byte cap, the clock for the deadline,
 * all neutral; the close-circle on the error tint for a failure, the
 * row carrying the alarm). Rows separate by the shared hairline, the
 * last row bare — no frame around the list.
 *
 * Rows expand into the shared timeline viewer: Pretty is this list's
 * own print over the DATA payload — lossless JSON under the JSON
 * grammar (int64 tokens verbatim — the F3 law), per-line JSON
 * documents printed in sequence, the payload text otherwise (the raw
 * wire block for comment-only rows); Raw / Hex / Base64 read the
 * block as it came; wrap, Find and Copy ride the viewer's toolbar.
 * Search and Clear are display-only — the capture is never touched,
 * and Copy/Raw elsewhere still see the wire body.
 *
 * Search is a LOOKUP over every row: an event's badge name plus its
 * FULL printed payload (what the expanded viewer shows — lowercased
 * once per item, cached beside the viewer content), a lifecycle row's
 * rendered line. The lens and the name filter gate EVENT rows only;
 * under a search the lifecycle rows show only when their words carry
 * the needle, and the no-match notice shows only when nothing at all
 * matches. The row words live in `sse-timeline-row-text.ts`, read by
 * the row renderer AND the search — search can only find what the row
 * shows.
 *
 * Perf shape (enterprise streams — tens of thousands of events):
 *   • The live feed is an append-only array + committed count, so
 *     existing rows never re-mint and per-item derivations (badge
 *     name, preview, viewer content) cache on item identity.
 *   • The list VIRTUALIZES on the shared row-window recipe (prefix
 *     sums + binary search, the devtools panel's console/stream
 *     machinery): every event is scroll-reachable — no paging, no row
 *     cap — but only the viewport ± overscan is ever mounted. Heights
 *     are pinned by construction (never measured).
 *   • Per commit the index passes are O(visible events) of primitive
 *     work; the DOM cost stays O(viewport).
 *   • Scroll ANCHORS to row identity: while the user reads away from
 *     the new edge, prepended/inserted rows shift content, and the
 *     viewport is restored to the anchored row before paint. Following
 *     the new edge pins to it (top for newest-first, bottom for
 *     oldest-first).
 * Event names — `message` for unnamed data events, `comment` for
 * heartbeat blocks — are wire grammar terms and deliberately stay
 * untranslated.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ControlOutlined,
  CopyOutlined,
  DisconnectOutlined,
  DownOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import { Button, Dropdown, Input, Popover, Select, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import TimelineMessageViewer, {
  STREAM_HAIRLINE,
  StreamLastRow,
  useTimelineViewerModes,
  VIEWER_PX,
} from '../../shared/TimelineMessageViewer';
import { parseLosslessJson, stringifyLossless } from './lossless-json';
import { buildHexDump, type HexDump } from './response-encoding';
import { formatBytes } from './response-format';
import type { SseEventItem } from './response-sse';
import {
  connectedRowText,
  endedRowText,
  fixedRowText,
  type SseRowTextLifecycle,
  type SseStreamEndedBy,
} from './sse-timeline-row-text';

export type { SseStreamEndedBy } from './sse-timeline-row-text';

const { Text } = Typography;

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
const PREVIEW_MAX_CHARS = 400;

/** Pinned border-box height of every single-line row (event, group
 *  header, lifecycle) — the virtual window's arithmetic depends on
 *  heights being exact by construction. */
const SINGLE_ROW_PX = 28;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

export interface SseListLifecycle extends SseRowTextLifecycle {
  /** Session-only head-arrival time; absent for re-opened saved bodies. */
  connectedAt?: number;
  endedAt?: number;
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

/** The lens — `lifecycle` hides every event so the log reads as its
 *  connection story alone. */
type LensFilter = 'all' | 'lifecycle';

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. */
type ListEntry =
  | { key: string; kind: 'ended' | 'connected' | 'waiting' | 'noMatches' }
  | { key: string; kind: 'header'; name: string; count: number; collapsed: boolean }
  /** "Show N older events" at a windowed group's older edge; the
   *  un-windowed state's re-window action lives on the group header. */
  | { key: string; kind: 'groupMore'; name: string; hidden: number }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number };

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
const badgeNameCache = new WeakMap<SseEventItem, string>();

/** The item's group identity — the grouping pass walks the WHOLE log
 *  per commit (the first-appearance anchor), so it's cached. */
function badgeNameOf(item: SseEventItem): string {
  const hit = badgeNameCache.get(item);
  if (hit !== undefined) return hit;
  const name = badgeOf(item.record).name;
  badgeNameCache.set(item, name);
  return name;
}

const previewCache = new WeakMap<SseEventItem, string>();

/** The row's preview — the block's `data:` line values VERBATIM from
 *  the wire text, joined by a space (a multi-line payload reads as its
 *  lines side by side); a comment-only row shows its comment. Never a
 *  re-print: the formatted payload is the expanded viewer's. */
function previewOf(item: SseEventItem): string {
  const hit = previewCache.get(item);
  if (hit !== undefined) return hit;
  const dataLines: string[] = [];
  for (const line of item.raw.split('\n')) {
    if (line === 'data') dataLines.push('');
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).startsWith(' ') ? line.slice(6) : line.slice(5));
  }
  let text: string;
  if (dataLines.length > 0) {
    text = dataLines.join(' ');
  } else {
    const comment = item.record.comment;
    text = typeof comment === 'string' ? comment : item.raw;
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

const searchCache = new WeakMap<SseEventItem, string>();

/** The search haystack — the words the row and its viewer show: the
 *  badge name plus the FULL printed payload (the preview is capped; a
 *  match deep in a long event still counts), lowercased once per item. */
function searchTextOf(item: SseEventItem): string {
  const hit = searchCache.get(item);
  if (hit !== undefined) return hit;
  const text = `${badgeNameOf(item)}\n${viewerContentOf(item).value}`.toLowerCase();
  searchCache.set(item, text);
  return text;
}

/** The event row's hover cluster left of the time — copy the payload
 *  as the viewer shows it (the one-second check is the row's own),
 *  and the event's facts behind the (i); clicks never reach the row
 *  toggle. */
const EventRowActions: React.FC<{ item: SseEventItem }> = ({ item }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    },
    [],
  );
  return (
    <span
      className="oh-stream-row-actions"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Tooltip title={t('workbench.editors.request.response.sse.copyEvent')}>
        <Button
          size="small"
          type="text"
          icon={
            copied ? (
              <CheckOutlined style={{ fontSize: 12, color: token.colorSuccess }} />
            ) : (
              <CopyOutlined style={{ fontSize: 12 }} />
            )
          }
          aria-label={t('workbench.editors.request.response.sse.copyEvent')}
          data-testid="oh-sse-copy-event"
          onClick={(event) => {
            // Drop the click focus so the cluster fades with the
            // pointer — the ring stays for keyboard users only.
            event.currentTarget.blur();
            void navigator.clipboard.writeText(viewerContentOf(item).value).then(() => {
              setCopied(true);
              if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
              copiedTimerRef.current = setTimeout(() => setCopied(false), 1000);
            });
          }}
        />
      </Tooltip>
      <Popover content={<EventInfo item={item} />} placement="left">
        <Button
          size="small"
          type="text"
          icon={<InfoCircleOutlined style={{ fontSize: 12 }} />}
          aria-label={t('workbench.editors.request.response.sse.eventInfoAria')}
          data-testid="oh-sse-event-info"
        />
      </Popover>
    </span>
  );
};

/** The block's bytes as the classic dump — computed on first open. */
const hexCache = new WeakMap<SseEventItem, HexDump>();
function hexDumpOf(item: SseEventItem): HexDump {
  const hit = hexCache.get(item);
  if (hit !== undefined) return hit;
  const dump = buildHexDump(new TextEncoder().encode(item.raw));
  hexCache.set(item, dump);
  return dump;
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
function formatEventTime(ts: number): string {
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
  const [lensFilter, setLensFilter] = useState<LensFilter>('all');
  // Several names at once; empty = every name.
  const [nameFilter, setNameFilter] = useState<string[]>([]);
  // The menus are controlled: the single choices close on a pick, the
  // View menu keeps open so several knobs flip in one visit; only the
  // trigger and outside clicks change visibility otherwise, and a
  // trigger's tooltip suppresses while its menu shows.
  const [lensMenuOpen, setLensMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [wrapLines, setWrapLines] = useState(true);
  const viewerModes = useTimelineViewerModes();
  // Sort direction and grouping are SETTINGS — global, user-owned,
  // written by this toolbar and the Settings page alike; a Send/Stop
  // remount never resets them.
  const [newestFirst, setNewestFirst] = useSetting('requests.sseEventsNewestFirst');
  const [groupByName, setGroupByName] = useSetting('requests.sseEventsGroupByName');
  // Watch-several-groups-at-once: each group shows only its N newest
  // rows (the window slides as events arrive); 0 = no limit.
  const [groupRowLimit, setGroupRowLimit] = useSetting('requests.sseEventsGroupRowLimit');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // Per-group escape hatch from the row-limit window — display-local
  // (like collapse), so lifting one group's window never touches the
  // global setting or the other groups.
  const [unwindowedGroups, setUnwindowedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // The group whose rows span the viewport top — its header pins as an
  // overlay (a CSS-sticky header would virtualize out of the DOM), so
  // the group identity + total stay visible and collapsible mid-scroll.
  const [stickyGroup, setStickyGroup] = useState<string | null>(null);
  // Right inset for the sticky overlay — measured scrollbar width (+
  // the scroller's border), so the overlay never covers the thumb.
  const [stickyRightInset, setStickyRightInset] = useState(1);

  // When the user has scrolled away from the edge where new rows land
  // and more events commit, a jump pill floats over the list instead
  // of the content moving under them.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const awayFromNewEdgeRef = useRef(false);
  const prevCountRef = useRef(count);
  // Identity anchor recorded on every scroll: the entry under the
  // viewport top + the offset into it — restored after list mutations
  // so content never shifts under a reading user.
  const anchorRef = useRef<{ key: string; offset: number } | null>(null);
  const [hasNewEvents, setHasNewEvents] = useState(false);

  const jumpToNewest = (toNewest: boolean) => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = toNewest ? 0 : el.scrollHeight;
    awayFromNewEdgeRef.current = false;
    anchorRef.current = null;
    setHasNewEvents(false);
  };

  // A new event log (new send, new snapshot) resets the display state —
  // indexes are positional in the log the state was minted against.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items identity IS the reset signal.
  useEffect(() => {
    setSearch('');
    setLensFilter('all');
    setNameFilter([]);
    setClearedCount(0);
    setExpanded(new Set<number>());
    setCollapsedGroups(new Set<string>());
    setUnwindowedGroups(new Set<string>());
    setHasNewEvents(false);
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
    if (grew && awayFromNewEdgeRef.current) setHasNewEvents(true);
  }, [count]);

  // The NAME filter's option set — every distinct event name the log
  // has seen, in first-appearance order (display-side; never stored).
  const seenNames = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const name = badgeNameOf(items[i]);
      if (seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
    return names;
  }, [items, count]);

  // Every event index passing the filters, newest-first — one linear
  // pass of primitive work per commit/keystroke. Search is a LOOKUP: it
  // matches the words every row shows — an event's badge name and FULL
  // printed payload, a lifecycle row's rendered line — and hides the
  // rest whatever their kind. The lens and the name filter gate EVENT
  // rows only — under them the lifecycle rows stay as the log's
  // skeleton.
  const needle = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const names = nameFilter.length > 0 ? new Set(nameFilter) : null;
    const rows: number[] = [];
    if (lensFilter === 'lifecycle') return rows;
    for (let i = count - 1; i >= clearedCount; i--) {
      if (names !== null && !names.has(badgeNameOf(items[i]))) continue;
      if (needle !== '' && !searchTextOf(items[i]).includes(needle)) continue;
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, needle, lensFilter, nameFilter]);

  // The fixed rows under a search — each shows only when its words
  // carry the needle (the same words the row paints).
  const fixedShown = useMemo(() => {
    const shown = (kind: keyof typeof fixedRowText): boolean =>
      needle === '' || fixedRowText[kind](lifecycle, t).toLowerCase().includes(needle);
    return { connected: shown('connected'), ended: shown('ended') };
  }, [needle, lifecycle, t]);

  const displayRows = useMemo(
    () => (newestFirst ? visibleRows : [...visibleRows].reverse()),
    [visibleRows, newestFirst],
  );

  // Partition the display rows under event-name headers. Group order
  // ANCHORS to each name's first appearance in the log — a group never
  // trades places once minted (new events only change its contents);
  // only a brand-new name mints a group, at the new edge. The sort
  // direction flips the reading of that fixed order, and rows within a
  // group keep the direction's arrival order.
  const groups = useMemo(() => {
    if (!groupByName) return null;
    const firstSeen = new Map<string, number>();
    for (let i = clearedCount; i < count; i++) {
      const name = badgeNameOf(items[i]);
      if (!firstSeen.has(name)) firstSeen.set(name, i);
    }
    const byName = new Map<string, number[]>();
    for (const index of displayRows) {
      const name = badgeNameOf(items[index]);
      const bucket = byName.get(name);
      if (bucket) bucket.push(index);
      else byName.set(name, [index]);
    }
    const anchored = [...byName.entries()].sort((a, b) => (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0));
    return newestFirst ? anchored.reverse() : anchored;
  }, [displayRows, groupByName, items, count, clearedCount, newestFirst]);

  const filtering = search.trim() !== '' || lensFilter !== 'all' || nameFilter.length > 0;
  const live = lifecycle.endedBy === undefined;

  // The flat display list the virtual window runs over — lifecycle
  // rows at their chronological edges, headers + rows (+ expanded
  // viewers) between — plus each group's entry-index range (the sticky
  // header's lookup). O(display rows) pushes per commit. A group row
  // limit keeps only the N NEWEST members mounted — the window slides
  // as events arrive, so several groups stay watchable at once; the
  // header count keeps the group's real total.
  const { entries, groupRanges } = useMemo(() => {
    const out: ListEntry[] = [];
    const ranges: Array<{ name: string; startEntry: number; endEntry: number }> = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const pushConnected = () => {
      if (fixedShown.connected) out.push({ key: 'connected', kind: 'connected' });
    };
    const pushEnded = () => {
      if (lifecycle.endedBy !== undefined && fixedShown.ended) out.push({ key: 'ended', kind: 'ended' });
    };
    if (newestFirst) pushEnded();
    else pushConnected();
    if (live && count === 0) out.push({ key: 'waiting', kind: 'waiting' });
    // A search that found a lifecycle row found something — the notice
    // is for a filter that leaves NOTHING to read. Under Lifecycle only
    // the empty event set is the point, not a miss.
    const lifecycleMatched =
      needle !== '' && (fixedShown.connected || (lifecycle.endedBy !== undefined && fixedShown.ended));
    if (
      filtering &&
      lensFilter !== 'lifecycle' &&
      displayRows.length === 0 &&
      count > clearedCount &&
      !lifecycleMatched
    ) {
      out.push({ key: 'none', kind: 'noMatches' });
    }
    if (groups !== null) {
      for (const [name, indexes] of groups) {
        const startEntry = out.length;
        const collapsed = collapsedGroups.has(name);
        out.push({ key: `h${name}`, kind: 'header', name, count: indexes.length, collapsed });
        if (!collapsed) {
          // displayRows order puts a group's newest member first in
          // newest-first and last in oldest-first — the limit window
          // slices the newest end either way. A group the user
          // un-windowed shows everything; the re-window action rides
          // its header.
          const windowed = groupRowLimit > 0 && !unwindowedGroups.has(name) && indexes.length > groupRowLimit;
          const shown = windowed
            ? newestFirst
              ? indexes.slice(0, groupRowLimit)
              : indexes.slice(-groupRowLimit)
            : indexes;
          const more: ListEntry | null = windowed
            ? { key: `m${name}`, kind: 'groupMore', name, hidden: indexes.length - shown.length }
            : null;
          // The toggle sits at the group's OLDER edge — where the
          // hidden rows would continue: below the shown tail in
          // newest-first, right under the header in oldest-first.
          if (!newestFirst && more) out.push(more);
          for (const index of shown) pushRow(index);
          if (newestFirst && more) out.push(more);
        }
        ranges.push({ name, startEntry, endEntry: out.length });
      }
    } else {
      for (const index of displayRows) pushRow(index);
    }
    if (newestFirst) pushConnected();
    else pushEnded();
    return { entries: out, groupRanges: ranges };
  }, [
    newestFirst,
    lifecycle.endedBy,
    fixedShown,
    needle,
    live,
    count,
    clearedCount,
    filtering,
    lensFilter,
    displayRows,
    groups,
    expanded,
    collapsedGroups,
    groupRowLimit,
    unwindowedGroups,
  ]);

  const heights = useMemo(() => entries.map((e) => (e.kind === 'viewer' ? VIEWER_PX : SINGLE_ROW_PX)), [entries]);

  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx, prefix } = useVirtualRowWindow(
    scrollerRef,
    heights,
    entries.length > 0,
  );

  // Restore the identity anchor before paint after every list change:
  // following the new edge pins to it; a reading user keeps the row
  // under their viewport top exactly where it was. Skipped on an
  // unlaid-out (jsdom) viewport, where everything renders anyway.
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
    setStickyGroup(range ? range.name : null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateStickyGroup derives from entries/prefix, which ARE the deps.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) updateStickyGroup(el);
  }, [entries, prefix]);

  const toggleGroupWindow = (name: string) => {
    setUnwindowedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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

  const singleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: SINGLE_ROW_PX,
    boxSizing: 'border-box',
    padding: '0 10px',
    borderBottom: STREAM_HAIRLINE,
    overflow: 'hidden',
  };

  const lifecycleRowStyle: React.CSSProperties = {
    ...singleRowStyle,
    color: token.colorTextSecondary,
    fontSize: 12,
  };

  // The quiet badge tone — the spec's default `message` in the tertiary
  // text, a `comment` the same and italic (not an event at all); a
  // name the wire carried keeps its color.
  const quietBadge = (kind: ReturnType<typeof badgeOf>['kind']): React.CSSProperties =>
    kind === 'named'
      ? {}
      : { color: token.colorTextTertiary, ...(kind === 'comment' ? { fontStyle: 'italic' } : {}) };

  // Lifecycle glyph — centered in the event badge's 18px slot so every
  // row's leading mark sits on ONE column, drawn at the size the badge
  // reads at (the circle's footprint ≈ the tinted box).
  const lifecycleGlyph = (icon: React.ReactNode): React.ReactNode => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        flexShrink: 0,
        fontSize: 15,
      }}
    >
      {icon}
    </span>
  );

  // Boxed event badge — ↓ blue on its tinted background (the WS / gRPC
  // received anatomy); a stream has one direction, so every event row
  // wears it.
  const eventBadge: React.ReactNode = (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 4,
        flexShrink: 0,
        background: token.colorPrimaryBg,
      }}
    >
      <ArrowDownOutlined style={{ fontSize: 11, color: token.colorTextSecondary }} />
    </span>
  );

  // The ended row's glyph by end kind — neutral for every end the
  // stream or the user chose; the failure alone wears the error tint.
  const endedGlyph = (endedBy: SseStreamEndedBy): React.ReactNode => {
    switch (endedBy) {
      case 'end':
      case 'stop':
        return <DisconnectOutlined aria-hidden style={{ color: token.colorTextTertiary }} />;
      case 'cap':
        return <InfoCircleOutlined aria-hidden style={{ color: token.colorTextTertiary }} />;
      case 'timeout':
        return <ClockCircleOutlined aria-hidden style={{ color: token.colorTextTertiary }} />;
      case 'error':
        return <CloseCircleOutlined aria-hidden style={{ color: token.colorError }} />;
      default: {
        const _exhaustive: never = endedBy;
        void _exhaustive;
        return null;
      }
    }
  };

  /** First display index of a group — the badge KIND for its header
   *  (named/comment styling) comes from any member; the group count is
   *  small, so the lookup stays trivial. */
  const groupsHeadIndex = (name: string): number => {
    const found = groups?.find(([groupName]) => groupName === name);
    return found ? found[1][0] : 0;
  };

  /** One group-header row — shared by the in-list entry and the sticky
   *  overlay (same anatomy, same collapse action, distinct testid). */
  const renderGroupHeaderRow = (
    name: string,
    memberCount: number,
    collapsed: boolean,
    testid: string,
    key?: string,
  ): React.ReactNode => {
    const headBadge = badgeOf(items[groupsHeadIndex(name)].record);
    return (
      <div
        key={key}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        data-testid={testid}
        onClick={() => toggleGroup(name)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleGroup(name);
          }
        }}
        style={{ ...singleRowStyle, background: token.colorFillQuaternary, cursor: 'pointer' }}
      >
        <CaretRightOutlined
          aria-hidden
          rotate={collapsed ? 0 : 90}
          style={{ fontSize: 10, color: token.colorTextTertiary }}
        />
        <Tag
          color={headBadge.kind === 'named' ? badgeColor(name) : undefined}
          style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0, ...quietBadge(headBadge.kind) }}
        >
          {name}
        </Tag>
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.request.response.sse.eventCount', { count: memberCount })}
        </Text>
        {/* Re-window action for an un-windowed group — a group-level
            mode switch, so it rides the header (beside the total, past
            a divider) rather than a positional row. Clicks stay off
            the header's collapse action. */}
        {!collapsed && groupRowLimit > 0 && unwindowedGroups.has(name) && memberCount > groupRowLimit && (
          <>
            <span aria-hidden style={{ width: 1, height: 14, background: token.colorBorderSecondary }} />
            <span
              role="button"
              tabIndex={0}
              data-testid="oh-sse-group-rewindow"
              onClick={(event) => {
                event.stopPropagation();
                toggleGroupWindow(name);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleGroupWindow(name);
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
  };

  const renderEntry = (entry: ListEntry): React.ReactNode => {
    switch (entry.kind) {
      case 'ended': {
        if (lifecycle.endedBy === undefined) return null;
        return (
          <div
            key={entry.key}
            data-testid="oh-sse-lifecycle-row"
            data-ended-by={lifecycle.endedBy}
            style={{
              ...lifecycleRowStyle,
              ...(lifecycle.endedBy === 'error' ? { color: token.colorError } : {}),
            }}
          >
            {lifecycleGlyph(endedGlyph(lifecycle.endedBy))}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endedRowText(lifecycle, t)}
            </span>
            {lifecycle.endedAt !== undefined && (
              <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
                {formatEventTime(lifecycle.endedAt)}
              </span>
            )}
          </div>
        );
      }
      case 'connected':
        return (
          <div key={entry.key} data-testid="oh-sse-connected-row" style={lifecycleRowStyle}>
            {lifecycleGlyph(<CheckCircleOutlined aria-hidden style={{ color: token.colorSuccess }} />)}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {connectedRowText(lifecycle, t)}
            </span>
            {lifecycle.connectedAt !== undefined && (
              <span style={{ ...cellFont, fontSize: 11, marginLeft: 'auto', color: token.colorTextTertiary }}>
                {formatEventTime(lifecycle.connectedAt)}
              </span>
            )}
          </div>
        );
      case 'waiting':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.request.response.sse.waiting')}</span>
          </div>
        );
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.request.response.sse.noMatches')}</span>
          </div>
        );
      case 'header':
        return renderGroupHeaderRow(entry.name, entry.count, entry.collapsed, 'oh-sse-group-header', entry.key);
      case 'groupMore':
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            className="oh-stream-row"
            data-testid="oh-sse-group-more"
            onClick={() => toggleGroupWindow(entry.name)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleGroupWindow(entry.name);
              }
            }}
            style={{ ...singleRowStyle, cursor: 'pointer', fontSize: 12, color: token.colorPrimary }}
          >
            {t('shared.timelineGroup.showOlder', { count: entry.hidden })}
          </div>
        );
      case 'row': {
        const item = items[entry.index];
        const badge = badgeOf(item.record);
        const isExpanded = expanded.has(entry.index);
        const ts = timestamps?.[entry.index];
        return (
          <div
            key={entry.key}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            className="oh-stream-row"
            data-testid="oh-sse-event-row"
            onClick={() => toggleRow(entry.index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleRow(entry.index);
              }
            }}
            style={{ ...singleRowStyle, cursor: 'pointer' }}
          >
            {eventBadge}
            <Tag
              data-testid="oh-sse-event-badge"
              data-badge-kind={badge.kind}
              color={badge.kind === 'named' ? badgeColor(badge.name) : undefined}
              style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0, ...quietBadge(badge.kind) }}
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
            <EventRowActions item={item} />
            {ts !== undefined && (
              <span
                data-testid="oh-sse-event-time"
                style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
              >
                {formatEventTime(ts)}
              </span>
            )}
          </div>
        );
      }
      case 'viewer': {
        const item = items[entry.index];
        const viewer = viewerContentOf(item);
        return (
          <div key={entry.key} data-testid="oh-sse-event-viewer">
            <TimelineMessageViewer
              text={item.raw}
              prettyText={viewer.value}
              defaultFormat={viewer.language}
              hexDump={() => hexDumpOf(item)}
              base64={() => encodeBase64Bytes(new TextEncoder().encode(item.raw))}
              mode={viewerModes.modeOf(entry.index, false)}
              onModeChange={(mode) => viewerModes.setMode(entry.index, mode)}
              wrapLines={wrapLines}
              onWrapLinesChange={setWrapLines}
              actionsRef={viewerModes.actionsOf(entry.index)}
              testIdPrefix="oh-sse"
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

  // The pinned header overlay's source group — resolved fresh so the
  // count and collapse state track the live list.
  const stickySource = stickyGroup !== null && groups !== null ? groups.find(([n]) => n === stickyGroup) : undefined;

  // The lens options — the menu rows and the trigger's label are the
  // same words, so the trigger reads the filter in force.
  const lensOptions: ReadonlyArray<{ value: LensFilter; icon: React.ReactNode | null; label: string }> = [
    { value: 'all', icon: null, label: t('workbench.editors.request.response.sse.filterAllEvents') },
    {
      value: 'lifecycle',
      icon: <InfoCircleOutlined />,
      label: t('workbench.editors.request.response.sse.filterLifecycle'),
    },
  ];
  const activeLens = lensOptions.find((option) => option.value === lensFilter) ?? lensOptions[0];
  const menuRow = (icon: React.ReactNode | null, label: string): React.ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {label}
    </span>
  );
  // The View menu's on-knobs ride antd's selection plane (several at
  // once); the Rows per group submenu is the one single choice.
  const viewSelectedKeys = [...(groupByName ? ['group'] : []), `group-limit-${groupRowLimit}`];

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
          style={{ maxWidth: 220 }}
        />
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          open={lensMenuOpen}
          onOpenChange={(open, info) => {
            if (info.source === 'menu') return;
            setLensMenuOpen(open);
          }}
          menu={{
            rootClassName: 'oh-choice-menu',
            selectable: true,
            selectedKeys: [lensFilter],
            items: lensOptions.map((option) => ({
              key: option.value,
              label: menuRow(option.icon, option.label),
              onClick: () => {
                setLensFilter(option.value);
                setLensMenuOpen(false);
              },
            })),
          }}
        >
          <Tooltip
            title={t('workbench.editors.request.response.sse.eventFilter')}
            placement="bottom"
            open={lensMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              data-testid="oh-sse-lens-filter"
              aria-label={t('workbench.editors.request.response.sse.eventFilter')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {activeLens.icon}
              {activeLens.label}
              <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
            </Button>
          </Tooltip>
        </Dropdown>
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }} data-testid="oh-sse-count">
          {filtering
            ? t('workbench.editors.request.response.sse.eventCountFiltered', {
                shown: visibleRows.length,
                total: count - clearedCount,
              })
            : t('workbench.editors.request.response.sse.eventCount', { count: count - clearedCount })}
        </Text>
        <span style={{ marginLeft: 'auto' }} />
        {seenNames.length > 0 && (
          <Select
            size="small"
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            placeholder={t('workbench.editors.request.response.sse.nameFilterAll')}
            value={nameFilter}
            options={seenNames.map((name) => ({ value: name, label: name }))}
            onChange={(next: string[]) => setNameFilter(next)}
            // Sized by its tags — never a reserved band; the cap collapses
            // the overflow into a count.
            style={{ width: 'auto', minWidth: 180, maxWidth: 340 }}
            data-testid="oh-sse-name-filter"
          />
        )}
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={sortMenuOpen}
          onOpenChange={(open, info) => {
            if (info.source === 'menu') return;
            setSortMenuOpen(open);
          }}
          menu={{
            rootClassName: 'oh-choice-menu',
            selectable: true,
            selectedKeys: [newestFirst ? 'newest' : 'oldest'],
            items: [
              {
                key: 'newest',
                label: t('workbench.editors.request.response.sse.newestFirst'),
                onClick: () => {
                  setNewestFirst(true);
                  setSortMenuOpen(false);
                },
              },
              {
                key: 'oldest',
                label: t('workbench.editors.request.response.sse.oldestFirst'),
                onClick: () => {
                  setNewestFirst(false);
                  setSortMenuOpen(false);
                },
              },
            ],
          }}
        >
          <Tooltip
            title={t('workbench.editors.request.response.sse.sortOrder')}
            placement="bottom"
            open={sortMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              icon={newestFirst ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
              data-testid="oh-sse-sort"
              aria-label={t('workbench.editors.request.response.sse.sortOrder')}
            >
              {t('workbench.editors.request.response.sse.sortBy')}
            </Button>
          </Tooltip>
        </Dropdown>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={viewMenuOpen}
          onOpenChange={(open, info) => {
            // Menu-item clicks keep the popover open — several knobs
            // flip in one visit; only the trigger and outside clicks
            // change visibility.
            if (info.source === 'menu') return;
            setViewMenuOpen(open);
          }}
          menu={{
            rootClassName: 'oh-view-menu',
            selectable: true,
            multiple: true,
            selectedKeys: viewSelectedKeys,
            items: [
              {
                type: 'group',
                label: t('workbench.editors.request.response.sse.viewGroup'),
                children: [
                  {
                    key: 'group',
                    label: t('workbench.editors.request.response.sse.groupByName'),
                    onClick: () => setGroupByName(!groupByName),
                  },
                  {
                    key: 'group-limit',
                    label: t('workbench.editors.request.response.sse.rowsPerGroup'),
                    disabled: !groupByName,
                    children: [0, 1, 3, 5, 10].map((n) => ({
                      key: `group-limit-${n}`,
                      label: n === 0 ? t('workbench.editors.request.response.sse.noLimit') : String(n),
                      onClick: () => setGroupRowLimit(n),
                    })),
                  },
                ],
              },
            ],
          }}
        >
          <Tooltip
            title={t('workbench.editors.request.response.sse.viewTooltip')}
            placement="bottom"
            open={viewMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              icon={<ControlOutlined />}
              data-testid="oh-sse-view"
              aria-label={t('workbench.editors.request.response.sse.view')}
            >
              {t('workbench.editors.request.response.sse.view')}
            </Button>
          </Tooltip>
        </Dropdown>
        <Tooltip title={t('workbench.editors.request.response.sse.clearEvents')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            data-testid="oh-sse-clear"
            onClick={() => setClearedCount(count)}
            aria-label={t('workbench.editors.request.response.sse.clearEvents')}
          >
            {t('workbench.editors.request.response.sse.clear')}
          </Button>
        </Tooltip>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {stickySource !== undefined && (
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
            {renderGroupHeaderRow(
              stickySource[0],
              stickySource[1].length,
              collapsedGroups.has(stickySource[0]),
              'oh-sse-sticky-header',
            )}
          </div>
        )}
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
            if (away) {
              const idx = entryIndexAt(prefix, el.scrollTop);
              const entry = entries[idx];
              if (entry) anchorRef.current = { key: entry.key, offset: el.scrollTop - prefix[idx] };
            } else {
              anchorRef.current = null;
              setHasNewEvents(false);
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
            // Rows separate by their own hairlines — no frame around the
            // list.
          }}
        >
          <div aria-hidden style={{ height: topPadPx }} />
          {entries.slice(start, end).map((entry, i) => (
            <StreamLastRow key={entry.key} last={start + i === entries.length - 1}>
              {renderEntry(entry)}
            </StreamLastRow>
          ))}
          <div aria-hidden style={{ height: bottomPadPx }} />
        </div>
      </div>
    </div>
  );
};

export default ResponseSseEventList;

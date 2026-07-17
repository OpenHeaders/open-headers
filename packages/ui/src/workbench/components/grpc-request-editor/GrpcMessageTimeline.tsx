/**
 * GrpcMessageTimeline — the message-list surface for streaming gRPC
 * calls, ONE list across both phases: live (fed from `grpcStreamEvent`
 * frames while the invoke is in flight) and materialized (fed from the
 * snapshot's direction-tagged frames, session timestamps joined
 * positionally). A SIBLING of the SSE event list on the same shared
 * recipes — `useVirtualRowWindow`, pinned row heights, append-only
 * item identity, jump pill — and the SSE list's row/toolbar anatomy:
 * search box + message count on the left, controls on the right; rows
 * read glyph · name chip · preview · right-aligned session time. The
 * gRPC-specific parts stay: direction glyphs (↑ sent / ↓ received), a
 * direction filter, and lifecycle rows. The name chip is the frame's
 * DECLARED type — the rpc's request type for ↑, response type for ↓ —
 * on the stable badge palette; the wire-grammar `message` fallback
 * (untranslated, the SSE precedent) covers an unresolved method. Chip
 * names join the search haystack alongside the decoded previews.
 *
 * The timeline is ONE event log in true call order: "Request sent" and
 * "Call completed / stopped / failed" sit at the chronological edges,
 * and "Response received" INTERLEAVES at `lifecycle.headAtMessage` —
 * the executor's recorded count of messages that preceded the response
 * head in call order (a server stream's ↑ request message renders
 * BEFORE the head; a bidi call's later ↑ messages after it). The
 * position is recorded truth riding the head event and the capture,
 * never inferred display-side.
 *
 * Sort and grouping are the SSE list's anatomy on gRPC's own
 * `requests.grpcMessages*` SETTINGS (global, toolbar-written — the
 * choices survive Invoke/Cancel remounts): newest-first by default
 * with an arrival-order flip; "Group by message type" is CLUSTERING,
 * not sorting — rows partition under collapsible type headers
 * (arrival order intact within each group, group order ANCHORED to
 * first appearance), an optional per-group row limit keeps each
 * group's N newest rows watchable (headers keep real totals), and the
 * group spanning the viewport top pins its header as a clickable
 * sticky overlay. Grouped mode is not a timeline, so the head row
 * joins "Request sent" at the chronological edge instead of
 * interleaving.
 *
 * Rows expand into a mini viewer over the frame's decoded payload —
 * schema-driven canonical JSON against the rpc's request type (↑) or
 * response type (↓), the structural decode when the type doesn't
 * resolve, raw base64 otherwise (`deriveGrpcFrameView`, the F5.2
 * display-only posture). Search, filter and Clear are display-only —
 * the capture is never touched. Per-item derivations cache on item
 * identity and reset when the registry or the resolved types change;
 * group identity is a closed function of the row's direction (two chip
 * identities), so the grouping pass is one linear walk of primitive
 * work. Timestamps are session-only (the ratified Phase E law):
 * absent — on a re-opened saved exchange — rows simply render no time.
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  DisconnectOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import type { ProtoRegistry } from '@openheaders/core/proto';
import { Button, ConfigProvider, Dropdown, Input, Segmented, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import CodeEditor from '../shared/CodeEditor';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';
import { deriveGrpcFrameView, type GrpcMessageView } from './response-decode';

const { Text } = Typography;

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
const PREVIEW_MAX_CHARS = 400;

/** Pinned border-box height of every single-line row (message, group
 *  header, lifecycle) — the virtual window's arithmetic depends on
 *  heights being exact by construction. */
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

/** How the call ended — drives the ended lifecycle row. */
export type GrpcTimelineEndedBy = 'complete' | 'stop' | 'error';

export interface GrpcTimelineLifecycle {
  /** Session-only invoke-departure time. */
  startedAt?: number;
  /** True once the response head arrived. */
  headArrived: boolean;
  /** Session-only head-arrival time. */
  connectedAt?: number;
  /** Messages preceding the response head in CALL order — where the
   *  "Response received" row interleaves. Recorded by the executor
   *  (head event / snapshot / capture); absent reads as 0. */
  headAtMessage?: number;
  /** Absent while frames are still arriving — the live phase. */
  endedBy?: GrpcTimelineEndedBy;
  endedAt?: number;
  /** Failure text riding `endedBy: 'error'`. The status code itself
   *  deliberately does NOT ride the ended row — the meta strip's pill
   *  owns it (no duplicate info, the Postman posture). */
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
  | { key: string; kind: 'header'; name: string; count: number; collapsed: boolean }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number };

type DirectionFilter = 'all' | 'up' | 'down';

/** Stable chip palette — the same type name always lands on the same
 *  color within and across calls (the SSE badge recipe). */
const CHIP_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

function chipColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

/** One direction's name chip — the declared type's short name when the
 *  method resolves, the wire-grammar `message` fallback otherwise. */
interface DirectionChip {
  name: string;
  resolved: boolean;
}

function mintChip(qualifiedType: string | null): DirectionChip {
  if (qualifiedType === null || qualifiedType === '') return { name: 'message', resolved: false };
  const lastDot = qualifiedType.lastIndexOf('.');
  return { name: lastDot >= 0 ? qualifiedType.slice(lastDot + 1) : qualifiedType, resolved: true };
}

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
  // Sort-menu visibility is controlled: selecting an option keeps the
  // menu OPEN (the app's popover convention — only an outside click or
  // a trigger re-click closes), and the trigger's tooltip suppresses
  // while the menu shows.
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [wrapLines, setWrapLines] = useState(true);
  // Sort direction and grouping are SETTINGS — global, user-owned,
  // written by this toolbar and the Settings page alike; an Invoke/
  // Cancel remount never resets them.
  const [newestFirst, setNewestFirst] = useSetting('requests.grpcMessagesNewestFirst');
  const [groupByType, setGroupByType] = useSetting('requests.grpcMessagesGroupByType');
  // Watch-several-groups-at-once: each group shows only its N newest
  // rows (the window slides as messages arrive); 0 = no limit.
  const [groupRowLimit, setGroupRowLimit] = useSetting('requests.grpcMessagesGroupRowLimit');
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set<string>());
  // The group whose rows span the viewport top — its header pins as an
  // overlay (a CSS-sticky header would virtualize out of the DOM), so
  // the group identity + total stay visible and collapsible mid-scroll.
  const [stickyGroup, setStickyGroup] = useState<string | null>(null);

  const derive = useMemo(
    () => makeFrameDerivations(registry, inputType, outputType),
    [registry, inputType, outputType],
  );

  // Per-direction name chips — a closed function of the resolved rpc
  // types, so every ↑ row shares one chip identity and every ↓ row the
  // other. Group identity rides the same two chips.
  const chips = useMemo(
    () => ({ up: mintChip(inputType), down: mintChip(outputType) }),
    [inputType, outputType],
  );

  const chipOf = (item: GrpcTimelineItem): DirectionChip => (item.direction === 'up' ? chips.up : chips.down);

  // When the user has scrolled away from the edge where new rows land
  // and more messages commit, a jump pill floats over the list instead
  // of the content moving under them.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const awayFromNewEdgeRef = useRef(false);
  const prevCountRef = useRef(count);
  // Identity anchor recorded on every scroll — restored after list
  // mutations so content never shifts under a reading user.
  const anchorRef = useRef<{ key: string; offset: number } | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const jumpToNewest = (toNewest: boolean) => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = toNewest ? 0 : el.scrollHeight;
    awayFromNewEdgeRef.current = false;
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
    setCollapsedGroups(new Set<string>());
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
  // commit/keystroke. The haystack is the chip name + the decoded
  // preview.
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const chipNeedles = { up: chips.up.name.toLowerCase(), down: chips.down.name.toLowerCase() };
    const rows: number[] = [];
    for (let i = clearedCount; i < count; i++) {
      const item = items[i];
      const direction = item.direction ?? 'down';
      if (directionFilter !== 'all' && direction !== directionFilter) continue;
      if (
        needle !== '' &&
        !chipNeedles[direction].includes(needle) &&
        !derive.previewOf(item).toLowerCase().includes(needle)
      ) {
        continue;
      }
      rows.push(i);
    }
    return rows;
  }, [items, count, clearedCount, search, directionFilter, derive, chips]);

  const displayRows = useMemo(
    () => (newestFirst ? [...visibleRows].reverse() : visibleRows),
    [visibleRows, newestFirst],
  );

  // Partition the display rows under message-type headers. Group order
  // ANCHORS to each type's first appearance in the log — a group never
  // trades places once minted (new messages only change its contents);
  // only a brand-new type mints a group, at the new edge. The sort
  // direction flips the reading of that fixed order, and rows within a
  // group keep the direction's arrival order.
  const groups = useMemo(() => {
    if (!groupByType) return null;
    const firstSeen = new Map<string, number>();
    for (let i = clearedCount; i < count; i++) {
      const name = chipOf(items[i]).name;
      if (!firstSeen.has(name)) firstSeen.set(name, i);
    }
    const byName = new Map<string, number[]>();
    for (const index of displayRows) {
      const name = chipOf(items[index]).name;
      const bucket = byName.get(name);
      if (bucket) bucket.push(index);
      else byName.set(name, [index]);
    }
    const anchored = [...byName.entries()].sort((a, b) => (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0));
    return newestFirst ? anchored.reverse() : anchored;
    // biome-ignore lint/correctness/useExhaustiveDependencies: chipOf derives from chips, which IS a dep.
  }, [displayRows, groupByType, items, count, clearedCount, newestFirst, chips]);

  const filtering = search.trim() !== '' || directionFilter !== 'all';
  const live = lifecycle.endedBy === undefined;

  // The flat display list the virtual window runs over. The timeline
  // is ONE event log: ungrouped, "Response received" interleaves at
  // the recorded head position among the rows (flipping with the
  // sort); grouped mode is clustering, so the head row joins "Request
  // sent" at the chronological edge instead. Waiting/no-match notices
  // sit at the edge new rows land on. O(display rows) pushes per
  // commit; each group's entry-index range feeds the sticky header.
  const { entries, groupRanges } = useMemo(() => {
    const out: ListEntry[] = [];
    const ranges: Array<{ name: string; startEntry: number; endEntry: number }> = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const headAt = lifecycle.headArrived ? (lifecycle.headAtMessage ?? 0) : null;
    const notice: ListEntry | null =
      live && count === 0
        ? { key: 'waiting', kind: 'waiting' }
        : filtering && displayRows.length === 0 && count > clearedCount
          ? { key: 'none', kind: 'noMatches' }
          : null;

    // Top chronological edge.
    if (newestFirst) {
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
      if (notice) out.push(notice);
    } else {
      out.push({ key: 'sent', kind: 'sent' });
      if (groups !== null && headAt !== null) out.push({ key: 'connected', kind: 'connected' });
    }

    if (groups !== null) {
      for (const [name, indexes] of groups) {
        const startEntry = out.length;
        const collapsed = collapsedGroups.has(name);
        out.push({ key: `h${name}`, kind: 'header', name, count: indexes.length, collapsed });
        if (!collapsed) {
          // displayRows order puts a group's newest member first in
          // newest-first and last in oldest-first — the limit window
          // slices the newest end either way.
          const shown =
            groupRowLimit > 0
              ? newestFirst
                ? indexes.slice(0, groupRowLimit)
                : indexes.slice(-groupRowLimit)
              : indexes;
          for (const index of shown) pushRow(index);
        }
        ranges.push({ name, startEntry, endEntry: out.length });
      }
    } else {
      // One event log in call order: walk ascending, drop the head row
      // where the executor recorded it, then read the whole sequence
      // in the sort direction.
      const tokens: Array<number | 'connected'> = [];
      let connectedPushed = false;
      for (const index of visibleRows) {
        if (headAt !== null && !connectedPushed && index >= headAt) {
          tokens.push('connected');
          connectedPushed = true;
        }
        tokens.push(index);
      }
      if (headAt !== null && !connectedPushed) tokens.push('connected');
      if (newestFirst) tokens.reverse();
      for (const token of tokens) {
        if (token === 'connected') out.push({ key: 'connected', kind: 'connected' });
        else pushRow(token);
      }
    }

    // Bottom chronological edge.
    if (newestFirst) {
      if (groups !== null && headAt !== null) out.push({ key: 'connected', kind: 'connected' });
      out.push({ key: 'sent', kind: 'sent' });
    } else {
      if (notice) out.push(notice);
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
    }
    return { entries: out, groupRanges: ranges };
  }, [
    newestFirst,
    lifecycle.headArrived,
    lifecycle.headAtMessage,
    lifecycle.endedBy,
    live,
    count,
    clearedCount,
    filtering,
    visibleRows,
    displayRows,
    groups,
    expanded,
    collapsedGroups,
    groupRowLimit,
  ]);

  const heights = useMemo(() => entries.map((e) => (e.kind === 'viewer' ? VIEWER_PX : SINGLE_ROW_PX)), [entries]);

  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx, prefix } = useVirtualRowWindow(
    scrollerRef,
    heights,
    entries.length > 0,
  );

  // Restore the identity anchor before paint after every list change:
  // following the new edge pins to it (top for newest-first, bottom
  // for oldest-first); a reading user keeps the row under their
  // viewport top exactly where it was. Skipped on an unlaid-out
  // (jsdom) viewport, where everything renders anyway.
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
    const idx = entryIndexAt(prefix, el.scrollTop);
    const range = groupRanges.find((r) => idx >= r.startEntry && idx < r.endEntry);
    setStickyGroup(range ? range.name : null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateStickyGroup derives from entries/prefix, which ARE the deps.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) updateStickyGroup(el);
  }, [entries, prefix]);

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

  const chipTag = (chip: DirectionChip, testid: string): React.ReactNode => (
    <Tag
      data-testid={testid}
      color={chip.resolved ? chipColor(chip.name) : undefined}
      style={{
        marginInlineEnd: 0,
        fontSize: 11,
        lineHeight: '18px',
        flexShrink: 0,
        ...(chip.resolved ? {} : { fontStyle: 'italic', color: token.colorTextTertiary }),
      }}
    >
      {chip.name}
    </Tag>
  );

  /** A group's chip identity — resolved styling follows the direction
   *  chip carrying that name. */
  const groupChip = (name: string): DirectionChip =>
    chips.up.name === name ? chips.up : chips.down.name === name ? chips.down : { name, resolved: true };

  /** One group-header row — shared by the in-list entry and the sticky
   *  overlay (same anatomy, same collapse action, distinct testid). */
  const renderGroupHeaderRow = (
    name: string,
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
      {chipTag(groupChip(name), 'grpc-timeline-group-badge')}
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {t('workbench.editors.grpc.timeline.messageCount', { count: memberCount })}
      </Text>
    </div>
  );

  const renderEntry = (entry: ListEntry): React.ReactNode => {
    switch (entry.kind) {
      case 'sent':
        return (
          <div key={entry.key} data-testid="grpc-timeline-sent-row" style={lifecycleRowStyle}>
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('workbench.editors.grpc.timeline.requestSent')}
            </span>
            {lifecycleTime(lifecycle.startedAt)}
          </div>
        );
      case 'connected':
        return (
          <div key={entry.key} data-testid="grpc-timeline-connected-row" style={lifecycleRowStyle}>
            <InfoCircleOutlined aria-hidden style={{ fontSize: 11, color: token.colorTextTertiary }} />
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
            {lifecycle.endedBy === 'complete' ? (
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
            <span>{t('workbench.editors.grpc.timeline.waiting')}</span>
          </div>
        );
      case 'noMatches':
        return (
          <div key={entry.key} style={lifecycleRowStyle}>
            <span>{t('workbench.editors.grpc.timeline.noMatches')}</span>
          </div>
        );
      case 'header':
        return renderGroupHeaderRow(entry.name, entry.count, entry.collapsed, 'grpc-timeline-group-header', entry.key);
      case 'row': {
        const item = items[entry.index];
        const up = item.direction === 'up';
        const chip = up ? chips.up : chips.down;
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
            {/* Boxed direction badge — ↑ amber, ↓ blue on their tinted
                backgrounds (the Postman anatomy; the tint tokens adapt
                per theme), so the two directions read apart at a glance. */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 4,
                flexShrink: 0,
                background: up ? token.colorWarningBg : token.colorPrimaryBg,
              }}
            >
              {up ? (
                <ArrowUpOutlined
                  aria-label={t('workbench.editors.grpc.timeline.sentAria')}
                  style={{ fontSize: 11, color: token.colorWarning }}
                />
              ) : (
                <ArrowDownOutlined
                  aria-label={t('workbench.editors.grpc.timeline.receivedAria')}
                  style={{ fontSize: 11, color: token.colorPrimary }}
                />
              )}
            </span>
            {chipTag(chip, 'grpc-timeline-message-badge')}
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

  // The pinned header overlay's source group — resolved fresh so the
  // count and collapse state track the live list.
  const stickySource = stickyGroup !== null && groups !== null ? groups.find(([n]) => n === stickyGroup) : undefined;

  const menuOptionLabel = (label: string, checked: boolean): React.ReactNode => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      {label}
      {checked && <CheckOutlined style={{ color: token.colorPrimary }} />}
    </span>
  );

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
          style={{ maxWidth: 260 }}
        />
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.grpc.timeline.messageCount', { count: count - clearedCount })}
        </Text>
        <span style={{ marginLeft: 'auto' }} />
        {/* Switching the filter is a data change, not a spatial move —
            the thumb slide only delays the row swap, so motion is off
            for this control (the antd motion token, scoped). */}
        <ConfigProvider theme={{ token: { motion: false } }}>
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
        </ConfigProvider>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={sortMenuOpen}
          onOpenChange={(open, info) => {
            // Menu-item clicks keep the popover open; only the trigger
            // and outside clicks change visibility.
            if (info.source === 'menu') return;
            setSortMenuOpen(open);
          }}
          menu={{
            items: [
              {
                key: 'newest',
                label: menuOptionLabel(t('workbench.editors.grpc.timeline.newestFirst'), newestFirst),
                onClick: () => setNewestFirst(true),
              },
              {
                key: 'oldest',
                label: menuOptionLabel(t('workbench.editors.grpc.timeline.oldestFirst'), !newestFirst),
                onClick: () => setNewestFirst(false),
              },
              { type: 'divider' },
              {
                key: 'group',
                label: menuOptionLabel(t('workbench.editors.grpc.timeline.groupByType'), groupByType),
                onClick: () => setGroupByType(!groupByType),
              },
              {
                key: 'group-limit',
                label: t('workbench.editors.grpc.timeline.rowsPerGroup'),
                disabled: !groupByType,
                children: [0, 5, 10, 25, 50].map((n) => ({
                  key: `group-limit-${n}`,
                  label: menuOptionLabel(
                    n === 0 ? t('workbench.editors.grpc.timeline.noLimit') : String(n),
                    groupRowLimit === n,
                  ),
                  onClick: () => setGroupRowLimit(n),
                })),
              },
            ],
          }}
        >
          <Tooltip
            title={t('workbench.editors.grpc.timeline.sortOrder')}
            placement="bottom"
            open={sortMenuOpen ? false : undefined}
          >
            <Button
              size="small"
              type="text"
              icon={<SortAscendingOutlined />}
              data-testid="grpc-timeline-sort"
              aria-label={t('workbench.editors.grpc.timeline.sortOrder')}
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
        {stickySource !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 1,
              right: 1,
              zIndex: 1,
              background: token.colorBgContainer,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              overflow: 'hidden',
            }}
          >
            {renderGroupHeaderRow(
              stickySource[0],
              stickySource[1].length,
              collapsedGroups.has(stickySource[0]),
              'grpc-timeline-sticky-header',
            )}
          </div>
        )}
        {hasNewMessages && (
          <Button
            size="small"
            type="primary"
            shape="round"
            icon={newestFirst ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            data-testid="grpc-timeline-new-messages"
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
            {t('workbench.editors.grpc.timeline.newMessages')}
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

export default GrpcMessageTimeline;

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
 * "Disconnected / Stopped" sit at the chronological edges (a settled
 * pre-open failure renders its classified error row at the new edge
 * instead — expandable to the refused CONNACK's facts when the broker
 * answered one), "Connected"
 * (expandable to the CONNACK facts as key: value rows) sits before the
 * first item, and the
 * subscription lifecycle facts — Subscribed-with-grant /
 * Unsubscribed — and the reconnect-cycle facts — Connection lost /
 * Reconnect attempt / Reconnected with its own CONNACK block — render
 * at their TRUE chronological positions because they ride the same
 * item log as the messages (live Subscribe toggles and auto-reconnect
 * land mid-session).
 *
 * Sort and grouping ride the `requests.mqttMessages*` SETTINGS (global,
 * toolbar-written — the choices survive Connect/Disconnect remounts):
 * "Group by topic" and "Group by direction" are CLUSTERING, not
 * sorting — both on = the COMPOUND (direction, topic) pair, still one
 * header level; group order anchors to first appearance, an optional
 * per-group row limit keeps each group's N newest rows watchable, and
 * the group spanning the viewport top pins its header as a clickable
 * sticky overlay. Grouped mode is not a timeline, so every lifecycle
 * fact that rides the log joins Connected at the chronological edge.
 * Search, the direction filter, the TOPIC filter and Clear are
 * display-only — the capture is never touched. Timestamps are
 * session-only (the ratified law): absent rows simply render no time.
 *
 * This file is the orchestrator: state, the settings, the memoized
 * passes and the scroll plane (the new-edge anchor, the jump pill, the
 * sticky header). The vocabulary and the per-item derivations live in
 * `mqtt-timeline-model.ts`, the pure list passes in
 * `mqtt-timeline-entries.ts`, the strip in `MqttTimelineToolbar.tsx`,
 * the rows in `MqttTimelineEntryRow.tsx` (the row anatomy in
 * `mqtt-timeline-row-parts.tsx`; the group header, shared with the
 * sticky overlay, in `MqttTimelineGroupHeader.tsx`).
 */

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  buildTimelineEntries,
  entryHeights,
  filterVisibleRows,
  fixedRowsShown,
  partitionGroups,
} from './mqtt-timeline-entries';
import {
  entryIndexAt,
  makeMqttFrameDerivations,
  type MqttDirectionFilter,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
} from './mqtt-timeline-model';
import MqttTimelineEntryRow from './MqttTimelineEntryRow';
import MqttTimelineGroupHeader from './MqttTimelineGroupHeader';
import MqttTimelineToolbar from './MqttTimelineToolbar';
import PeerExecuteDisabledNotice, { peerExecuteRefusalKind } from '../shared/PeerExecuteDisabledNotice';
import { StreamLastRow, useTimelineViewerModes } from '../shared/TimelineMessageViewer';

interface MqttMessageTimelineProps {
  /** Item log — append-only during the live phase (the array reference
   *  stays stable; `count` is the committed prefix), the snapshot's
   *  capture once materialized. */
  items: readonly MqttTimelineItem[];
  count: number;
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[];
  lifecycle: MqttTimelineLifecycle;
  /** The session's version lens — scopes the reason-code name space
   *  a reconnected row's CONNACK block renders. */
  v5: boolean;
  /** Events that rolled off the retention window — an honest notice
   *  above the list when non-zero. */
  droppedMessages?: number;
  /** A verification failure's remedy — see the entry row. */
  onTrustCertificate?: () => void;
  trustOfferOpen?: boolean;
}

/** A set toggle — the collapse / un-window / expand sets share it. */
function toggled<T>(prev: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const MqttMessageTimeline: React.FC<MqttMessageTimelineProps> = ({
  items,
  count,
  timestamps,
  lifecycle,
  v5,
  droppedMessages = 0,
  onTrustCertificate,
  trustOfferOpen = false,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<MqttDirectionFilter>('all');
  // Several topics at once; empty = every topic.
  const [topicFilter, setTopicFilter] = useState<string[]>([]);
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  const [connackExpanded, setConnackExpanded] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const viewerModes = useTimelineViewerModes();
  // Sort direction and grouping are SETTINGS — global, user-owned,
  // written by this toolbar and the Settings page alike; a Connect/
  // Disconnect remount never resets them.
  const [newestFirst, setNewestFirst] = useSetting('requests.mqttMessagesNewestFirst');
  const [groupByTopic, setGroupByTopic] = useSetting('requests.mqttMessagesGroupByTopic');
  const [groupByDirection, setGroupByDirection] = useSetting('requests.mqttMessagesGroupByDirection');
  const [groupRowLimit, setGroupRowLimit] = useSetting('requests.mqttMessagesGroupRowLimit');
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

  const derive = useMemo(() => makeMqttFrameDerivations(t('workbench.editors.session.secretHidden')), [t]);

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
    setTopicFilter([]);
    setClearedCount(0);
    setExpanded(new Set<number>());
    setConnackExpanded(false);
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

  const needle = search.trim().toLowerCase();
  const visibleRows = useMemo(
    () => filterVisibleRows({ items, count, clearedCount, needle, directionFilter, topicFilter, derive, t, v5 }),
    [items, count, clearedCount, needle, directionFilter, topicFilter, derive, t, v5],
  );
  const fixedShown = useMemo(() => fixedRowsShown(needle, lifecycle, t), [needle, lifecycle, t]);
  const displayRows = useMemo(
    () => (newestFirst ? [...visibleRows].reverse() : visibleRows),
    [visibleRows, newestFirst],
  );
  const groups = useMemo(
    () => partitionGroups({ items, count, clearedCount, displayRows, groupByTopic, groupByDirection, newestFirst }),
    [items, count, clearedCount, displayRows, groupByTopic, groupByDirection, newestFirst],
  );

  const filtering = search.trim() !== '' || directionFilter !== 'all' || topicFilter.length > 0;

  const { entries, groupRanges } = useMemo(
    () =>
      buildTimelineEntries({
        items,
        lifecycle,
        needle,
        newestFirst,
        count,
        clearedCount,
        filtering,
        directionFilter,
        visibleRows,
        groups,
        fixedShown,
        expanded,
        connackExpanded,
        collapsedGroups,
        groupRowLimit,
        unwindowedGroups,
      }),
    [
      items,
      lifecycle,
      needle,
      newestFirst,
      count,
      clearedCount,
      filtering,
      directionFilter,
      visibleRows,
      groups,
      fixedShown,
      expanded,
      connackExpanded,
      collapsedGroups,
      groupRowLimit,
      unwindowedGroups,
    ],
  );

  const heights = useMemo(() => entryHeights(entries), [entries]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateStickyGroup reads entries/prefix — the deps.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) updateStickyGroup(el);
  }, [entries, prefix]);

  const toggleRow = useCallback((index: number) => setExpanded((prev) => toggled(prev, index)), []);
  const toggleConnack = useCallback(() => setConnackExpanded((prev) => !prev), []);
  const toggleGroup = useCallback((key: string) => setCollapsedGroups((prev) => toggled(prev, key)), []);
  const toggleGroupWindow = useCallback((key: string) => setUnwindowedGroups((prev) => toggled(prev, key)), []);

  // The pinned header overlay's source group — resolved fresh so the
  // count and collapse state track the live list.
  const stickySource =
    stickyGroup !== null && groups !== null ? groups.find((g) => g.identity.key === stickyGroup) : undefined;

  // The strip's count — the whole window's message rows, and the rows
  // the filters let through, so the number beside the filters reads
  // "{shown} of {total}" while any filter is in force.
  const messageTotal = useMemo(() => {
    let total = 0;
    for (let i = clearedCount; i < count; i++) if (items[i].kind === 'message') total++;
    return total;
  }, [items, count, clearedCount]);
  const messageShown = useMemo(() => {
    let shown = 0;
    for (const index of visibleRows) if (items[index].kind === 'message') shown++;
    return shown;
  }, [items, visibleRows]);

  const refusalKind = peerExecuteRefusalKind(lifecycle.errorMessage);

  return (
    <div
      data-testid="mqtt-message-timeline"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <MqttTimelineToolbar
        search={search}
        onSearchChange={setSearch}
        messageTotal={messageTotal}
        messageShown={messageShown}
        filtering={filtering}
        droppedMessages={droppedMessages}
        seenTopics={seenTopics}
        topicFilter={topicFilter}
        onTopicFilterChange={setTopicFilter}
        directionFilter={directionFilter}
        onDirectionFilterChange={setDirectionFilter}
        newestFirst={newestFirst}
        onNewestFirstChange={setNewestFirst}
        groupByTopic={groupByTopic}
        onGroupByTopicChange={setGroupByTopic}
        groupByDirection={groupByDirection}
        onGroupByDirectionChange={setGroupByDirection}
        groupRowLimit={groupRowLimit}
        onGroupRowLimitChange={setGroupRowLimit}
        onClear={() => setClearedCount(count)}
      />
      {/* A delegated open the place refused under its two-tier opt-in:
          the host-aware notice (the named tier, the reveal hand-off)
          above the list — the HTTP and gRPC error states' idiom; the
          error row below keeps the log's own line. */}
      {refusalKind !== null && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <PeerExecuteDisabledNotice kind={refusalKind} />
        </div>
      )}
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
            <MqttTimelineGroupHeader
              group={stickySource.identity}
              memberCount={stickySource.indexes.length}
              collapsed={collapsedGroups.has(stickySource.identity.key)}
              groupRowLimit={groupRowLimit}
              unwindowed={unwindowedGroups.has(stickySource.identity.key)}
              onToggle={toggleGroup}
              onToggleWindow={toggleGroupWindow}
              testId="mqtt-timeline-sticky-header"
            />
          </div>
        )}
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
              <MqttTimelineEntryRow
                entry={entry}
                items={items}
                timestamps={timestamps}
                lifecycle={lifecycle}
                v5={v5}
                derive={derive}
                expanded={expanded}
                connackExpanded={connackExpanded}
                groupRowLimit={groupRowLimit}
                unwindowedGroups={unwindowedGroups}
                onToggleRow={toggleRow}
                onToggleConnack={toggleConnack}
                onToggleGroup={toggleGroup}
                onToggleGroupWindow={toggleGroupWindow}
                wrapLines={wrapLines}
                onWrapLinesChange={setWrapLines}
                viewerModes={viewerModes}
                {...(onTrustCertificate !== undefined ? { onTrustCertificate } : {})}
                trustOfferOpen={trustOfferOpen}
              />
            </StreamLastRow>
          ))}
          <div aria-hidden style={{ height: bottomPadPx }} />
        </div>
      </div>
    </div>
  );
};

export default MqttMessageTimeline;

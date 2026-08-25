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
 * instead), "Connected"
 * (expandable to the CONNACK facts as key: value rows) sits before the
 * first item, and the
 * subscription lifecycle facts — Subscribed-with-grant /
 * Unsubscribed — render at their TRUE chronological positions because
 * they ride the same item log as the messages (live Subscribe toggles
 * land mid-session).
 *
 * DECOMPOSED orchestrator: the model plane (item/lifecycle/entry
 * shapes, pinned heights, display derivations) lives in
 * `mqtt-timeline-model.ts`, each entry renders through
 * `MqttTimelineEntryRow`, and the control strip is
 * `MqttTimelineToolbar` — this file owns the display state, the
 * filter/entry assembly, and the virtual-window scroll plumbing.
 *
 * Sort rides the `requests.mqttMessagesNewestFirst` SETTING (global,
 * toolbar-written — the choice survives Connect/Disconnect remounts).
 * Search, the direction filter, the TOPIC filter and Clear are
 * display-only — the capture is never touched. Timestamps are
 * session-only (the ratified law): absent rows simply render no time.
 */

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Button, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  CONNACK_DETAIL_PX,
  entryIndexAt,
  makeMqttFrameDerivations,
  type MqttDirectionFilter,
  type MqttTimelineEntry,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
  SINGLE_ROW_PX,
  VIEWER_PX,
} from './mqtt-timeline-model';
import MqttTimelineEntryRow from './MqttTimelineEntryRow';
import MqttTimelineToolbar from './MqttTimelineToolbar';

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
  const [directionFilter, setDirectionFilter] = useState<MqttDirectionFilter>('all');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
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

  // The flat display list the virtual window runs over — ONE event
  // log: Connecting at one chronological edge, Connected (with the
  // CONNACK detail) before the first item, the ended row at the other
  // edge; subscription facts sit wherever the log recorded them. An
  // idle open session shows no placeholder — the lifecycle rows are
  // the whole honest story.
  const entries = useMemo(() => {
    const out: MqttTimelineEntry[] = [];
    const pushRow = (index: number) => {
      out.push({ key: `r${index}`, kind: 'row', index });
      if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
    };
    const messageCount = visibleRows.length;
    const notice: MqttTimelineEntry | null =
      filtering && messageCount === 0 && count > clearedCount ? { key: 'none', kind: 'noMatches' } : null;

    const tokens: Array<number | 'connected'> = [];
    if (lifecycle.connected) tokens.push('connected');
    for (const index of visibleRows) tokens.push(index);
    if (newestFirst) tokens.reverse();

    // The error/aborted row sits at the ended row's chronological slot
    // — the two never coexist (a pre-open end has no opened-session
    // end). An abort that closed an established broker socket logs the
    // disconnect as its own row — chronologically AFTER the abort.
    const preOpenEnd = lifecycle.errorMessage !== undefined || lifecycle.aborted === true;
    const abortedEnd = lifecycle.aborted === true && lifecycle.abortedDisconnected === true;
    if (newestFirst) {
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
      if (preOpenEnd) {
        if (abortedEnd) out.push({ key: 'abortedEnd', kind: 'abortedEnd' });
        out.push({ key: 'error', kind: 'error' });
      }
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
      if (preOpenEnd) {
        out.push({ key: 'error', kind: 'error' });
        if (abortedEnd) out.push({ key: 'abortedEnd', kind: 'abortedEnd' });
      }
      if (lifecycle.endedBy !== undefined) out.push({ key: 'ended', kind: 'ended' });
    }
    return out;
  }, [
    newestFirst,
    lifecycle.connected,
    lifecycle.connack,
    lifecycle.errorMessage,
    lifecycle.aborted,
    lifecycle.abortedDisconnected,
    lifecycle.endedBy,
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

  const toggleRow = useCallback((index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleConnack = useCallback(() => {
    setConnackExpanded((prev) => !prev);
  }, []);

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
      <MqttTimelineToolbar
        search={search}
        onSearchChange={setSearch}
        messageTotal={messageTotal}
        droppedMessages={droppedMessages}
        seenTopics={seenTopics}
        topicFilter={topicFilter}
        onTopicFilterChange={setTopicFilter}
        directionFilter={directionFilter}
        onDirectionFilterChange={setDirectionFilter}
        newestFirst={newestFirst}
        onNewestFirstChange={setNewestFirst}
        wrapLines={wrapLines}
        onWrapLinesChange={setWrapLines}
        onClear={() => setClearedCount(count)}
      />
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
          {entries.slice(start, end).map((entry) => (
            <MqttTimelineEntryRow
              key={entry.key}
              entry={entry}
              items={items}
              timestamps={timestamps}
              lifecycle={lifecycle}
              derive={derive}
              expanded={expanded}
              connackExpanded={connackExpanded}
              onToggleRow={toggleRow}
              onToggleConnack={toggleConnack}
              wrapLines={wrapLines}
            />
          ))}
          <div aria-hidden style={{ height: bottomPadPx }} />
        </div>
      </div>
    </div>
  );
};

export default MqttMessageTimeline;

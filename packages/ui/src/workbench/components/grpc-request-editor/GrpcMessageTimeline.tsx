/**
 * GrpcMessageTimeline — the message-list surface for streaming gRPC
 * calls, ONE list across both phases: live (fed from `grpcStreamEvent`
 * frames while the invoke is in flight) and materialized (fed from the
 * snapshot's direction-tagged frames, session timestamps joined
 * positionally). A SIBLING of the MQTT / WS timelines and the SSE
 * event list on the same shared recipes — `useVirtualRowWindow`,
 * pinned row heights, append-only item identity, jump pill, the strip
 * and row anatomy. The gRPC-specific parts stay: the name chip is the
 * frame's DECLARED type (the rpc's request type for ↑, response type
 * for ↓) on the stable badge palette, opt-in per row ("Show message
 * types", off by default — the Postman posture), always on group
 * headers; chip names join the search haystack only while shown.
 *
 * The timeline is ONE event log in true call order: "Request sent" and
 * "Call completed / stopped / failed" sit at the chronological edges,
 * and "Response received" INTERLEAVES at `lifecycle.headAtMessage` —
 * the executor's recorded count of messages that preceded the response
 * head in call order, never inferred display-side. The call's script
 * marks interleave the same way at their own `atIndex`. Sort and
 * grouping are the shared anatomy on gRPC's own `requests.grpcMessages*`
 * SETTINGS (global, toolbar-written — the choices survive
 * Invoke/Cancel remounts): "Group by message type" and "Group by
 * direction" are CLUSTERING, not sorting — both on = the COMPOUND
 * (type, direction) pair, still one header level; group order anchors
 * to first appearance, an optional per-group row limit keeps each
 * group's N newest rows watchable, and the group spanning the viewport
 * top pins its header as a clickable sticky overlay. Grouped mode is
 * not a timeline, so the head row joins "Request sent" at the edge.
 *
 * This file is the orchestrator: state, the settings, the memoized
 * passes and the scroll plane (the new-edge anchor, the jump pill, the
 * sticky header). The vocabulary and the per-item derivations live in
 * `grpc-timeline-model.ts`, the pure list passes in
 * `grpc-timeline-entries.ts`, the strip in `GrpcTimelineToolbar.tsx`,
 * the rows in `GrpcTimelineEntryRow.tsx` (the group header, shared
 * with the sticky overlay, in `GrpcTimelineGroupHeader.tsx`).
 * Timestamps are session-only (the ratified Phase E law): absent — on
 * a re-opened saved exchange — rows simply render no time.
 */

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ProtoRegistry } from '@openheaders/core/proto';
import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { StreamLastRow, useTimelineViewerModes } from '../shared/TimelineMessageViewer';
import type { GrpcScriptMarkItem } from './grpc-scripts';
import {
  buildTimelineEntries,
  entryHeights,
  filterVisibleRows,
  fixedRowsShown,
  partitionGroups,
} from './grpc-timeline-entries';
import {
  type DirectionChips,
  entryIndexAt,
  type GrpcDirectionFilter,
  type GrpcTimelineItem,
  type GrpcTimelineLifecycle,
  makeGrpcFrameDerivations,
  mintChip,
  NO_SCRIPT_MARKS,
} from './grpc-timeline-model';
import GrpcTimelineEntryRow from './GrpcTimelineEntryRow';
import GrpcTimelineGroupHeader from './GrpcTimelineGroupHeader';
import GrpcTimelineToolbar from './GrpcTimelineToolbar';

export type { GrpcTimelineEndedBy, GrpcTimelineItem, GrpcTimelineLifecycle } from './grpc-timeline-model';

interface GrpcMessageTimelineProps {
  /** Message log — append-only during the live phase (the array
   *  reference stays stable; `count` is the committed prefix), the
   *  snapshot's frames once materialized. */
  items: readonly GrpcTimelineItem[];
  count: number;
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[];
  lifecycle: GrpcTimelineLifecycle;
  /** The call's script marks — rows interleaved at their capture
   *  positions. Absent = the call ran no hook. */
  scriptMarks?: readonly GrpcScriptMarkItem[];
  registry: ProtoRegistry | null;
  /** The rpc's resolved request type — ↑ frames decode as it. */
  inputType: string | null;
  /** The rpc's resolved response type — ↓ frames decode as it. */
  outputType: string | null;
  /** Response metadata pair count — the "Response received" row
   *  expands to the received-metadata line (or the honest "No
   *  metadata received." one). Absent = unknown: the row reads plain. */
  responseMetadataCount?: number;
  /** Clicking the received-metadata line jumps to the pane's Metadata
   *  tab. */
  onShowMetadata?: () => void;
  /** A verification failure's remedy — present only when the failure
   *  carries the trust hint; the error row shows the Trust certificate
   *  button that reveals the pane's offer. */
  onTrustCertificate?: () => void;
  /** The offer is showing — the button's pressed state (a11y only). */
  trustOfferOpen?: boolean;
}

/** A set toggle — the collapse / un-window / expand sets share it. */
function toggled<T>(prev: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const GrpcMessageTimeline: React.FC<GrpcMessageTimelineProps> = ({
  items,
  count,
  timestamps,
  lifecycle,
  scriptMarks = NO_SCRIPT_MARKS,
  registry,
  inputType,
  outputType,
  responseMetadataCount,
  onShowMetadata,
  onTrustCertificate,
  trustOfferOpen = false,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<GrpcDirectionFilter>('all');
  // Display-only clear: rows below this index hide; the capture (and
  // the lifecycle rows) stay untouched.
  const [clearedCount, setClearedCount] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set<number>());
  /** The "Request sent" row's metadata details are open. */
  const [sentExpanded, setSentExpanded] = useState(false);
  /** The "Response received" row's metadata line is open. */
  const [connectedExpanded, setConnectedExpanded] = useState(false);
  /** The error row's explanation details are open. */
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const viewerModes = useTimelineViewerModes();
  // Sort direction and grouping are SETTINGS — global, user-owned,
  // written by this toolbar and the Settings page alike; an Invoke/
  // Cancel remount never resets them.
  const [newestFirst, setNewestFirst] = useSetting('requests.grpcMessagesNewestFirst');
  const [showTypes, setShowTypes] = useSetting('requests.grpcMessagesShowTypes');
  const [groupByType, setGroupByType] = useSetting('requests.grpcMessagesGroupByType');
  const [groupByDirection, setGroupByDirection] = useSetting('requests.grpcMessagesGroupByDirection');
  const [groupRowLimit, setGroupRowLimit] = useSetting('requests.grpcMessagesGroupRowLimit');
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

  const derive = useMemo(
    () => makeGrpcFrameDerivations(registry, inputType, outputType, t('workbench.editors.session.secretHidden')),
    [registry, inputType, outputType],
  );

  // Per-direction name chips — a closed function of the resolved rpc
  // types, so every ↑ row shares one chip identity and every ↓ row the
  // other. Group identity rides the same two chips.
  const chips = useMemo<DirectionChips>(
    () => ({ up: mintChip(inputType), down: mintChip(outputType) }),
    [inputType, outputType],
  );

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

  const needle = search.trim().toLowerCase();
  const visibleRows = useMemo(
    () => filterVisibleRows({ items, count, clearedCount, needle, directionFilter, derive, chips, showTypes }),
    [items, count, clearedCount, needle, directionFilter, derive, chips, showTypes],
  );
  const fixedShown = useMemo(() => fixedRowsShown(needle, lifecycle, t), [needle, lifecycle, t]);
  const displayRows = useMemo(
    () => (newestFirst ? [...visibleRows].reverse() : visibleRows),
    [visibleRows, newestFirst],
  );
  const groups = useMemo(
    () =>
      partitionGroups({ items, count, clearedCount, displayRows, chips, groupByType, groupByDirection, newestFirst }),
    [items, count, clearedCount, displayRows, chips, groupByType, groupByDirection, newestFirst],
  );

  const filtering = search.trim() !== '' || directionFilter !== 'all';
  const sentMetadataCount = lifecycle.requestMetadata?.length ?? 0;
  const sentDetailOpen = sentExpanded && lifecycle.requestMetadata !== undefined;
  const errorExpandable =
    (lifecycle.endedBy === 'error' || lifecycle.endedBy === 'lost') && lifecycle.endedMessage !== undefined;
  const errorDetailOpen = errorExpanded && errorExpandable;
  const connectedDetailOpen = connectedExpanded && responseMetadataCount !== undefined;

  const { entries, groupRanges } = useMemo(
    () =>
      buildTimelineEntries({
        lifecycle,
        t,
        needle,
        newestFirst,
        count,
        clearedCount,
        filtering,
        directionFilter,
        visibleRows,
        displayRows,
        groups,
        scriptMarks,
        fixedShown,
        expanded,
        sentDetailOpen,
        connectedDetailOpen,
        errorDetailOpen,
        collapsedGroups,
        groupRowLimit,
        unwindowedGroups,
      }),
    [
      lifecycle,
      t,
      needle,
      newestFirst,
      count,
      clearedCount,
      filtering,
      directionFilter,
      visibleRows,
      displayRows,
      groups,
      scriptMarks,
      fixedShown,
      expanded,
      sentDetailOpen,
      connectedDetailOpen,
      errorDetailOpen,
      collapsedGroups,
      groupRowLimit,
      unwindowedGroups,
    ],
  );

  const heights = useMemo(() => entryHeights(entries, sentMetadataCount), [entries, sentMetadataCount]);

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

  const toggleGroup = (key: string) => setCollapsedGroups((prev) => toggled(prev, key));
  const toggleGroupWindow = (key: string) => setUnwindowedGroups((prev) => toggled(prev, key));
  const toggleRow = (index: number) => setExpanded((prev) => toggled(prev, index));

  // The pinned header overlay's source group — resolved fresh so the
  // count and collapse state track the live list.
  const stickySource =
    stickyGroup !== null && groups !== null ? groups.find((g) => g.identity.key === stickyGroup) : undefined;

  return (
    <div
      data-testid="grpc-message-timeline"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <GrpcTimelineToolbar
        search={search}
        onSearchChange={setSearch}
        directionFilter={directionFilter}
        onDirectionFilterChange={setDirectionFilter}
        messageTotal={count - clearedCount}
        messageShown={visibleRows.length}
        filtering={filtering}
        newestFirst={newestFirst}
        onNewestFirstChange={setNewestFirst}
        showTypes={showTypes}
        onShowTypesChange={setShowTypes}
        groupByType={groupByType}
        onGroupByTypeChange={setGroupByType}
        groupByDirection={groupByDirection}
        onGroupByDirectionChange={setGroupByDirection}
        groupRowLimit={groupRowLimit}
        onGroupRowLimitChange={setGroupRowLimit}
        onClear={() => setClearedCount(count)}
      />
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
            <GrpcTimelineGroupHeader
              group={stickySource.identity}
              memberCount={stickySource.indexes.length}
              collapsed={collapsedGroups.has(stickySource.identity.key)}
              chips={chips}
              groupRowLimit={groupRowLimit}
              unwindowed={unwindowedGroups.has(stickySource.identity.key)}
              onToggle={toggleGroup}
              onToggleWindow={toggleGroupWindow}
              testId="grpc-timeline-sticky-header"
            />
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
            // Rows separate by their own hairlines — no frame around the
            // list.
          }}
        >
          <div aria-hidden style={{ height: topPadPx }} />
          {entries.slice(start, end).map((entry, i) => (
            <StreamLastRow key={entry.key} last={start + i === entries.length - 1}>
              <GrpcTimelineEntryRow
                entry={entry}
                items={items}
                timestamps={timestamps}
                lifecycle={lifecycle}
                scriptMarks={scriptMarks}
                chips={chips}
                showTypes={showTypes}
                derive={derive}
                expanded={expanded}
                sentExpanded={sentExpanded}
                connectedExpanded={connectedExpanded}
                errorExpanded={errorExpanded}
                responseMetadataCount={responseMetadataCount}
                groupRowLimit={groupRowLimit}
                unwindowedGroups={unwindowedGroups}
                onToggleRow={toggleRow}
                onToggleSent={() => setSentExpanded((open) => !open)}
                onToggleConnected={() => setConnectedExpanded((open) => !open)}
                onToggleError={() => setErrorExpanded((open) => !open)}
                onToggleGroup={toggleGroup}
                onToggleGroupWindow={toggleGroupWindow}
                onShowMetadata={onShowMetadata}
                onTrustCertificate={onTrustCertificate}
                trustOfferOpen={trustOfferOpen}
                wrapLines={wrapLines}
                onWrapLinesChange={setWrapLines}
                viewerModes={viewerModes}
              />
            </StreamLastRow>
          ))}
          <div aria-hidden style={{ height: bottomPadPx }} />
        </div>
      </div>
    </div>
  );
};

export default GrpcMessageTimeline;

/**
 * EventStreamView — Server-Sent Events log for a `text/event-stream`
 * response: the Messages grid's twin (same spine — fire rail, hover
 * actions, resizable columns with (i) popovers, Original | Modified
 * splits, synthetic rows, grid/payload preview split), collapsed to the
 * SSE contract:
 *
 *   - Grid: fire rail | Id | Type | Data | Time — no direction rail
 *     (events only travel server → page). Id / Type / Time sortable,
 *     Time ascending by default; the list follows the tail while
 *     parked at the bottom.
 *   - Toolbar: Clear all (view-local), regex filter matching id, type
 *     and data (a modified event matches on either data side), the
 *     stream-scoped "Override event" create action, the split toggle
 *     and the `View ▾` layout menu (shared with the Messages grid).
 *   - Hover actions per row: copy the payload; "Edit rule" when an sse
 *     rule accounts for THIS event (per-event attribution), otherwise
 *     "Override" opening the quick-create popover seeded from the event.
 *   - Selecting a row opens the payload preview (`SseEventPreview`) in
 *     the resizable Allotment split.
 *
 * Data sources: the live `lifecycle.messages` plane (CDP tabs) is
 * preferred; the finished response body is the heuristic fallback
 * (`sse-events.ts`); the honest empty states explain what each path
 * cannot see.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { Rule } from '@openheaders/core/types';
import { InfoPopover } from '@openheaders/ui/shared/info-popover';
import { useModifiedSettings, useResetSettings, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { Allotment } from 'allotment';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { currentResponseBody } from '../../data/inspector-row-projection';
import {
  firedSseRules,
  type MessageFireTier,
  type MessageFrameAttribution,
  sseEventAttribution,
} from '../../data/message-fire-rail';
import { buildSseDraftFromConnection, buildSseDraftFromEvent } from '../../data/rule-create/rule-draft-bridge';
import type { RulesByUid } from '../../data/rule-create/use-rules-lookup';
import type { InspectorFire } from '../../data/types';
import { CONNECTION_FRAME, useRulePopover } from '../RulePopoverHost';
import { useColumnResize } from '../use-column-resize';
import { walkListSelection } from '../walk-list-selection';
import { MESSAGES_VIEW_MENU_KEYS, MessagesViewMenu } from './streams/MessagesViewMenu';
import { SSE_FIRE_RAIL_INFO, SseColumnInfo } from './streams/SseColumnInfo';
import SseEventPreview from './streams/SseEventPreview';
import { SSE_COLUMNS, sseColumnMinWidth, sseGridTemplate } from './streams/sse-grid';
import { type SseDisplayEvent, sseDisplayEvents } from './streams/sse-events';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../../data/text-match';
import StreamGridToolbar from './streams/StreamGridToolbar';
import { formatStreamTime, streamTimeTooltip } from './streams/stream-time';
import { useMessagesSplitLayout } from './streams/use-messages-split-layout';
import { useStickToBottom } from './streams/use-stick-to-bottom';
import { STREAM_ROW_PX, useStreamRowWindow } from './streams/use-stream-row-window';
import { WS_SYNTHETIC_INDEX_BASE } from './streams/ws-frames';

export function isEventStream(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('text/event-stream');
}

type SortColumn = 'id' | 'type' | 'time';
type SortDirection = 'asc' | 'desc';

function compareEvents(a: SseDisplayEvent, b: SseDisplayEvent, column: SortColumn): number {
  if (column === 'time') return (a.atMs ?? 0) - (b.atMs ?? 0) || a.index - b.index;
  const av = column === 'id' ? (a.id ?? '') : a.eventName;
  const bv = column === 'id' ? (b.id ?? '') : b.eventName;
  return av < bv ? -1 : av > bv ? 1 : a.index - b.index;
}

const FIRE_DOT_CLASS: Record<MessageFireTier, string> = {
  applied: 'dt-fire-dot--auth',
  inferred: 'dt-fire-dot--inferred',
};

/** Dot tooltip — a capture-backed dot states what the wrapper recorded;
 *  the derived tiers keep the generic tier copy. */
function fireDotTitle(
  event: SseDisplayEvent,
  tier: MessageFireTier,
  modification: MessageFrameAttribution['modification'],
): string {
  const op = event.capture?.op;
  if (op === 'injected') return 'Rule applied — this event was injected by the rule';
  if (op === 'replaced') return 'Rule applied — the rule replaced this event';
  if (op === 'dropped' || modification?.kind === 'dropped') {
    return 'Rule dropped this event — the page never received it';
  }
  return tier === 'applied'
    ? "Rule applied — the event's payload matches the rule's payload"
    : 'Rule matched — application not verifiable for this event';
}

interface EventStreamViewProps {
  lifecycle: RequestLifecycle;
  /** Which correlator feeds the tab — drives the honest empty-state copy. */
  source: LifecycleSource;
  /** The row's rule fires — narrowed to `sse` rules for the fire rail. */
  fires: readonly InspectorFire[];
  rulesByUid: RulesByUid;
}

export default function EventStreamView({ lifecycle, source, fires, rulesByUid }: EventStreamViewProps) {
  const [filterText, setFilterText] = useState('');
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [sortColumn, setSortColumn] = useState<SortColumn>('time');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  // Clear-all floors — wire events and capture-minted synthetic rows
  // index in separate spaces (synthetic from WS_SYNTHETIC_INDEX_BASE).
  const [clearedFloors, setClearedFloors] = useState({ wire: 0, synth: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useMessagesSplitLayout();
  const [gridLayout, setGridLayout] = useSetting('devpanelNetwork.messagesLayout');
  const [showPreview, setShowPreview] = useSetting('devpanelNetwork.messagesShowPreview');
  const viewMenuModified = useModifiedSettings(MESSAGES_VIEW_MENU_KEYS);
  const resetViewMenu = useResetSettings(MESSAGES_VIEW_MENU_KEYS);
  const { columnWidths, registerCellRef, beginResize, resetColumnWidth } = useColumnResize(sseColumnMinWidth);

  const body = (lifecycle.messages ?? []).some((m) => m.kind === 'sse')
    ? ''
    : (currentResponseBody(lifecycle)?.content ?? '');
  const all = useMemo(() => sseDisplayEvents(lifecycle, body), [lifecycle, body]);

  const sseRules = useMemo(() => firedSseRules(fires, rulesByUid), [fires, rulesByUid]);

  // Fire-rail attribution per event — a joined wrapper capture is
  // recorded proof; capture-less events derive from the row's fired sse
  // rules (see `message-fire-rail.ts` for the receive-only contract).
  const attributionByIndex = useMemo(() => {
    const map = new Map<number, MessageFrameAttribution>();
    for (const event of all) {
      const attribution = sseEventAttribution(sseRules, event);
      if (attribution !== null) map.set(event.index, attribution);
    }
    return map;
  }, [all, sseRules]);

  // Hover row actions — copy the payload; edit THE rule that accounts
  // for the hovered event (per-event attribution), or — scaffold
  // doctrine — create one seeded from the event.
  const rulePopover = useRulePopover();
  const editRuleForEvent = (event: SseDisplayEvent): Rule | null => {
    const ruleUid = attributionByIndex.get(event.index)?.ruleUid;
    if (ruleUid === undefined) return null;
    const rule = rulesByUid.get(ruleUid);
    return rule?.type === 'sse' ? rule : null;
  };
  const openRuleAction = (e: ReactMouseEvent<HTMLButtonElement>, event: SseDisplayEvent): void => {
    e.stopPropagation();
    const editRule = editRuleForEvent(event);
    if (editRule) {
      rulePopover.open({ anchorEl: e.currentTarget, rule: editRule }, { pinned: true });
      return;
    }
    rulePopover.open(
      {
        mode: 'create-message',
        anchorEl: e.currentTarget,
        draft: buildSseDraftFromEvent(lifecycle, event),
        requestId: lifecycle.requestId,
        frameIndex: event.index,
      },
      { pinned: true },
    );
  };
  // Toolbar's stream-scoped create — no event behind it, so the draft
  // carries selector defaults and the session keys on CONNECTION_FRAME.
  const openStreamOverride = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    rulePopover.open(
      {
        mode: 'create-message',
        anchorEl: e.currentTarget,
        draft: buildSseDraftFromConnection(lifecycle),
        requestId: lifecycle.requestId,
        frameIndex: CONNECTION_FRAME,
      },
      { pinned: true },
    );
  };
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const handleCopy = (e: ReactMouseEvent<HTMLButtonElement>, event: SseDisplayEvent): void => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(event.data).then(() => {
      setCopiedIndex(event.index);
      window.setTimeout(() => setCopiedIndex((v) => (v === event.index ? null : v)), 1200);
    });
  };

  const filterPredicate = useMemo(() => buildTextPredicate(filterText, filterConfig), [filterText, filterConfig]);

  const visible = useMemo(() => {
    const cleared = (ev: SseDisplayEvent): boolean =>
      ev.index >= WS_SYNTHETIC_INDEX_BASE
        ? ev.index - WS_SYNTHETIC_INDEX_BASE < clearedFloors.synth
        : ev.index < clearedFloors.wire;
    const afterClear = clearedFloors.wire > 0 || clearedFloors.synth > 0 ? all.filter((ev) => !cleared(ev)) : all;
    // A modified event matches on either side — the captured wire data
    // or the derived replacement the split cell renders next to it.
    const takenByFilter = (ev: SseDisplayEvent): boolean => {
      if (filterPredicate.empty) return true;
      if (filterPredicate.test(ev.eventName) || filterPredicate.test(ev.id ?? '') || filterPredicate.test(ev.data)) {
        return true;
      }
      const modification = attributionByIndex.get(ev.index)?.modification;
      return modification?.kind === 'replaced-in-page' && filterPredicate.test(modification.modified);
    };
    const filtered = afterClear.filter(takenByFilter);
    const sorted = [...filtered].sort((a, b) => compareEvents(a, b, sortColumn));
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [all, attributionByIndex, clearedFloors, filterPredicate, sortColumn, sortDir]);

  const { onScroll: onStickScroll } = useStickToBottom(listRef, visible.length);
  // Virtualized grid — only the visible slice mounts (uniform pinned-height
  // rows; see use-stream-row-window for the sticky-header decision).
  const { onScroll: onWindowScroll, start, end, topPadPx, bottomPadPx, scrollToPos } = useStreamRowWindow(
    listRef,
    visible.length,
  );
  const onScroll = useCallback(() => {
    onStickScroll();
    onWindowScroll();
  }, [onStickScroll, onWindowScroll]);

  if (all.length === 0) {
    // An inject rule writes synthetic events straight into the page —
    // nothing crosses the wire, so an empty capture is expected. Say so
    // instead of implying the stream was silent.
    const syntheticOnly = sseRules.some((r) => r.action.operation === 'inject');
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        {syntheticOnly
          ? 'No events crossed the wire — an inject rule fired here, and injected events are delivered ' +
            'synthetically inside the page, invisible to the network capture.'
          : body
            ? 'No parseable SSE events in the response body.'
            : source !== 'cdp'
              ? 'No events captured. Without debug mode, server-sent streams are only materialized once the ' +
                'request finishes; long-running streams may not populate here until the connection closes.'
              : 'No events received yet.'}
      </div>
    );
  }

  const dropped = lifecycle.messagesDropped ?? 0;
  const selected = selectedIndex != null ? (all.find((ev) => ev.index === selectedIndex) ?? null) : null;

  const onClear = () => {
    // Hide everything observed so far: each stream's next ordinal is its floor.
    let wire = clearedFloors.wire;
    let synth = clearedFloors.synth;
    for (const ev of all) {
      if (ev.index >= WS_SYNTHETIC_INDEX_BASE) synth = Math.max(synth, ev.index - WS_SYNTHETIC_INDEX_BASE + 1);
      else wire = Math.max(wire, ev.index + 1);
    }
    setClearedFloors({ wire, synth });
    setSelectedIndex(null);
  };

  // Keyboard row navigation — the shared walk over the visible display
  // order (rows are pinned-height, so the Page keys' viewport is one
  // division; the zero-viewport jsdom case degrades to an arrow step).
  const handleListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = listRef.current;
    const pageRows = el && el.clientHeight > 0 ? Math.max(1, Math.floor(el.clientHeight / STREAM_ROW_PX) - 1) : 1;
    const pos = selectedIndex == null ? -1 : visible.findIndex((ev) => ev.index === selectedIndex);
    const next = walkListSelection(visible.length, pos, e.key, pageRows);
    if (next === null) return;
    e.preventDefault();
    setSelectedIndex(visible[next].index);
    scrollToPos(next);
  };

  const onSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  };

  return (
    <div className="dt-sse-view" style={{ '--dt-sse-cols': sseGridTemplate(columnWidths, gridLayout) } as CSSProperties}>
      <StreamGridToolbar
        onClear={onClear}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        filterError={filterPredicate.error}
        filterPlaceholder="Filter events"
        action={
          <button
            type="button"
            className="dt-btn dt-btn--oh"
            title="Create a message rule for this stream"
            onClick={openStreamOverride}
          >
            Override event
          </button>
        }
        layoutToggle={showPreview ? { layout, onChange: setLayout } : undefined}
        viewMenu={
          <MessagesViewMenu
            layout={gridLayout}
            showPreview={showPreview}
            modified={viewMenuModified}
            onLayoutChange={setGridLayout}
            onToggleShowPreview={() => setShowPreview(!showPreview)}
            onReset={resetViewMenu}
          />
        }
      />
      {dropped > 0 && (
        <div className="dt-sse-truncation">
          Showing the latest {all.length} events — {dropped} older {dropped === 1 ? 'event' : 'events'} dropped.
        </div>
      )}
      {/* Allotment captures its orientation at mount — remount on layout
        change via `key`, same discipline as the Messages grid. */}
      <div className="dt-ws-split">
        <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
          <Allotment.Pane minSize={layout === 'vertical' ? 80 : 200} preferredSize="60%">
            <div
              className={`dt-sse-list${gridLayout === 'compact' ? ' dt-sse-list--compact' : ''}`}
              ref={listRef}
              onScroll={onScroll}
              role="listbox"
              aria-label="Server-sent events"
              tabIndex={0}
              onKeyDown={handleListKeyDown}
            >
              <div className="dt-sse-row dt-sse-row-header">
                <InfoPopover content={SSE_FIRE_RAIL_INFO} trigger="hover" placement="bottomLeft">
                  <span className="dt-rail-head">
                    <span className="dt-rail-head-dot" />
                  </span>
                </InfoPopover>
                {SSE_COLUMNS.map((col) => {
                  const sortKey = col.key === 'data' ? null : col.key;
                  return (
                  <div key={col.key} className="dt-col-header-cell" ref={registerCellRef(col.key)}>
                    <SseColumnInfo infoKey={col.key} />
                    <button
                      type="button"
                      className="dt-col-sort"
                      disabled={sortKey === null}
                      title={sortKey === null ? undefined : `Sort by ${col.label.toLowerCase()}`}
                      onClick={sortKey === null ? undefined : () => onSort(sortKey)}
                    >
                      {col.label}
                      {sortColumn === col.key && <span aria-hidden="true"> {sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="dt-col-resizer"
                      aria-label={`Resize ${col.label} column`}
                      onPointerDown={(e) => beginResize(e, col.key)}
                      onDoubleClick={() => resetColumnWidth(col.key)}
                    />
                  </div>
                  );
                })}
              </div>
              {topPadPx > 0 && <div aria-hidden="true" style={{ height: topPadPx }} />}
              {visible.slice(start, end).map((ev) => {
                const isSelected = ev.index === selectedIndex;
                const attribution = attributionByIndex.get(ev.index) ?? null;
                const fireTier = attribution?.tier ?? null;
                const modification = attribution?.modification ?? null;
                return (
                  <div
                    key={`sse-${ev.index}`}
                    className={`dt-sse-row${isSelected ? ' dt-sse-row--selected' : ''}${ev.synthetic ? ' dt-sse-row--synthetic' : ''}`}
                    title={
                      ev.synthetic
                        ? 'Synthetic event — injected by a rule inside the page; never crossed the wire'
                        : undefined
                    }
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedIndex(ev.index)}
                  >
                    <span className="dt-col-dot">
                      {fireTier !== null && (
                        <span
                          className={`dt-fire-dot ${FIRE_DOT_CLASS[fireTier]}`}
                          title={fireDotTitle(ev, fireTier, modification)}
                        />
                      )}
                    </span>
                    <span className="dt-sse-id dt-col-muted">{ev.id ?? ''}</span>
                    <span className="dt-sse-type">{ev.eventName}</span>
                    {modification === null || modification.kind === 'replaced-on-wire' ? (
                      <span className="dt-sse-data" title={ev.data}>
                        {ev.data}
                      </span>
                    ) : (
                      // Original | Modified at a glance — the wire side and
                      // the page side, mirroring the preview pane's split.
                      <span className="dt-sse-data dt-sse-data--split">
                        <span className="dt-sse-data-side">{ev.data}</span>
                        <span className="dt-sse-data-split-divider" aria-hidden="true" />
                        <span className="dt-sse-data-side">
                          {modification.kind === 'replaced-in-page' && modification.modified}
                          {modification.kind === 'dropped' && (
                            <span className="dt-col-muted">Dropped — never delivered to the page</span>
                          )}
                        </span>
                      </span>
                    )}
                    <span className="dt-sse-time" title={ev.atMs != null ? streamTimeTooltip(ev.atMs) : undefined}>
                      {ev.atMs != null ? formatStreamTime(ev.atMs) : ''}
                    </span>
                    <span className="dt-sse-row-actions">
                      <button
                        type="button"
                        className="dt-btn dt-btn-primary dt-ws-action dt-ws-action--icon"
                        title={copiedIndex === ev.index ? 'Copied' : 'Copy payload'}
                        aria-label={copiedIndex === ev.index ? 'Copied' : 'Copy payload'}
                        onClick={(e) => handleCopy(e, ev)}
                      >
                        {copiedIndex === ev.index ? <CheckOutlined /> : <CopyOutlined />}
                      </button>
                      <button
                        type="button"
                        className="dt-btn dt-btn--oh dt-ws-action"
                        title={
                          editRuleForEvent(ev)
                            ? 'Edit the message rule that acted on this event'
                            : 'Create a message rule seeded from this event'
                        }
                        onClick={(e) => openRuleAction(e, ev)}
                      >
                        {editRuleForEvent(ev) ? 'Edit rule' : 'Override'}
                      </button>
                    </span>
                  </div>
                );
              })}
              {bottomPadPx > 0 && <div aria-hidden="true" style={{ height: bottomPadPx }} />}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={layout === 'vertical' ? 60 : 160} visible={showPreview}>
            {/* A hidden pane keeps its DOM mounted at size 0 — gate the
              content too so the preview fully unmounts when toggled off. */}
            {showPreview && (
              <div className="dt-ws-preview">
                <SseEventPreview
                  event={selected}
                  attribution={selected !== null ? (attributionByIndex.get(selected.index) ?? null) : null}
                />
              </div>
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

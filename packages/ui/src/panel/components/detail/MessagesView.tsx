/**
 * MessagesView — WebSocket frame log for an upgraded HTTP connection,
 * matching the host's Messages tab:
 *
 *   - Toolbar: Clear all, All / Send / Receive direction filter, regex
 *     filter (invalid patterns degrade to a literal match; a modified
 *     frame matches on either of its sides), the
 *     connection-scoped "Override message" create action and the
 *     `View ▾` menu (compact / wide column layout, persisted via
 *     `devpanelNetwork.messagesLayout`, plus the grid/payload split
 *     orientation).
 *   - Grid: fire rail | direction rail | Data | Length | Time. The fire
 *     rail mirrors the traffic table's — a per-frame dot where a fired
 *     `ws` rule accounts for the frame (see `message-fire-rail.ts`).
 *     A frame with a derivable modification renders its Data cell split
 *     Original | Modified, and the preview pane mirrors the split with
 *     labeled panes — the Response tab's two-sided idiom.
 *     Time is the one sortable column,
 *     ascending by default; the list follows the tail while parked at
 *     the bottom (same pin semantics as the main traffic table). The
 *     headers reuse the traffic table's anatomy — drag-resizable
 *     dividers and hover-revealed (i) popovers that each highlight one
 *     slice of a shared example frame.
 *   - Hovering a row reveals the right-edge actions (Headers-row
 *     idiom): copy the payload, and the rule action — "Edit rule" when
 *     a ws rule accounts for THIS frame (per-frame attribution),
 *     otherwise "Override" opening the quick-create popover seeded from
 *     the hovered frame.
 *   - Selecting a row opens the payload preview in a resizable pane —
 *     JSON tree / verbatim text for text frames, a Base64 / Hex / UTF-8
 *     viewer for binary frames. The grid/payload split is a standard
 *     Allotment sash; a toolbar toggle swaps stacked (default) for
 *     side-by-side, same affordance as the workbench editors.
 *   - "Clear all" hides everything received so far for this request
 *     (view-local; the underlying lifecycle list is untouched).
 *
 * Data sources and the honest empty states are unchanged from the
 * first slice: the live `lifecycle.messages` plane is preferred, the
 * HAR `_webSocketMessages` dialect is the fallback, and the heuristic
 * capture path (which can see neither) explains itself.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, Rule } from '@openheaders/core/types';
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
import {
  firedWsRules,
  type MessageFireTier,
  type MessageFrameAttribution,
  messageFrameAttribution,
} from '../../data/message-fire-rail';
import { buildWsDraftFromConnection, buildWsDraftFromFrame } from '../../data/rule-create/rule-draft-bridge';
import type { RulesByUid } from '../../data/rule-create/use-rules-lookup';
import type { InspectorFire } from '../../data/types';
import { CONNECTION_FRAME, useRulePopover } from '../RulePopoverHost';
import { useColumnResize } from '../use-column-resize';
import { walkListSelection } from '../walk-list-selection';
import MessagePreview from './streams/MessagePreview';
import { MessagesColumnInfo, WS_DIRECTION_INFO, WS_FIRE_RAIL_INFO } from './streams/MessagesColumnInfo';
import { MESSAGES_VIEW_MENU_KEYS, MessagesViewMenu } from './streams/MessagesViewMenu';
import StreamGridToolbar, { type WsDirectionFilter } from './streams/StreamGridToolbar';
import { buildTextPredicate, DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../../data/text-match';
import { formatStreamTime, streamTimeTooltip } from './streams/stream-time';
import { useMessagesSplitLayout } from './streams/use-messages-split-layout';
import { useStickToBottom } from './streams/use-stick-to-bottom';
import { STREAM_ROW_PX, useStreamRowWindow } from './streams/use-stream-row-window';
import { WS_COLUMNS, wsColumnMinWidth, wsGridTemplate } from './streams/ws-grid';
import {
  frameDataLabel,
  frameLengthLabel,
  opcodeDescription,
  WS_SYNTHETIC_INDEX_BASE,
  type WsDisplayFrame,
  wsDisplayFrames,
} from './streams/ws-frames';

export function hasWebSocketMessages(har: InspectorHarEntry): boolean {
  const msgs = har._webSocketMessages;
  return Array.isArray(msgs) && msgs.length > 0;
}

type SortDirection = 'asc' | 'desc';

interface MessagesViewProps {
  lifecycle: RequestLifecycle;
  har: InspectorHarEntry | null;
  /** Which correlator feeds the tab — drives the honest empty-state copy. */
  source: LifecycleSource;
  /** The row's rule fires — narrowed to `ws` rules for the fire rail. */
  fires: readonly InspectorFire[];
  rulesByUid: RulesByUid;
}

const FIRE_DOT_CLASS: Record<MessageFireTier, string> = {
  applied: 'dt-fire-dot--auth',
  inferred: 'dt-fire-dot--inferred',
};

const FIRE_DOT_TITLE: Record<MessageFireTier, string> = {
  applied: "Rule applied — the frame's payload matches the rule's payload",
  inferred: 'Rule matched — application not verifiable for this frame',
};

/** Dot tooltip — a capture-backed dot states what the wrapper recorded;
 *  the derived tiers keep the generic tier copy. */
function fireDotTitle(
  frame: WsDisplayFrame,
  tier: MessageFireTier,
  modification: MessageFrameAttribution['modification'],
): string {
  const op = frame.capture?.op;
  if (op === 'injected') return 'Rule applied — this frame was injected by the rule';
  if (op === 'replaced') return 'Rule applied — the rule replaced this frame';
  if (op === 'dropped' || modification?.kind === 'dropped') {
    return frame.type === 'send'
      ? 'Rule dropped this frame — it was never sent to the server'
      : 'Rule dropped this frame — the page never received it';
  }
  return FIRE_DOT_TITLE[tier];
}

function directionClass(type: WsDisplayFrame['type']): string {
  if (type === 'send') return 'dt-ws-row--send';
  if (type === 'error') return 'dt-ws-row--error';
  return 'dt-ws-row--recv';
}

function directionArrow(type: WsDisplayFrame['type']): string {
  if (type === 'send') return '⬆';
  if (type === 'error') return '⚠';
  return '⬇';
}

export default function MessagesView({ lifecycle, har, source, fires, rulesByUid }: MessagesViewProps) {
  const [direction, setDirection] = useState<WsDirectionFilter>('all');
  const [filterText, setFilterText] = useState('');
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  // Clear-all floors — wire frames and capture-minted synthetic rows index
  // in separate spaces (synthetic from WS_SYNTHETIC_INDEX_BASE), so each
  // stream keeps its own "hide everything before" ordinal.
  const [clearedFloors, setClearedFloors] = useState({ wire: 0, synth: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useMessagesSplitLayout();
  const [gridLayout, setGridLayout] = useSetting('devpanelNetwork.messagesLayout');
  const [showPreview, setShowPreview] = useSetting('devpanelNetwork.messagesShowPreview');
  const viewMenuModified = useModifiedSettings(MESSAGES_VIEW_MENU_KEYS);
  const resetViewMenu = useResetSettings(MESSAGES_VIEW_MENU_KEYS);
  const { columnWidths, registerCellRef, beginResize, resetColumnWidth } = useColumnResize(wsColumnMinWidth);

  const all = useMemo(() => wsDisplayFrames(lifecycle, har), [lifecycle, har]);

  const wsRules = useMemo(() => firedWsRules(fires, rulesByUid), [fires, rulesByUid]);

  // Fire-rail attribution per frame — a joined wrapper capture is
  // recorded proof (needs no live rule); capture-less frames derive from
  // the row's fired ws rules. Tier drives the dot, the modification view
  // drives the Original | Modified split (see `message-fire-rail.ts` for
  // the attribution-honesty contract).
  const attributionByIndex = useMemo(() => {
    const map = new Map<number, MessageFrameAttribution>();
    for (const frame of all) {
      const attribution = messageFrameAttribution(wsRules, frame);
      if (attribution !== null) map.set(frame.index, attribution);
    }
    return map;
  }, [all, wsRules]);

  // Hover row actions — copy the payload; edit THE rule that accounts
  // for the hovered frame (per-frame attribution, so a frame no rule
  // touched never offers another frame's rule) in the shared quick-edit
  // popover, or — scaffold doctrine — create one seeded from the frame.
  const rulePopover = useRulePopover();
  const editRuleForFrame = (frame: WsDisplayFrame): Rule | null => {
    const ruleUid = attributionByIndex.get(frame.index)?.ruleUid;
    if (ruleUid === undefined) return null;
    const rule = rulesByUid.get(ruleUid);
    return rule?.type === 'ws' ? rule : null;
  };
  const openRuleAction = (e: ReactMouseEvent<HTMLButtonElement>, frame: WsDisplayFrame): void => {
    e.stopPropagation();
    const editRule = editRuleForFrame(frame);
    if (editRule) {
      rulePopover.open({ anchorEl: e.currentTarget, rule: editRule }, { pinned: true });
      return;
    }
    rulePopover.open(
      {
        mode: 'create-message',
        anchorEl: e.currentTarget,
        draft: buildWsDraftFromFrame(lifecycle, frame),
        requestId: lifecycle.requestId,
        frameIndex: frame.index,
      },
      { pinned: true },
    );
  };
  // Toolbar's connection-scoped create — no frame behind it, so the
  // draft carries selector defaults and the session keys on the
  // CONNECTION_FRAME sentinel instead of a frame index.
  const openConnectionOverride = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    rulePopover.open(
      {
        mode: 'create-message',
        anchorEl: e.currentTarget,
        draft: buildWsDraftFromConnection(lifecycle),
        requestId: lifecycle.requestId,
        frameIndex: CONNECTION_FRAME,
      },
      { pinned: true },
    );
  };
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const handleCopy = (e: ReactMouseEvent<HTMLButtonElement>, frame: WsDisplayFrame): void => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(frame.data).then(() => {
      setCopiedIndex(frame.index);
      window.setTimeout(() => setCopiedIndex((v) => (v === frame.index ? null : v)), 1200);
    });
  };

  const filterPredicate = useMemo(() => buildTextPredicate(filterText, filterConfig), [filterText, filterConfig]);

  const visible = useMemo(() => {
    const cleared = (f: WsDisplayFrame): boolean =>
      f.index >= WS_SYNTHETIC_INDEX_BASE
        ? f.index - WS_SYNTHETIC_INDEX_BASE < clearedFloors.synth
        : f.index < clearedFloors.wire;
    const afterClear = clearedFloors.wire > 0 || clearedFloors.synth > 0 ? all.filter((f) => !cleared(f)) : all;
    // A modified frame matches on either side — the captured wire data or
    // the derived replacement the split cell renders next to it.
    const takenByFilter = (f: WsDisplayFrame): boolean => {
      if (filterPredicate.empty) return true;
      if (filterPredicate.test(f.data)) return true;
      const modification = attributionByIndex.get(f.index)?.modification;
      return modification?.kind === 'replaced-in-page' && filterPredicate.test(modification.modified);
    };
    const filtered = afterClear.filter((f) => (direction === 'all' || f.type === direction) && takenByFilter(f));
    // Arrival order is time order; a stable index tiebreak keeps
    // equal-millisecond frames in wire order under both directions.
    if (sortDir === 'desc') {
      return [...filtered].sort((a, b) => b.atMs - a.atMs || b.index - a.index);
    }
    return filtered;
  }, [all, attributionByIndex, clearedFloors, direction, filterPredicate, sortDir]);

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
    // A receive-inject writes synthetic frames straight into the page —
    // nothing crosses the wire, so an empty capture is expected. Say so
    // instead of implying the connection was silent.
    const syntheticOnly = wsRules.some((r) => r.action.operation === 'inject' && r.action.direction === 'receive');
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        {source !== 'cdp'
          ? 'WebSocket frames are only visible with debug mode enabled for this tab.'
          : syntheticOnly
            ? 'No frames crossed the wire — an inject rule fired here, and injected frames are delivered ' +
              'synthetically inside the page, invisible to the network capture.'
            : 'No WebSocket frames exchanged yet.'}
      </div>
    );
  }

  const dropped = lifecycle.messagesDropped ?? 0;
  const selected = selectedIndex != null ? (all.find((f) => f.index === selectedIndex) ?? null) : null;

  const onClear = () => {
    // Hide everything observed so far: each stream's next ordinal is its floor.
    let wire = clearedFloors.wire;
    let synth = clearedFloors.synth;
    for (const f of all) {
      if (f.index >= WS_SYNTHETIC_INDEX_BASE) synth = Math.max(synth, f.index - WS_SYNTHETIC_INDEX_BASE + 1);
      else wire = Math.max(wire, f.index + 1);
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
    const pos = selectedIndex == null ? -1 : visible.findIndex((f) => f.index === selectedIndex);
    const next = walkListSelection(visible.length, pos, e.key, pageRows);
    if (next === null) return;
    e.preventDefault();
    setSelectedIndex(visible[next].index);
    scrollToPos(next);
  };

  return (
    <div className="dt-ws-view" style={{ '--dt-ws-cols': wsGridTemplate(columnWidths, gridLayout) } as CSSProperties}>
      <StreamGridToolbar
        onClear={onClear}
        directionFilter={{ value: direction, onChange: setDirection }}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        filterError={filterPredicate.error}
        filterPlaceholder="Filter messages"
        action={
          <button
            type="button"
            className="dt-btn dt-btn--oh"
            title="Create a message rule for this connection"
            onClick={openConnectionOverride}
          >
            Override message
          </button>
        }
        viewMenu={
          <MessagesViewMenu
            layout={gridLayout}
            splitLayout={layout}
            showPreview={showPreview}
            modified={viewMenuModified}
            onLayoutChange={setGridLayout}
            onSplitLayoutChange={setLayout}
            onToggleShowPreview={() => setShowPreview(!showPreview)}
            onReset={resetViewMenu}
          />
        }
      />
      {dropped > 0 && (
        <div className="dt-ws-truncation">
          Showing the latest {all.length} frames — {dropped} older {dropped === 1 ? 'frame' : 'frames'} dropped.
        </div>
      )}
      {/* Allotment captures its orientation at mount and ignores later
        `vertical` prop changes, so remount on `layout` change via `key` —
        same discipline as the workbench request editor. */}
      <div className="dt-ws-split">
        <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
          <Allotment.Pane minSize={layout === 'vertical' ? 80 : 200} preferredSize="60%">
            <div
              className={`dt-ws-list${gridLayout === 'compact' ? ' dt-ws-list--compact' : ''}`}
              ref={listRef}
              onScroll={onScroll}
              role="listbox"
              aria-label="WebSocket messages"
              tabIndex={0}
              onKeyDown={handleListKeyDown}
            >
              <div className="dt-ws-row dt-ws-row-header">
                <InfoPopover content={WS_FIRE_RAIL_INFO} trigger="hover" placement="bottomLeft">
                  <span className="dt-rail-head">
                    <span className="dt-rail-head-dot" />
                  </span>
                </InfoPopover>
                <InfoPopover content={WS_DIRECTION_INFO} trigger="hover" placement="bottomLeft">
                  <span className="dt-ws-dir dt-ws-dir-head">⇅</span>
                </InfoPopover>
                {WS_COLUMNS.map((col) => (
                  <div key={col.key} className="dt-col-header-cell" ref={registerCellRef(col.key)}>
                    <MessagesColumnInfo infoKey={col.key} />
                    <button
                      type="button"
                      className="dt-col-sort"
                      disabled={col.key !== 'time'}
                      title={col.key === 'time' ? 'Sort by time' : undefined}
                      onClick={
                        col.key === 'time' ? () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')) : undefined
                      }
                    >
                      {col.label}
                      {col.key === 'time' && <span aria-hidden="true"> {sortDir === 'asc' ? '▲' : '▼'}</span>}
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
                ))}
              </div>
              {topPadPx > 0 && <div aria-hidden="true" style={{ height: topPadPx }} />}
              {visible.slice(start, end).map((m) => {
                const isSelected = m.index === selectedIndex;
                const attribution = attributionByIndex.get(m.index) ?? null;
                const fireTier = attribution?.tier ?? null;
                const modification = attribution?.modification ?? null;
                const droppedCopy =
                  m.type === 'send' ? 'Dropped — never sent to the server' : 'Dropped — never delivered to the page';
                return (
                  <div
                    key={`ws-${m.index}`}
                    className={`dt-ws-row ${directionClass(m.type)}${isSelected ? ' dt-ws-row--selected' : ''}${m.synthetic ? ' dt-ws-row--synthetic' : ''}`}
                    title={
                      m.synthetic
                        ? m.capture?.op === 'dropped'
                          ? 'Synthetic row — the page produced this frame; the rule dropped it before send'
                          : 'Synthetic frame — injected by a rule inside the page; never crossed the wire'
                        : opcodeDescription(m.opcode, m.mask)
                    }
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedIndex(m.index)}
                  >
                    <span className="dt-col-dot">
                      {fireTier !== null && (
                        <span
                          className={`dt-fire-dot ${FIRE_DOT_CLASS[fireTier]}`}
                          title={fireDotTitle(m, fireTier, modification)}
                        />
                      )}
                    </span>
                    <span className="dt-ws-dir" aria-hidden="true">
                      {directionArrow(m.type)}
                    </span>
                    {modification === null ? (
                      <span className="dt-ws-data">{frameDataLabel(m)}</span>
                    ) : (
                      // Original | Modified at a glance — the wire side and
                      // the page side of the rewrite, mirroring the preview
                      // pane's split (a side the page/capture never saw
                      // says so instead of pretending).
                      <span className="dt-ws-data dt-ws-data--split">
                        <span className="dt-ws-data-side">
                          {modification.kind === 'replaced-on-wire'
                            ? (modification.original ?? <span className="dt-col-muted">Not captured</span>)
                            : frameDataLabel(m)}
                        </span>
                        <span className="dt-ws-data-split-divider" aria-hidden="true" />
                        <span className="dt-ws-data-side">
                          {modification.kind === 'replaced-in-page' && modification.modified}
                          {modification.kind === 'replaced-on-wire' && frameDataLabel(m)}
                          {modification.kind === 'dropped' && <span className="dt-col-muted">{droppedCopy}</span>}
                        </span>
                      </span>
                    )}
                    <span className="dt-ws-len">{frameLengthLabel(m)}</span>
                    <span className="dt-ws-time" title={streamTimeTooltip(m.atMs)}>
                      {formatStreamTime(m.atMs)}
                    </span>
                    <span className="dt-ws-row-actions">
                      <button
                        type="button"
                        className="dt-btn dt-btn-primary dt-ws-action dt-ws-action--icon"
                        title={copiedIndex === m.index ? 'Copied' : 'Copy payload'}
                        aria-label={copiedIndex === m.index ? 'Copied' : 'Copy payload'}
                        onClick={(e) => handleCopy(e, m)}
                      >
                        {copiedIndex === m.index ? <CheckOutlined /> : <CopyOutlined />}
                      </button>
                      <button
                        type="button"
                        className="dt-btn dt-btn--oh dt-ws-action"
                        title={
                          editRuleForFrame(m)
                            ? 'Edit the message rule that acted on this frame'
                            : 'Create a message rule seeded from this frame'
                        }
                        onClick={(e) => openRuleAction(e, m)}
                      >
                        {editRuleForFrame(m) ? 'Edit rule' : 'Override'}
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
                <MessagePreview
                  frame={selected}
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

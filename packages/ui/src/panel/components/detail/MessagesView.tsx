/**
 * MessagesView — WebSocket frame log for an upgraded HTTP connection,
 * matching the host's Messages tab:
 *
 *   - Toolbar: Clear all, All / Send / Receive direction filter, regex
 *     filter (invalid patterns degrade to a literal match), the
 *     grid/payload split toggle and the `View ▾` menu (compact / wide
 *     column layout, persisted via `devpanelNetwork.messagesLayout`).
 *   - Grid: fire rail | direction rail | Data | Length | Time. The fire
 *     rail mirrors the traffic table's — a per-frame dot where a fired
 *     `ws` rule accounts for the frame (see `message-fire-rail.ts`).
 *     Time is the one sortable column,
 *     ascending by default; the list follows the tail while parked at
 *     the bottom (same pin semantics as the main traffic table). The
 *     headers reuse the traffic table's anatomy — drag-resizable
 *     dividers and hover-revealed (i) popovers that each highlight one
 *     slice of a shared example frame.
 *   - Hovering a row reveals the right-edge actions (Headers-row
 *     idiom): copy the payload, and the rule action — "Edit rule" when
 *     a ws rule fired on this request, otherwise "Add rule" opening the
 *     quick-create popover seeded from the hovered frame.
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
import type { InspectorHarEntry } from '@openheaders/core/types';
import { InfoPopover } from '@openheaders/ui/shared/info-popover';
import { useResetSetting, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { Allotment } from 'allotment';
import { type CSSProperties, type MouseEvent as ReactMouseEvent, useMemo, useRef, useState } from 'react';
import { firedWsRules, type MessageFireTier, messageFireTier } from '../../data/message-fire-rail';
import { buildWsDraftFromFrame } from '../../data/rule-create/rule-draft-bridge';
import type { RulesByUid } from '../../data/rule-create/use-rules-lookup';
import type { InspectorFire } from '../../data/types';
import { useRulePopover } from '../RulePopoverHost';
import { useColumnResize } from '../use-column-resize';
import MessagePreview from './streams/MessagePreview';
import { MessagesColumnInfo, WS_DIRECTION_INFO, WS_FIRE_RAIL_INFO } from './streams/MessagesColumnInfo';
import { MessagesViewMenu } from './streams/MessagesViewMenu';
import StreamGridToolbar, { type WsDirectionFilter } from './streams/StreamGridToolbar';
import { compileStreamFilter } from './streams/stream-filter';
import { formatStreamTime, streamTimeTooltip } from './streams/stream-time';
import { useMessagesSplitLayout } from './streams/use-messages-split-layout';
import { useStickToBottom } from './streams/use-stick-to-bottom';
import { WS_COLUMNS, wsColumnMinWidth, wsGridTemplate } from './streams/ws-grid';
import {
  frameDataLabel,
  frameLengthLabel,
  opcodeDescription,
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
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [clearedCount, setClearedCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useMessagesSplitLayout();
  const [gridLayout, setGridLayout] = useSetting('devpanelNetwork.messagesLayout');
  const resetGridLayout = useResetSetting('devpanelNetwork.messagesLayout');
  const { columnWidths, registerCellRef, beginResize, resetColumnWidth } = useColumnResize(wsColumnMinWidth);

  const all = useMemo(() => wsDisplayFrames(lifecycle, har), [lifecycle, har]);

  const wsRules = useMemo(() => firedWsRules(fires, rulesByUid), [fires, rulesByUid]);

  // Fire-rail tiers, derived per frame from the row's fired ws rules —
  // see `message-fire-rail.ts` for the attribution-honesty contract.
  const fireTierByIndex = useMemo(() => {
    const tiers = new Map<number, MessageFireTier>();
    if (wsRules.length === 0) return tiers;
    for (const frame of all) {
      const tier = messageFireTier(wsRules, frame);
      if (tier !== null) tiers.set(frame.index, tier);
    }
    return tiers;
  }, [all, wsRules]);

  // Hover row actions — copy the payload; edit the fired ws rule in the
  // shared quick-edit popover (same host the Headers rows open), or —
  // scaffold doctrine — create one seeded from the hovered frame.
  const rulePopover = useRulePopover();
  const editRule = wsRules[0] ?? null;
  const openRuleAction = (e: ReactMouseEvent<HTMLButtonElement>, frame: WsDisplayFrame): void => {
    e.stopPropagation();
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const handleCopy = (e: ReactMouseEvent<HTMLButtonElement>, frame: WsDisplayFrame): void => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(frame.data).then(() => {
      setCopiedIndex(frame.index);
      window.setTimeout(() => setCopiedIndex((v) => (v === frame.index ? null : v)), 1200);
    });
  };

  const visible = useMemo(() => {
    const regex = compileStreamFilter(filterText, 'literal');
    const afterClear = clearedCount > 0 ? all.filter((f) => f.index >= clearedCount) : all;
    const filtered = afterClear.filter(
      (f) => (direction === 'all' || f.type === direction) && (!regex || regex.test(f.data)),
    );
    // Arrival order is time order; a stable index tiebreak keeps
    // equal-millisecond frames in wire order under both directions.
    if (sortDir === 'desc') {
      return [...filtered].sort((a, b) => b.atMs - a.atMs || b.index - a.index);
    }
    return filtered;
  }, [all, clearedCount, direction, filterText, sortDir]);

  const { onScroll } = useStickToBottom(listRef, visible.length);

  if (all.length === 0) {
    return (
      <div className="dt-empty" style={{ padding: 24 }}>
        {source === 'cdp'
          ? 'No WebSocket frames exchanged yet.'
          : 'WebSocket frames are only visible with debug mode enabled for this tab.'}
      </div>
    );
  }

  const dropped = lifecycle.messagesDropped ?? 0;
  const selected = selectedIndex != null ? (all.find((f) => f.index === selectedIndex) ?? null) : null;

  const onClear = () => {
    // Hide everything observed so far: the next frame's index is the floor.
    setClearedCount(all.length > 0 ? all[all.length - 1].index + 1 : 0);
    setSelectedIndex(null);
  };

  const selectRelative = (delta: -1 | 1) => {
    if (visible.length === 0) return;
    const pos = selectedIndex == null ? -1 : visible.findIndex((f) => f.index === selectedIndex);
    const next = pos < 0 ? (delta === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, pos + delta));
    setSelectedIndex(visible[next].index);
  };

  return (
    <div className="dt-ws-view" style={{ '--dt-ws-cols': wsGridTemplate(columnWidths, gridLayout) } as CSSProperties}>
      <StreamGridToolbar
        onClear={onClear}
        directionFilter={{ value: direction, onChange: setDirection }}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterPlaceholder="Filter using regex (example: (web)?socket)"
        layoutToggle={{ layout, onChange: setLayout }}
        viewMenu={<MessagesViewMenu layout={gridLayout} onLayoutChange={setGridLayout} onReset={resetGridLayout} />}
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
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  selectRelative(1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  selectRelative(-1);
                }
              }}
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
              {visible.map((m) => {
                const isSelected = m.index === selectedIndex;
                const fireTier = fireTierByIndex.get(m.index) ?? null;
                return (
                  <div
                    key={`ws-${m.index}`}
                    className={`dt-ws-row ${directionClass(m.type)}${isSelected ? ' dt-ws-row--selected' : ''}`}
                    title={opcodeDescription(m.opcode, m.mask)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedIndex(m.index)}
                  >
                    <span className="dt-col-dot">
                      {fireTier !== null && (
                        <span
                          className={`dt-fire-dot ${FIRE_DOT_CLASS[fireTier]}`}
                          title={FIRE_DOT_TITLE[fireTier]}
                        />
                      )}
                    </span>
                    <span className="dt-ws-dir" aria-hidden="true">
                      {directionArrow(m.type)}
                    </span>
                    <span className="dt-ws-data">{frameDataLabel(m)}</span>
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
                        className="dt-btn dt-btn-primary dt-ws-action"
                        title={
                          editRule
                            ? 'Edit the message rule that fired on this request'
                            : 'Create a message rule seeded from this frame'
                        }
                        onClick={(e) => openRuleAction(e, m)}
                      >
                        {editRule ? 'Edit rule' : 'Add rule'}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={layout === 'vertical' ? 60 : 160}>
            <div className="dt-ws-preview">
              <MessagePreview frame={selected} />
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

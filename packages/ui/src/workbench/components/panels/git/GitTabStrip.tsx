/**
 * GitTabStrip — ONE pane's tab row in the Git tool window, the
 * terminal strip's anatomy and mechanism verbatim (minus rename and
 * profiles, which have no git meaning): a content-sized scroll strip,
 * pills with the editor tint law, dnd-kit sortables in the PANEL's
 * shared DndContext (GitGroupRenderer owns it) — sortable ids prefixed
 * with the leaf id, drag data `{ kind: 'git-tab', leafId, tabId }`,
 * source-placeholder collapse + cross-leaf insertion marker driven by
 * the shared git drag intent — the `+` as a sibling after the last
 * tab, an optional right-aligned trailing cluster, and the shared
 * pane-tab context menu (close family gated for the permanent primary
 * tab, split/unsplit verbs included).
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dropdown, theme, Tooltip } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import OverlayScrollThumb from '../../tabbar/OverlayScrollThumb';
import { activePillRing, emptyPlaceholderStyle } from '../../tabbar/tab-format';
import { buildPaneTabContextMenu } from '../pane-tabs/build-pane-tab-context-menu';
import type { SplitDirection } from '../pane-tabs/pane-tabs-store';
import { useGitDragIntent } from './git-drag-intent';

/** Drag payload every git tab publishes into the panel's shared
 *  DndContext — the renderer's handlers route on `kind`. */
export interface GitTabDragData {
  kind: 'git-tab';
  leafId: string;
  tabId: string;
}

export interface GitTabDescriptor {
  key: string;
  label: string;
  /** False on the permanent primary log tab — no ×, Close disabled. */
  closable: boolean;
}

export interface GitTabStripProps {
  leafId: string;
  tabs: GitTabDescriptor[];
  activeKey: string | null;
  /** True while this leaf owns focus AND the git dock owns focus. */
  focused: boolean;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  /** Context-menu bulk closes — owned by the panel, scoped to this
   *  leaf's tabs; the panel's handler skips non-closable tabs. */
  onCloseOther: (key: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (key: string) => void;
  onCloseToRight: (key: string) => void;
  /** New log tab INTO this pane (the renderer focuses the leaf first). */
  onNew: () => void;
  /** Right-aligned cluster (the chevron menu; the split-state corner
   *  strip additionally hosts info + hide). */
  trailing?: React.ReactNode;
  // Split verbs (context menu) — editor tab strip parity.
  onSplitAndMove: (key: string, direction: SplitDirection) => void;
  onMoveToOppositeGroup: (key: string) => void;
  oppositeDirection: 'left' | 'right' | 'up' | 'down' | null;
  parentOrientation: 'horizontal' | 'vertical' | null;
  onChangeSplitterOrientation: () => void;
  onUnsplit: () => void;
  onUnsplitAll: () => void;
  canUnsplit: boolean;
  canUnsplitAll: boolean;
}

interface SortableGitTabProps {
  leafId: string;
  tab: GitTabDescriptor;
  active: boolean;
  focused: boolean;
  contextMenu: { items: ItemType[] };
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

/**
 * One git tab pill — a dnd-kit sortable in the panel's shared
 * DndContext, the terminal SortableTerminalTab mechanism verbatim:
 * neighbors shift via sortable transforms, the source keeps its slot
 * as the shared dashed placeholder with its content hidden (collapsing
 * when the drop intent moves to a drop zone or a foreign strip), and
 * the moving pill is the renderer's DragOverlay preview.
 */
const SortableGitTab: React.FC<SortableGitTabProps> = ({
  leafId,
  tab,
  active,
  focused,
  contextMenu,
  onActivate,
  onClose,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const dragIntent = useGitDragIntent();
  const [hovered, setHovered] = useState(false);
  const data: GitTabDragData = { kind: 'git-tab', leafId, tabId: tab.key };
  // Sortable ids must be unique across ALL SortableContexts that share
  // the panel's DndContext — prefix with the leaf id (editor posture).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${leafId}::${tab.key}`,
    data,
  });

  // Hide the dragged tab's source placeholder whenever the drop intent
  // has moved somewhere OTHER than this strip (drop zone or a tab in a
  // different leaf) — the destination already shows its own preview.
  const isOverForeignLeaf = dragIntent.insertion !== null && dragIntent.insertion.leafId !== leafId;
  const hidePlaceholder =
    isDragging && dragIntent.draggingTabId === tab.key && (dragIntent.overDropZone || isOverForeignLeaf);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(hidePlaceholder ? { visibility: 'hidden' as const } : null),
  };

  const visualStyle: React.CSSProperties = isDragging
    ? emptyPlaceholderStyle(token)
    : {
        background: active
          ? focused
            ? token.colorPrimaryBg
            : token.colorFillSecondary
          : hovered
            ? token.colorFillTertiary
            : 'transparent',
        boxShadow: active ? activePillRing(token, isDarkMode, focused) : undefined,
        color: active ? token.colorText : token.colorTextSecondary,
      };

  const content = (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="tab"
      tabIndex={0}
      aria-selected={active}
      data-testid="git-tool-tab"
      data-tab-key={tab.key}
      data-tab-active={active || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onActivate(tab.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate(tab.key);
      }}
      style={{
        ...sortableStyle,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 8px 2px 10px',
        borderRadius: token.borderRadiusSM,
        cursor: isDragging ? 'grabbing' : 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...visualStyle,
      }}
    >
      {/* Source-placeholder contract: while dragging, the slot stays in
          layout but paints no content — the DragOverlay pill carries it. */}
      <span style={isDragging ? { visibility: 'hidden' } : undefined}>{tab.label}</span>
      {tab.closable && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={t('workbench.gitLog.closeTab')}
          data-testid="git-tool-tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.key);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 9,
            color: token.colorTextTertiary,
            ...(isDragging ? { visibility: 'hidden' as const } : null),
          }}
        >
          <CloseOutlined />
        </span>
      )}
    </span>
  );

  // While dragging, skip the Dropdown wrapper — it would steal pointer
  // capture from dnd-kit (editor tab strip posture).
  if (isDragging) return content;

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']}>
      {content}
    </Dropdown>
  );
};

/** Where the dragged tab would land in THIS strip — the editor's
 *  cross-leaf insertion marker, label-sized. */
const GitTabInsertionMarker: React.FC<{ label: string }> = ({ label }) => {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 8px 2px 10px',
        borderRadius: token.borderRadiusSM,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...emptyPlaceholderStyle(token),
      }}
    >
      <span style={{ visibility: 'hidden' }}>{label}</span>
    </span>
  );
};

const GitTabStrip: React.FC<GitTabStripProps> = ({
  leafId,
  tabs,
  activeKey,
  focused,
  onActivate,
  onClose,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  onNew,
  trailing,
  onSplitAndMove,
  onMoveToOppositeGroup,
  oppositeDirection,
  parentOrientation,
  onChangeSplitterOrientation,
  onUnsplit,
  onUnsplitAll,
  canUnsplit,
  canUnsplitAll,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const dragIntent = useGitDragIntent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll the active tab into view (editor strip posture). ──
  useEffect(() => {
    if (activeKey === null || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].key === activeKey;
    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' });
    } else {
      const el = container.querySelector(`[data-tab-key="${activeKey}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }
  }, [activeKey, tabs]);

  // ── Vertical wheel → horizontal scroll (normalized deltas). ───────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const el = scrollRef.current;
    if (!el) return;
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
    el.scrollLeft += e.deltaY * unit;
  }, []);

  // ── Edge-fade mask only while actually overflowing. ───────────────
  const [hasOverflow, setHasOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollWidth > el.clientWidth + 1;
    if (next !== hasOverflow) setHasOverflow(next);
  });

  const insertionIndex = dragIntent.insertion?.leafId === leafId ? dragIntent.insertion.index : null;
  const insertionLabel = insertionIndex !== null ? dragIntent.draggingLabel : null;

  return (
    <div className="rules-tabs-bar" style={{ flex: 1, minWidth: 0 }}>
      <div className={`rules-tabs-scroll${hasOverflow ? ' is-overflow' : ''}`} ref={scrollRef} onWheel={handleWheel}>
        <SortableContext items={tabs.map((tab) => `${leafId}::${tab.key}`)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, tabIndex) => (
            <Fragment key={tab.key}>
              {insertionIndex === tabIndex && insertionLabel !== null && (
                <GitTabInsertionMarker label={insertionLabel} />
              )}
              <SortableGitTab
                leafId={leafId}
                tab={tab}
                active={tab.key === activeKey}
                focused={focused}
                contextMenu={buildPaneTabContextMenu(
                  {
                    tabId: tab.key,
                    tabIndex,
                    tabCount: tabs.length,
                    closeDisabled: !tab.closable,
                    onClose,
                    onCloseOther,
                    onCloseAll,
                    onCloseToLeft,
                    onCloseToRight,
                    onSplitAndMove,
                    onMoveToOppositeGroup,
                    oppositeDirection,
                    parentOrientation,
                    onChangeSplitterOrientation,
                    onUnsplit,
                    onUnsplitAll,
                    canUnsplit,
                    canUnsplitAll,
                  },
                  t,
                )}
                onActivate={onActivate}
                onClose={onClose}
              />
            </Fragment>
          ))}
          {insertionIndex === tabs.length && insertionLabel !== null && <GitTabInsertionMarker label={insertionLabel} />}
        </SortableContext>
      </div>

      {/* Gecko stand-in for the 3px webkit hover scrollbar. */}
      <OverlayScrollThumb scrollRef={scrollRef} />

      {/* + — sibling outside the scroll strip (editor `+` anatomy). */}
      <Tooltip placement="bottom" title={t('workbench.gitLog.newLogTab')}>
        <div
          className="rules-tab-action rules-tab-action-create"
          role="button"
          tabIndex={0}
          aria-label={t('workbench.gitLog.newLogTab')}
          data-testid="git-tool-tab-new"
          onClick={onNew}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNew();
          }}
          style={{ color: token.colorTextSecondary }}
        >
          <PlusOutlined style={{ fontSize: 12 }} />
        </div>
      </Tooltip>

      {/* Right-aligned cluster — `margin-left: auto` pushes it to the
          bar's edge (the editor chevron's spacing law). */}
      {trailing !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{trailing}</div>
      )}
    </div>
  );
};

export default GitTabStrip;

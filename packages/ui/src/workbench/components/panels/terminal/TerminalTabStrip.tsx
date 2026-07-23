/**
 * TerminalTabStrip — ONE pane's tab row, the terminal twin of the
 * editor's TabBar with the identical bar anatomy: a content-sized
 * scroll strip (`flex: 0 1 auto` via .rules-tabs-scroll), the `+` as a
 * SIBLING outside the scroll container — right after the last tab when
 * the tabs fit, sticky at the strip's right edge when they overflow —
 * and an optional right-aligned trailing cluster pushed by
 * `margin-left: auto` (the panel-global search chevron + Open TUI,
 * present only on the strip that rides the panel header).
 *
 * Pure presentation: tab identities live in the terminal-instance
 * registry, the split layout in the terminal-panes store. Tabs are
 * dnd-kit sortables in the PANEL's shared DndContext (the renderer
 * owns it) — same mechanism as the editor strip: sortable ids prefixed
 * with the leaf id, drag data `{ kind: 'terminal-tab', leafId, tabId }`,
 * source placeholder collapse + cross-leaf insertion marker driven by
 * the shared terminal drag intent.
 */

import { CloseOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUiTheme } from '@openheaders/ui/context';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { Dropdown, theme, Tooltip } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import { useSettingValue } from '../../../settings/hooks';
import OverlayScrollThumb from '../../tabbar/OverlayScrollThumb';
import { activePillRing, emptyPlaceholderStyle } from '../../tabbar/tab-format';
import { buildTerminalTabContextMenu } from './build-terminal-tab-context-menu';
import { useTerminalDragIntent } from './terminal-drag-intent';
import type { TerminalTabInfo } from './terminal-instance';
import type { SplitDirection } from './terminal-panes';

/** Drag payload every terminal tab publishes into the panel's shared
 *  DndContext — the renderer's monitor routes on `kind`. */
export interface TerminalTabDragData {
  kind: 'terminal-tab';
  leafId: string;
  tabId: string;
}

export interface TerminalTabStripProps {
  leafId: string;
  tabs: TerminalTabInfo[];
  activeId: string | null;
  /** True while this leaf owns focus AND the terminal's dock owns
   *  focus — the active tab renders with the primary tint (editor tab
   *  strip posture), neutral grey otherwise. */
  focused: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  /** Context-menu bulk closes — confirm-aware, owned by the panel,
   *  scoped to this leaf's tabs. */
  onCloseOther: (id: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (id: string) => void;
  onCloseToRight: (id: string) => void;
  /** Open the rename modal (panel owns the modal + commit). */
  onRename: (id: string) => void;
  /** New tab INTO this pane (the renderer focuses the leaf first). */
  onNew: () => void;
  /** Terminal profiles for the + chevron — empty hides the chevron. */
  profiles: readonly { id: string; name: string }[];
  onNewWithProfile: (profileId: string) => void;
  /** Right-aligned cluster (search chevron + Open TUI) — only the
   *  header-riding strip carries it. */
  trailing?: React.ReactNode;
  // Split verbs (context menu) — editor tab strip parity.
  onSplitAndMove: (id: string, direction: SplitDirection) => void;
  onMoveToOppositeGroup: (id: string) => void;
  oppositeDirection: 'left' | 'right' | 'up' | 'down' | null;
  parentOrientation: 'horizontal' | 'vertical' | null;
  onChangeSplitterOrientation: () => void;
  onUnsplit: () => void;
  onUnsplitAll: () => void;
  canUnsplit: boolean;
  canUnsplitAll: boolean;
}

export function terminalTabLabel(t: Translate, tab: TerminalTabInfo, defaultName = ''): string {
  if (tab.title !== undefined) return tab.title;
  const custom = defaultName.trim();
  if (custom.length > 0) return tab.titleIndex === 1 ? custom : `${custom} (${tab.titleIndex})`;
  return tab.titleIndex === 1
    ? t('workbench.terminal.tabLocal')
    : t('workbench.terminal.tabLocalN', { n: tab.titleIndex });
}

interface SortableTerminalTabProps {
  leafId: string;
  tab: TerminalTabInfo;
  label: string;
  active: boolean;
  /** Ring/tint posture — see TerminalTabStripProps.focused. */
  focused: boolean;
  contextMenu: { items: ItemType[] };
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

/**
 * One terminal tab pill — a dnd-kit sortable in the panel's shared
 * DndContext, the editor SortableTab mechanism verbatim: neighbors
 * shift via sortable transforms, the source keeps its slot as the
 * shared dashed placeholder with its content hidden (collapsing when
 * the drop intent moves to a drop zone or a foreign strip), and the
 * moving pill is the renderer's DragOverlay preview.
 */
const SortableTerminalTab: React.FC<SortableTerminalTabProps> = ({
  leafId,
  tab,
  label,
  active,
  focused,
  contextMenu,
  onActivate,
  onClose,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const dragIntent = useTerminalDragIntent();
  const [hovered, setHovered] = useState(false);
  const data: TerminalTabDragData = { kind: 'terminal-tab', leafId, tabId: tab.id };
  // Sortable ids must be unique across ALL SortableContexts that share
  // the panel's DndContext — prefix with the leaf id (editor posture).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${leafId}::${tab.id}`,
    data,
  });

  // Hide the dragged tab's source placeholder whenever the drop intent
  // has moved somewhere OTHER than this strip (drop zone or a tab in a
  // different leaf) — the destination already shows its own preview,
  // and the tab must not appear in two places at once. visibility:
  // hidden keeps the slot in layout so dnd-kit's rect tracking stays
  // in sync.
  const isOverForeignLeaf = dragIntent.insertion !== null && dragIntent.insertion.leafId !== leafId;
  const hidePlaceholder =
    isDragging && dragIntent.draggingTabId === tab.id && (dragIntent.overDropZone || isOverForeignLeaf);

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
        // Hairline ring on active pills (activePillRing) — primary
        // tint when this strip owns focus, neutral otherwise.
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
      data-testid="terminal-tab"
      data-tab-id={tab.id}
      data-tab-active={active || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onActivate(tab.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate(tab.id);
      }}
      style={{
        ...sortableStyle,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        // 2px vertical (editor pill metric): leaves the same breathing
        // room above the pill and below it — where the 3px scrollbar
        // gutter rides — so the pill never reads as clipped.
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
      <span style={isDragging ? { visibility: 'hidden' } : undefined}>{label}</span>
      <span
        role="button"
        tabIndex={-1}
        aria-label={t('workbench.terminal.closeTab')}
        data-testid="terminal-tab-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
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
 *  cross-leaf insertion marker, label-sized: the dashed placeholder
 *  pill with the dragged label reserving its width invisibly. */
const TerminalInsertionMarker: React.FC<{ label: string }> = ({ label }) => {
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

const TerminalTabStrip: React.FC<TerminalTabStripProps> = ({
  leafId,
  tabs,
  activeId,
  focused,
  onActivate,
  onClose,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  onRename,
  onNew,
  profiles,
  onNewWithProfile,
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
  const dragIntent = useTerminalDragIntent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const newTabShortcut = useShortcutLabel('terminal-new-tab');
  const defaultTabName = useSettingValue('terminal.defaultTabName');

  // ── Auto-scroll the active tab into view (editor strip posture:
  // instant, and snap to the end when the last tab is active). ──────
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].id === activeId;
    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' });
    } else {
      const el = container.querySelector(`[data-tab-id="${activeId}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }
  }, [activeId, tabs]);

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
      {/* Scrollable tabs — content-sized when tabs fit, shrinks when
          they overflow. The `+` button lives OUTSIDE this element
          (sibling below) so it sits right after the last tab in the
          fit case and stays anchored at the strip's right edge in the
          overflow case — same pattern as the editor tab strip. */}
      <div className={`rules-tabs-scroll${hasOverflow ? ' is-overflow' : ''}`} ref={scrollRef} onWheel={handleWheel}>
        <SortableContext items={tabs.map((tab) => `${leafId}::${tab.id}`)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, tabIndex) => (
            <Fragment key={tab.id}>
              {insertionIndex === tabIndex && insertionLabel !== null && (
                <TerminalInsertionMarker label={insertionLabel} />
              )}
              <SortableTerminalTab
                leafId={leafId}
                tab={tab}
                label={terminalTabLabel(t, tab, defaultTabName)}
                active={tab.id === activeId}
                focused={focused}
                contextMenu={buildTerminalTabContextMenu(
                  {
                    tabId: tab.id,
                    tabIndex,
                    tabCount: tabs.length,
                    onRename,
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
          {insertionIndex === tabs.length && insertionLabel !== null && (
            <TerminalInsertionMarker label={insertionLabel} />
          )}
        </SortableContext>
      </div>

      {/* Gecko stand-in for the 3px webkit hover scrollbar. */}
      <OverlayScrollThumb scrollRef={scrollRef} />

      {/* + — sibling outside the scroll strip (editor `+` anatomy). */}
      <Tooltip
        placement="bottom"
        title={<ShortcutHintTitle label={newTabShortcut}>{t('workbench.terminal.newTab')}</ShortcutHintTitle>}
      >
        <div
          className="rules-tab-action rules-tab-action-create"
          role="button"
          tabIndex={0}
          aria-label={t('workbench.terminal.newTab')}
          data-testid="terminal-tab-new"
          onClick={onNew}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNew();
          }}
          style={{ color: token.colorTextSecondary }}
        >
          <PlusOutlined style={{ fontSize: 12 }} />
        </div>
      </Tooltip>

      {/* Profile half of the split +: only exists once the user has
          created profiles — plain click on + keeps opening the default,
          the chevron picks a specific one. */}
      {profiles.length > 0 && (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: profiles.map((profile) => ({ key: profile.id, label: profile.name })),
            onClick: ({ key }) => onNewWithProfile(key),
          }}
        >
          <Tooltip placement="bottom" title={t('workbench.terminal.newTabWithProfile')}>
            <span
              role="button"
              tabIndex={0}
              aria-label={t('workbench.terminal.newTabWithProfile')}
              data-testid="terminal-tab-new-profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 2px',
                borderRadius: token.borderRadiusSM,
                cursor: 'pointer',
                flexShrink: 0,
                color: token.colorTextSecondary,
              }}
            >
              <DownOutlined style={{ fontSize: 8 }} />
            </span>
          </Tooltip>
        </Dropdown>
      )}

      {/* Right-aligned cluster — `margin-left: auto` pushes it to the
          bar's edge in the fit case and collapses in the overflow case
          (everything packed right), the editor chevron's spacing law. */}
      {trailing !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{trailing}</div>
      )}
    </div>
  );
};

export default TerminalTabStrip;

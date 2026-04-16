import { useDroppable } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { setFocusedDock, setFocusedRegion } from '../data/focus-store';
import {
  ALL_PANEL_DOCK_SLOTS,
  PANEL_DOCK_LABELS,
  PANEL_TOOL_WINDOW_MAP,
  type PanelDockSlot,
  type PanelToolWindowId,
  panelDockRegion,
} from '../data/tool-windows';
import type { PanelDockState, PanelToolLayoutApi } from '../data/use-panel-tool-layout';

// ── Drag data contract ───────────────────────────────────────────

export interface DockTabDragData {
  kind: 'tool-window';
  toolWindowId: PanelToolWindowId;
  fromSlot: PanelDockSlot;
}

// ── Context menu ─────────────────────────────────────────────────

interface DockCtxMenuState {
  x: number;
  y: number;
  windowId: PanelToolWindowId;
}

interface DockCtxMenuProps {
  state: DockCtxMenuState;
  currentSlot: PanelDockSlot;
  tl: PanelToolLayoutApi;
  showLabels: boolean;
  onToggleLabels: () => void;
  onClose: () => void;
}

function DockSlotIcon({ slot }: { slot: PanelDockSlot }) {
  const s = 'var(--dt-text-muted)';
  const f = 'var(--dt-text)';
  const highlight: Record<PanelDockSlot, React.ReactNode> = {
    'left-top': <rect x={0.5} y={0.5} width={5} height={6} fill={f} fillOpacity={0.15} />,
    'left-bottom': <rect x={0.5} y={6.5} width={5} height={6} fill={f} fillOpacity={0.15} />,
    'right-top': <rect x={10.5} y={0.5} width={5} height={6} fill={f} fillOpacity={0.15} />,
    'right-bottom': <rect x={10.5} y={6.5} width={5} height={6} fill={f} fillOpacity={0.15} />,
    'bottom-left': <rect x={5.5} y={8.5} width={5} height={4} fill={f} fillOpacity={0.15} />,
    'bottom-right': <rect x={10.5} y={8.5} width={5} height={4} fill={f} fillOpacity={0.15} />,
  };
  return (
    <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill="none" stroke={s} strokeWidth={1} />
      <line x1={5.5} y1={0.5} x2={5.5} y2={12.5} stroke={s} strokeWidth={0.75} />
      <line x1={10.5} y1={0.5} x2={10.5} y2={12.5} stroke={s} strokeWidth={0.75} />
      <line x1={0.5} y1={6.5} x2={5.5} y2={6.5} stroke={s} strokeWidth={0.75} />
      <line x1={10.5} y1={6.5} x2={15.5} y2={6.5} stroke={s} strokeWidth={0.75} />
      <line x1={5.5} y1={8.5} x2={15.5} y2={8.5} stroke={s} strokeWidth={0.75} />
      {highlight[slot]}
    </svg>
  );
}

const DockContextMenu: React.FC<DockCtxMenuProps> = ({
  state,
  currentSlot,
  tl,
  showLabels,
  onToggleLabels,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const def = PANEL_TOOL_WINDOW_MAP[state.windowId];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} className="dt-ctx-menu" style={{ left: state.x, top: state.y }}>
      <button
        type="button"
        className={`dt-ctx-item${def.core ? ' disabled' : ''}`}
        disabled={def.core}
        onClick={() => {
          tl.hideWindow(state.windowId);
          onClose();
        }}
      >
        Hide
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className="dt-ctx-item dt-ctx-sub"
        onMouseEnter={() => setMoveOpen(true)}
        onMouseLeave={() => setMoveOpen(false)}
      >
        Move to {'\u25B8'}
        {moveOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {ALL_PANEL_DOCK_SLOTS.map((slot, index) => (
              <React.Fragment key={slot}>
                {(index === 2 || index === 4) && <div className="dt-ctx-sep" />}
                <button
                  type="button"
                  className="dt-ctx-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    tl.moveWindow(state.windowId, slot);
                    onClose();
                  }}
                >
                  <span style={{ display: 'inline-flex', width: 20, justifyContent: 'center', flexShrink: 0 }}>
                    <DockSlotIcon slot={slot} />
                  </span>
                  <span style={{ flex: 1 }}>{PANEL_DOCK_LABELS[slot]}</span>
                  {slot === currentSlot && <span style={{ marginLeft: 8, opacity: 0.7 }}>{'\u2713'}</span>}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div className="dt-ctx-sep" />
      <button
        type="button"
        className="dt-ctx-item"
        onClick={() => {
          onToggleLabels();
          onClose();
        }}
      >
        <span style={{ display: 'inline-flex', width: 14 }}>{showLabels ? '\u2713' : ''}</span>
        Show Tool Window Names
      </button>
    </div>
  );
};

// ── Sortable dock tab (renders as activity-bar icon button) ──────

interface SortableDockTabProps {
  slot: PanelDockSlot;
  windowId: PanelToolWindowId;
  isActive: boolean;
  isFocused: boolean;
  showLabels: boolean;
  icon: React.ReactNode;
  onActivate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SortableDockTab: React.FC<SortableDockTabProps> = ({
  slot,
  windowId,
  isActive,
  isFocused,
  showLabels,
  icon,
  onActivate,
  onContextMenu,
}) => {
  const def = PANEL_TOOL_WINDOW_MAP[windowId];
  const data: DockTabDragData = { kind: 'tool-window', toolWindowId: windowId, fromSlot: slot };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tw:${windowId}`,
    data,
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.4 } : undefined),
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit sortable
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: dnd-kit overrides role
    <div
      ref={setNodeRef}
      className={`dt-activity-icon${isDragging ? ' dragging' : ''}`}
      data-state={isActive && isFocused ? 'focused' : isActive ? 'active' : undefined}
      data-tool-window={windowId}
      style={sortableStyle}
      {...attributes}
      {...listeners}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      aria-selected={isActive}
      title={def.label}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onActivate();
      }}
    >
      {icon}
      {showLabels && <span className="dt-activity-label">{def.label}</span>}
    </div>
  );
};

// ── DockTabStrip ─────────────────────────────────────────────────

interface DockTabStripProps {
  slot: PanelDockSlot;
  dock: PanelDockState;
  windows: PanelToolWindowId[];
  tl: PanelToolLayoutApi;
  dragging: boolean;
  focused: boolean;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  icons?: Record<PanelToolWindowId, React.ReactNode>;
}

export const DockTabStrip: React.FC<DockTabStripProps> = ({
  slot,
  dock,
  windows,
  tl,
  dragging,
  focused,
  showLabels = true,
  onToggleLabels,
  icons,
}) => {
  const [ctxMenu, setCtxMenu] = useState<DockCtxMenuState | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `dock:${slot}`,
    data: { slot },
  });

  const handleContextMenu = useCallback((e: React.MouseEvent, windowId: PanelToolWindowId) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, windowId });
  }, []);

  if (windows.length === 0 && !dragging) return null;

  const sortableItems = windows.map((id) => `tw:${id}`);

  const fallbackIcon = (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );

  return (
    <div
      ref={setNodeRef}
      className={`dt-dock-strip${isOver ? ' dt-dock-strip--drag-over' : ''}${dragging && windows.length === 0 ? ' dt-dock-strip--empty-drop' : ''}`}
      data-dock-slot={slot}
    >
      <SortableContext items={sortableItems} strategy={horizontalListSortingStrategy}>
        {windows.map((wId) => (
          <SortableDockTab
            key={wId}
            slot={slot}
            windowId={wId}
            isActive={dock.active === wId}
            isFocused={focused}
            showLabels={showLabels}
            icon={icons?.[wId] ?? fallbackIcon}
            onActivate={() => {
              tl.toggleWindow(wId);
              setFocusedDock(slot);
              setFocusedRegion(panelDockRegion(slot));
            }}
            onContextMenu={(e) => handleContextMenu(e, wId)}
          />
        ))}
      </SortableContext>
      {ctxMenu && (
        <DockContextMenu
          state={ctxMenu}
          currentSlot={slot}
          tl={tl}
          showLabels={showLabels}
          onToggleLabels={onToggleLabels ?? (() => {})}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
};

export default DockTabStrip;

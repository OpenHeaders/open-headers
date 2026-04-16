import { useDroppable } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_PANEL_DOCK_SLOTS,
  PANEL_DOCK_LABELS,
  PANEL_TOOL_WINDOW_MAP,
  type PanelDockSlot,
  type PanelToolWindowId,
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
  onClose: () => void;
}

const DockContextMenu: React.FC<DockCtxMenuProps> = ({ state, currentSlot, tl, onClose }) => {
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
      <div className="dt-ctx-sep" />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className="dt-ctx-item dt-ctx-sub"
        onMouseEnter={() => setMoveOpen(true)}
        onMouseLeave={() => setMoveOpen(false)}
      >
        Move to {'\u25B8'}
        {moveOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {ALL_PANEL_DOCK_SLOTS.filter((s) => s !== currentSlot).map((slot) => (
              <button
                key={slot}
                type="button"
                className="dt-ctx-item"
                onClick={() => {
                  tl.moveWindow(state.windowId, slot);
                  onClose();
                }}
              >
                {PANEL_DOCK_LABELS[slot]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sortable dock tab ────────────────────────────────────────────

interface SortableDockTabProps {
  slot: PanelDockSlot;
  windowId: PanelToolWindowId;
  isActive: boolean;
  onActivate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SortableDockTab: React.FC<SortableDockTabProps> = ({ slot, windowId, isActive, onActivate, onContextMenu }) => {
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
      className={`dt-dock-tab${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
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
      {def.label}
    </div>
  );
};

// ── DockTabStrip ─────────────────────────────────────────────────

interface DockTabStripProps {
  slot: PanelDockSlot;
  dock: PanelDockState;
  tl: PanelToolLayoutApi;
  dragging: boolean;
}

export const DockTabStrip: React.FC<DockTabStripProps> = ({ slot, dock, tl, dragging }) => {
  const [ctxMenu, setCtxMenu] = useState<DockCtxMenuState | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `dock:${slot}`,
    data: { slot },
  });

  const handleContextMenu = useCallback((e: React.MouseEvent, windowId: PanelToolWindowId) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, windowId });
  }, []);

  if (dock.windows.length === 0 && !dragging) return null;

  const sortableItems = dock.windows.map((id) => `tw:${id}`);

  return (
    <div
      ref={setNodeRef}
      className={`dt-dock-tab-strip${isOver ? ' dt-dock-tab-strip--drag-over' : ''}`}
      data-dock-slot={slot}
      role="tablist"
    >
      <SortableContext items={sortableItems} strategy={horizontalListSortingStrategy}>
        {dock.windows.map((wId) => (
          <SortableDockTab
            key={wId}
            slot={slot}
            windowId={wId}
            isActive={dock.active === wId}
            onActivate={() => tl.toggleWindow(wId)}
            onContextMenu={(e) => handleContextMenu(e, wId)}
          />
        ))}
      </SortableContext>
      <div className="dt-dock-tab-strip-spacer" />
      {dock.active && (
        <button type="button" className="dt-dock-tab-strip-close" onClick={() => tl.closeDock(slot)} title="Close">
          {'\u00d7'}
        </button>
      )}
      {ctxMenu && <DockContextMenu state={ctxMenu} currentSlot={slot} tl={tl} onClose={() => setCtxMenu(null)} />}
    </div>
  );
};

export default DockTabStrip;

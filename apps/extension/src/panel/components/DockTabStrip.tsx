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

// ── DockTabStrip ─────────────────────────────────────────────────

interface DockTabStripProps {
  slot: PanelDockSlot;
  dock: PanelDockState;
  tl: PanelToolLayoutApi;
}

export const DockTabStrip: React.FC<DockTabStripProps> = ({ slot, dock, tl }) => {
  const [ctxMenu, setCtxMenu] = useState<DockCtxMenuState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragOverCountRef = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, windowId: PanelToolWindowId) => {
    e.dataTransfer.setData('application/x-dock-window', windowId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-dock-window')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-dock-window')) {
      dragOverCountRef.current++;
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    dragOverCountRef.current--;
    if (dragOverCountRef.current <= 0) {
      dragOverCountRef.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragOverCountRef.current = 0;
      setDragOver(false);
      const windowId = e.dataTransfer.getData('application/x-dock-window') as PanelToolWindowId;
      if (windowId && tl.dockOf(windowId) !== slot) {
        tl.moveWindow(windowId, slot);
      }
    },
    [tl, slot],
  );

  if (dock.windows.length === 0) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dock drag-drop target
    <div
      className={`dt-dock-tab-strip${dragOver ? ' dt-dock-tab-strip--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dock.windows.map((wId) => {
        const def = PANEL_TOOL_WINDOW_MAP[wId];
        const isActive = dock.active === wId;
        return (
          <button
            key={wId}
            type="button"
            className={`dt-dock-tab${isActive ? ' active' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, wId)}
            onClick={() => tl.toggleWindow(wId)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, windowId: wId });
            }}
            title={def.label}
          >
            {def.label}
          </button>
        );
      })}
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

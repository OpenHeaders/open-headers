/**
 * Right-click menu on the traffic list header — column visibility toggles.
 *
 * Portaled to `<body>` (like antd's popovers) so it escapes the dock /
 * allotment subtree that was clipping it; `position: fixed` then resolves
 * against the real viewport. Height is capped the same way the table's
 * `View ▾` dropdown caps its menu — `min(60vh, 480px)`, additionally bounded
 * by the room below the click — with `overflow-y: auto`, so a long column
 * list scrolls INSIDE the menu. Both are CSS values (no JS measurement), so
 * the cap follows the viewport when the panel is resized while the menu is
 * open. `overflow-y` is inline (not a class) so the scroll can never be lost
 * to a stylesheet that didn't load.
 *
 * The Name column is mandatory (Chrome does the same); "Reset columns"
 * restores the default visible set.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type ColumnDef, type ColumnKey, DEFAULT_VISIBLE_COLUMNS } from './columns';

export interface ColumnHeaderContextMenuState {
  x: number;
  y: number;
}

interface ColumnHeaderContextMenuProps {
  state: ColumnHeaderContextMenuState;
  columns: readonly ColumnDef[];
  visible: ReadonlySet<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onReset: () => void;
  onClose: () => void;
}

const MANDATORY: ReadonlySet<ColumnKey> = new Set(['name']);

export function ColumnHeaderContextMenu({
  state,
  columns,
  visible,
  onToggle,
  onReset,
  onClose,
}: ColumnHeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  const isDefault = (() => {
    if (visible.size !== DEFAULT_VISIBLE_COLUMNS.length) return false;
    for (const k of DEFAULT_VISIBLE_COLUMNS) if (!visible.has(k)) return false;
    return true;
  })();

  return createPortal(
    <div
      ref={menuRef}
      className="dt-ctx-menu dt-ctx-menu--scroll"
      style={{
        left: state.x,
        top: state.y,
        // Same cap as the `View ▾` menu, also bounded by the space below the
        // click so it never runs past the panel bottom. All CSS, so it
        // re-resolves automatically when the panel is resized.
        maxHeight: `min(60vh, 480px, calc(100vh - ${state.y}px - 8px))`,
        overflowY: 'auto',
      }}
    >
      {columns.map((col) => {
        const checked = visible.has(col.key);
        const disabled = MANDATORY.has(col.key);
        return (
          <button
            key={col.key}
            type="button"
            className={`dt-ctx-item dt-ctx-check${disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (disabled) return;
              onToggle(col.key);
            }}
            disabled={disabled}
          >
            <span className="dt-ctx-check-mark">{checked ? '✓' : ''}</span>
            <span>{col.label}</span>
          </button>
        );
      })}
      <div className="dt-ctx-sep" />
      <button
        type="button"
        className={`dt-ctx-item${isDefault ? ' disabled' : ''}`}
        onClick={() => {
          if (isDefault) return;
          onReset();
          onClose();
        }}
        disabled={isDefault}
      >
        Reset columns
      </button>
    </div>,
    document.body,
  );
}

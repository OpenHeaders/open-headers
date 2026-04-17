/**
 * Right-click menu on the traffic list header.
 *
 * Each entry is a checkbox-like toggle for one column; clicking it
 * adds or removes that column from the visible set. The Name column
 * is treated as mandatory (you can't hide "Name") — Chrome's Network
 * tab does the same. A "Reset columns" entry restores the default
 * visible set.
 */

import { useEffect, useRef } from 'react';
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

  return (
    <div ref={menuRef} className="dt-ctx-menu" style={{ left: state.x, top: state.y }}>
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
            <span className="dt-ctx-check-mark">{checked ? '\u2713' : ''}</span>
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
    </div>
  );
}

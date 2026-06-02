/**
 * Right-click menu on the traffic list header — column visibility toggles.
 *
 * Portaled to `<body>` (like antd's popovers) so it escapes the dock /
 * allotment subtree that was clipping it; `position: fixed` then resolves
 * against the real viewport.
 *
 * Structure mirrors the dock's reveal-on-hover scrollbars: an OUTER box (the
 * hover target + chrome) wraps an INNER scroll region. The scrollbar lives on
 * the inner element and its thumb is revealed by hovering the OUTER, because
 * Chromium only repaints a hover-driven scrollbar thumb reliably when the
 * `:hover` is on an ancestor — not on the scroll element itself. Height is
 * capped the same way the `View ▾` dropdown caps its menu (`min(60vh, 480px)`,
 * further bounded by the room below the click), with `overflow-y` inline so
 * scrolling survives even if the stylesheet is missing.
 *
 * The Name column is mandatory (Chrome does the same); "Reset columns"
 * restores the default visible set.
 */

import { Fragment, useEffect, useRef } from 'react';
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
    <div ref={menuRef} className="dt-ctx-menu dt-ctx-menu--scrollhost" style={{ left: state.x, top: state.y }}>
      <div
        className="dt-ctx-menu-scroll"
        style={{ maxHeight: `min(60vh, 480px, calc(100vh - ${state.y}px - 8px))`, overflowY: 'auto' }}
      >
        {columns.map((col) => {
          const checked = visible.has(col.key);
          const disabled = MANDATORY.has(col.key);
          return (
            <Fragment key={col.key}>
              <button
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
              {/* Name / Path / URL are one group (Chrome parity) — divide it
                  from the rest after URL. */}
              {col.key === 'url' && <div className="dt-ctx-sep" />}
            </Fragment>
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
    </div>,
    document.body,
  );
}

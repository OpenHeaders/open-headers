/**
 * Right-click menu on the traffic list header — column visibility toggles
 * plus a Waterfall-metric submenu.
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
 * capped to the room below the click (`calc(100vh - clickY - 8px)`), so it
 * grows to fit and only scrolls when the list can't, with `overflow-y` inline
 * so scrolling survives even if the stylesheet is missing.
 *
 * The Waterfall row opens an antd Popover submenu (portaled, so the menu's own
 * scroll-overflow can't clip it) for the active waterfall metric. Selecting a
 * metric changes only the displayed metric — it does not force a sort, unlike
 * the View menu's waterfall row.
 *
 * The Name column is mandatory (Chrome does the same); "Reset columns"
 * restores the default visible set.
 */

import { Popover } from 'antd';
import { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type WaterfallMetric, WATERFALL_METRIC_LABELS } from '../../data/network-columns';
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
  waterfallMetric: WaterfallMetric;
  onWaterfallMetricChange: (metric: WaterfallMetric) => void;
}

const MANDATORY: ReadonlySet<ColumnKey> = new Set(['name']);
const WATERFALL_METRICS: readonly WaterfallMetric[] = [
  'startTime',
  'responseTime',
  'endTime',
  'duration',
  'latency',
];

export function ColumnHeaderContextMenu({
  state,
  columns,
  visible,
  onToggle,
  onReset,
  onClose,
  waterfallMetric,
  onWaterfallMetricChange,
}: ColumnHeaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (menuRef.current?.contains(target ?? null)) return;
      // The Waterfall submenu is portaled outside the menu DOM — clicks in it
      // are still "inside" the menu for the purpose of staying open.
      if (target?.closest('.dt-colmenu-submenu')) return;
      onClose();
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

  const waterfallSubmenu = (
    <div className="dt-colmenu-submenu-list">
      {WATERFALL_METRICS.map((m) => (
        <button
          key={m}
          type="button"
          className="dt-ctx-item dt-ctx-check"
          onClick={() => {
            onWaterfallMetricChange(m);
            onClose();
          }}
        >
          <span className="dt-ctx-check-mark">{m === waterfallMetric ? '✓' : ''}</span>
          <span>{WATERFALL_METRIC_LABELS[m]}</span>
        </button>
      ))}
    </div>
  );

  return createPortal(
    <div ref={menuRef} className="dt-ctx-menu dt-ctx-menu--scrollhost" style={{ left: state.x, top: state.y }}>
      <div
        className="dt-ctx-menu-scroll"
        style={{ maxHeight: `calc(100vh - ${state.y}px - 8px)`, overflowY: 'auto' }}
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
        <div className="dt-ctx-sep" />
        <Popover
          content={waterfallSubmenu}
          trigger="hover"
          placement="rightTop"
          arrow={false}
          overlayClassName="dt-morefilters-popover dt-colmenu-submenu"
          mouseEnterDelay={0.05}
          mouseLeaveDelay={0.1}
        >
          <button type="button" className="dt-ctx-item dt-ctx-check dt-ctx-submenu-trigger">
            <span className="dt-ctx-check-mark" />
            <span>Waterfall</span>
            <span className="dt-ctx-caret" aria-hidden="true">
              ▸
            </span>
          </button>
        </Popover>
      </div>
    </div>,
    document.body,
  );
}

/**
 * EditableGridTable — generic three-column (Key / Value / Description)
 * editable grid. Powers every "list of named rows" table in the
 * request editor (Params, Headers, form-data body, x-www-form-urlencoded
 * body). Features shared across all of them:
 *
 *   • Sticky header row with a right-aligned `Bulk Edit` toggle and a
 *     `⋯` overflow menu that hides / shows the Value + Description
 *     columns. Key is always visible.
 *   • Bulk-edit mode: swaps the table for a plain `<textarea>` using
 *     caller-supplied `serialize` / `parse` hooks. Disabled entries
 *     survive the round-trip (convention: `//` prefix marks disabled,
 *     ` # note` suffix carries description).
 *   • Per-row drag handle + delete button, both hover-revealed on the
 *     row. Enable checkbox, text inputs for Key + Description.
 *   • Persistent empty "ghost" row that materializes on first keystroke
 *     and a fresh ghost appears below.
 *   • Sortable user rows via @dnd-kit (ghost row is drag-disabled).
 *   • Optional read-only "suggestion" rows rendered above user rows —
 *     used by Headers to surface browser-managed auto-generated entries
 *     with a toggleable checkbox + info-icon tooltip.
 *
 * What varies across tables:
 *
 *   • Row shape. Params/Headers use the flat `{key, value, description}`
 *     shape; form-data body parts have a `kind` discriminant. The
 *     component is generic over `Row` with an `adapter` that projects
 *     `{id, enabled, key, description}` and exposes immutable setters
 *     + a `makeEmpty` / `isEmpty` pair for the ghost-row logic.
 *   • Value cell. `renderValueCell(row, update)` lets the caller own
 *     the rendering — Params/Headers render a plain `<Input>`;
 *     form-data renders a per-row Text/File selector that swaps
 *     between a text input and a file picker.
 *   • Bulk-edit payload. Text-only tables (Params, Headers,
 *     x-www-form-urlencoded) pass `bulkEdit`; multipart form-data
 *     doesn't (file references don't round-trip through text).
 */

import { DeleteOutlined, EditOutlined, HolderOutlined, InfoCircleOutlined, MoreOutlined } from '@ant-design/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Checkbox, Input, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ConflictDiffChip, SetRowConflictChip } from '@openheaders/ui/shared/awareness';
import type { PathConflict } from '@openheaders/ui/shared/conflicts/types';
import { GRID_RESIZING_BODY_CLASS, type ResizableColumn, useGridColumnResize } from './use-grid-column-resize';

/** Read-only informational row rendered above user rows — e.g. Headers'
 *  browser-managed auto-generated entries. Not draggable, not part of
 *  the sortable context. */
export interface SuggestionRow {
  key: string;
  value: string;
  /** Tooltip body shown under the info icon on the Key cell. */
  hint?: string;
  /** Current enable state — toggled by the row's checkbox. */
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * Row-shape adapter: lets the shell read/write the four common fields
 * (id, enabled, key, description) plus ghost-row hooks without the
 * shell knowing the concrete row type.
 */
export interface EditableRowAdapter<Row> {
  getId: (row: Row) => string;
  getEnabled: (row: Row) => boolean;
  setEnabled: (row: Row, value: boolean) => Row;
  getKey: (row: Row) => string;
  setKey: (row: Row, value: string) => Row;
  getDescription: (row: Row) => string;
  setDescription: (row: Row, value: string) => Row;
  /** Produce a fresh empty row. Called every time the user fills in
   *  the ghost row so a new ghost appears below. */
  makeEmpty: () => Row;
  /** Return true when `row` is still the empty-ghost shape — used to
   *  auto-append / auto-trim the trailing ghost row. */
  isEmpty: (row: Row) => boolean;
}

/** Bulk-edit config: pluggable parse/serialize hooks so each table
 *  can pick its own textarea format (Params uses `key:value`,
 *  Headers uses `key: value`, form-urlencoded uses `key=value`). */
export interface BulkEditConfig<Row> {
  serialize: (rows: Row[]) => string;
  parse: (text: string) => Row[];
  placeholder?: string;
}

export interface EditableGridTableProps<Row> {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  adapter: EditableRowAdapter<Row>;
  /** Render the Value cell. The shell owns layout + borders; the
   *  caller owns the control inside the cell. `update(next)` commits
   *  a full row replacement. */
  renderValueCell: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  /** Optional override for the Key cell's control. Same contract as
   *  `renderValueCell` — when omitted the shell renders a plain
   *  `<Input>`. Callers that want a rich field (e.g. `TemplateInput`
   *  for `{{ref}}` highlighting + a scrollable overflow) pass this. */
  renderKeyCell?: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  /** Optional override for the Description cell's control. Same
   *  contract as `renderValueCell`; omit for the default `<Input>`. */
  renderDescriptionCell?: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  keyPlaceholder?: string;
  hideEnabled?: boolean;
  suggestionRows?: SuggestionRow[];
  /** Enable the "Bulk Edit" toggle in the header. When the user
   *  clicks it, the table swaps for a textarea with the serialized
   *  rows; clicking again parses the textarea back into rows. */
  bulkEdit?: BulkEditConfig<Row>;
  /** Per-column width overrides — default is `minmax(0, 1fr)` for each
   *  of Key / Value / Description (flex to fit, no fixed min). */
  columnWidths?: {
    key?: string;
    value?: string;
    description?: string;
  };
  /** Optional per-cell awareness path. When provided, the Key / Value
   *  / Description cells of each row are wrapped with a layout-neutral
   *  `data-field-path` span so a focus-capture ancestor walk resolves
   *  to the canonical schema path (`headers.<uid>.value`,
   *  `params.<uid>.key`). Receives the row's stable id (per
   *  `adapter.getId`) so callers can build uid-keyed paths that
   *  survive reorders + cross-surface joins. The trailing placeholder
   *  ghost reuses its synthesized id; once the user types into it the
   *  row materializes with that same id. */
  rowPath?: (rowId: string, leaf: 'key' | 'value' | 'description') => string;
  /** Inline conflict bridge — when supplied, each row's Key / Value /
   *  Description cell renders a `<ConflictDiffChip>` when the entity-level
   *  conflict tracker reports a leaf conflict at the matching `rowPath`,
   *  and a `<SetRowConflictChip>` when the saved version dropped this row
   *  but the form still has it. Mirrors the bridge shape used by
   *  `VariableTable` + `HeaderRuleFields` so the same tracker primitives
   *  feed every editor. */
  conflictBridge?: KeyValueRowConflictBridge;
}

/** Inline-conflict bridge for rows in the shared editable grid. The
 *  table calls `getLeafConflict(rowPath(uid, leaf), local)` on every
 *  cell and renders the chip when the result is non-null. The set
 *  chip surfaces a "saved version removed this row" affordance — the
 *  table calls `getSetConflict(setPath, uid, true)` once per row. */
export interface KeyValueRowConflictBridge {
  /** Schema-aligned set path (e.g. `'headers'` / `'params'`). Used to
   *  encode the set-level accept/dismiss path: `set:<setPath>.<uid>`. */
  setPath: string;
  getLeafConflict(path: string, local: string): PathConflict | null;
  getSetConflict?(setPath: string, uid: string, formContainsUid: boolean): PathConflict | null;
  onAcceptTheirs(path: string, theirs: string): void;
  onDismiss(path: string): void;
}

// Smallest a flex column shrinks to — also the resize-drag floor. Kept
// low so the default (all flex) still fits the narrow side-by-side
// request pane: 3 × MIN + the ~80px fixed columns stays under its ~288px
// content width, so columns flex to fit instead of forcing a horizontal
// scroll (the 180px floor this replaced summed to a ~620px hard minimum
// that overflowed). The min also stops a column vanishing when its
// neighbours are dragged wide.
const RESIZE_MIN_WIDTH = 50;

// `minmax(MIN, 1fr)` flex track for a column with no user resize. Every
// cell sets `min-width: 0`, so inputs shrink with their column and
// scroll their own overflow internally.
const DEFAULT_COLUMN_WIDTH = `minmax(${RESIZE_MIN_WIDTH}px, 1fr)`;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

// One collapsed-cell line height (matches the cell field's middle
// minHeight). Rows top-align (`align-items: start`) so an expanded cell's
// first line lines up with its siblings; giving the small leading/
// trailing controls this min-height keeps them on that first line
// instead of floating to the top of a grown row.
const ROW_CONTROL_HEIGHT = 32;

// Column-header label cell. `min-width: 0` + ellipsis so the label
// truncates within its (possibly narrow) flex column instead of
// spilling into the neighbouring column / trailing actions.
const headerLabelStyle: React.CSSProperties = {
  padding: '6px 10px',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Hover-reveal for the drag handle + delete button (same transition so
// the row controls appear/disappear together), plus the hover highlight
// for the `⋯` options-menu rows. Injected once at module load so every
// usage shares the same CSS rule.
const STYLE_ID = 'editable-grid-row-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.editable-grid-row .editable-grid-drag-handle,
.editable-grid-row .editable-grid-delete { opacity: 0; transition: opacity 120ms ease; }
.editable-grid-row:hover .editable-grid-drag-handle,
.editable-grid-row:hover .editable-grid-delete { opacity: 1; }
.editable-grid-row .editable-grid-drag-handle:active { cursor: grabbing; }
.editable-grid-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.editable-grid-menu-item:hover {
  background: var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04));
}
.editable-grid-col-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 8px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
  z-index: 3;
}
.editable-grid-col-resizer:hover::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  right: 0;
  width: 2px;
  border-radius: 1px;
  background: var(--ant-color-primary, #1677ff);
}
body.${GRID_RESIZING_BODY_CLASS} {
  cursor: col-resize !important;
  user-select: none !important;
}
  `;
  document.head.appendChild(style);
}

export function EditableGridTable<Row>({
  rows,
  onChange,
  adapter,
  renderValueCell,
  renderKeyCell,
  renderDescriptionCell,
  keyPlaceholder = 'Key',
  hideEnabled = false,
  suggestionRows = [],
  bulkEdit,
  columnWidths,
  rowPath,
  conflictBridge,
}: EditableGridTableProps<Row>): React.ReactElement {
  const { token } = theme.useToken();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showValueColumn, setShowValueColumn] = useState(true);
  const [showDescriptionColumn, setShowDescriptionColumn] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const resize = useGridColumnResize(RESIZE_MIN_WIDTH);

  // Ordered visible flex columns. The LAST one always flexes (absorbs
  // the remaining width); only the columns before it carry a resize
  // handle + an optional px override.
  const flexColumns = useMemo<ResizableColumn[]>(() => {
    const cols: ResizableColumn[] = ['key'];
    if (showValueColumn) cols.push('value');
    if (showDescriptionColumn) cols.push('description');
    return cols;
  }, [showValueColumn, showDescriptionColumn]);
  const lastFlexColumn = flexColumns[flexColumns.length - 1];

  // Table container — its client width is the visible budget a resize
  // must fit within (measured live at drag start).
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fixedColumnsWidth = 20 + (hideEnabled ? 0 : 28) + 32;
  // The most a dragged column can grow before the OTHER columns would be
  // squeezed under their minimums (fixed columns at their size, already-
  // resized columns at their px, remaining flex columns at MIN). Beyond
  // this the table would overflow, so the drag clamps here instead.
  const columnResizeMax = useCallback(
    (dragged: ResizableColumn) => {
      let othersMin = fixedColumnsWidth;
      for (const c of flexColumns) {
        if (c === dragged) continue;
        const isResized = c !== lastFlexColumn && resize.widths[c] != null;
        othersMin += isResized ? (resize.widths[c] as number) : RESIZE_MIN_WIDTH;
      }
      const avail = tableContainerRef.current?.clientWidth ?? Number.POSITIVE_INFINITY;
      return avail - othersMin;
    },
    [fixedColumnsWidth, flexColumns, lastFlexColumn, resize.widths],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Compute grid template from visibility + caller widths + user resize
  // overrides. A non-last column with a drag override becomes a fixed px
  // track; everything else keeps its flex track so the last column
  // absorbs the remaining width.
  const gridTemplate = useMemo(() => {
    const trackFor = (col: ResizableColumn) => {
      if (col !== lastFlexColumn && resize.widths[col] != null) return `${resize.widths[col]}px`;
      return columnWidths?.[col] ?? DEFAULT_COLUMN_WIDTH;
    };
    const parts: string[] = ['20px'];
    if (!hideEnabled) parts.push('28px');
    parts.push(trackFor('key'));
    if (showValueColumn) parts.push(trackFor('value'));
    if (showDescriptionColumn) parts.push(trackFor('description'));
    parts.push('32px');
    return parts.join(' ');
  }, [hideEnabled, showValueColumn, showDescriptionColumn, columnWidths, resize.widths, lastFlexColumn]);

  // Persistent empty ghost row: materializes as soon as the user types
  // into any cell and a fresh ghost appears below.
  const effectiveRows = useMemo(() => {
    const last = rows[rows.length - 1];
    if (!last || !adapter.isEmpty(last)) {
      return [...rows, adapter.makeEmpty()];
    }
    return rows;
  }, [rows, adapter]);

  const commit = useCallback(
    (next: Row[]) => {
      const tail = next[next.length - 1];
      const tidy = tail && adapter.isEmpty(tail) ? next.slice(0, -1) : next;
      onChange(tidy);
    },
    [adapter, onChange],
  );

  const updateRow = useCallback(
    (id: string, next: Row) => {
      commit(effectiveRows.map((r) => (adapter.getId(r) === id ? next : r)));
    },
    [adapter, commit, effectiveRows],
  );

  const removeRow = useCallback(
    (id: string) => {
      commit(effectiveRows.filter((r) => adapter.getId(r) !== id));
    },
    [adapter, commit, effectiveRows],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = effectiveRows.findIndex((r) => adapter.getId(r) === String(active.id));
      const newIndex = effectiveRows.findIndex((r) => adapter.getId(r) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      commit(arrayMove(effectiveRows, oldIndex, newIndex));
    },
    [adapter, commit, effectiveRows],
  );

  const enterBulk = () => {
    if (!bulkEdit) return;
    setBulkText(bulkEdit.serialize(rows));
    setBulkMode(true);
  };
  const exitBulk = () => {
    if (!bulkEdit) return;
    onChange(bulkEdit.parse(bulkText));
    setBulkMode(false);
  };

  const rowIds = effectiveRows.map((r) => adapter.getId(r));

  // ── Header cell sequence (keeps the grid template in sync) ──────

  // Table-level actions live in the `⋯` overflow menu, not as inline
  // header buttons: the grid's trailing column is only ~32px wide (it
  // aligns with the per-row delete button), so a visible "Bulk Edit"
  // button would overflow it and collide with the rightmost column
  // label once the columns flex narrow.
  // Column toggles are full-row hoverable items: the row is the click
  // target (the AntD Checkbox is a non-interactive indicator via
  // `pointer-events: none`) so clicking anywhere on the row flips it and
  // the whole row highlights on hover.
  const toggleColumnItem = (label: string, checked: boolean, toggle: () => void) => (
    <div
      className="editable-grid-menu-item"
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <Checkbox checked={checked} style={{ pointerEvents: 'none' }} />
      <span>{label}</span>
    </div>
  );

  const optionsPopoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
      {bulkEdit && (
        <>
          <button
            type="button"
            className="editable-grid-menu-item"
            onClick={() => {
              setOptionsOpen(false);
              if (bulkMode) exitBulk();
              else enterBulk();
            }}
          >
            <EditOutlined style={{ color: token.colorTextTertiary }} />
            {bulkMode ? 'Key-Value Edit' : 'Bulk Edit'}
          </button>
          <div style={{ height: 1, background: token.colorBorderSecondary, margin: '4px 0' }} />
        </>
      )}
      <div style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 500, padding: '2px 8px' }}>
        Show columns
      </div>
      {toggleColumnItem('Value', showValueColumn, () => setShowValueColumn((v) => !v))}
      {toggleColumnItem('Description', showDescriptionColumn, () => setShowDescriptionColumn((v) => !v))}
    </div>
  );

  const trailingActionsCell = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Popover
        content={optionsPopoverContent}
        trigger="click"
        placement="bottomRight"
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
      >
        <Button
          size="small"
          type="text"
          icon={<MoreOutlined />}
          aria-label="Table options"
          style={{ color: token.colorTextTertiary }}
        />
      </Popover>
    </div>
  );

  // Header label cell + (for every flex column except the last) a
  // draggable resizer at its right edge. The drag rewrites the shared
  // grid template, so all rows reflow together; double-click resets the
  // column to its flex default.
  const renderHeaderLabel = (col: ResizableColumn, label: string, withBorder: boolean) => (
    <span
      ref={resize.registerHeaderRef(col)}
      style={{
        ...headerLabelStyle,
        position: 'relative',
        ...(withBorder ? { borderLeft: `1px solid ${token.colorBorderSecondary}` } : null),
      }}
    >
      {label}
      {col !== lastFlexColumn && (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer-drag-only resize affordance
        <span
          className="editable-grid-col-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
          onPointerDown={(e) => resize.beginResize(e, col, columnResizeMax(col))}
          onDoubleClick={() => resize.resetColumn(col)}
        />
      )}
    </span>
  );

  return (
    <div
      ref={tableContainerRef}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        overflow: 'visible',
      }}
    >
      {/* Header row — sticky to the parent scroll container. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          // Opaque sticky header: composite the alpha header tint over the
          // panel background so scrolled rows can't bleed through it.
          // `colorFillAlter` alone is semi-transparent and lets content
          // show through as the rows pass behind.
          background: `linear-gradient(${token.colorFillAlter}, ${token.colorFillAlter}), ${token.colorBgContainer}`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 12,
          fontWeight: 500,
          color: token.colorTextSecondary,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          boxShadow: `0 1px 0 ${token.colorBorderSecondary}`,
        }}
      >
        <span />
        {!hideEnabled && <span />}
        {renderHeaderLabel('key', 'Key', false)}
        {showValueColumn && renderHeaderLabel('value', 'Value', true)}
        {showDescriptionColumn && renderHeaderLabel('description', 'Description', true)}
        {trailingActionsCell}
      </div>

      {bulkMode ? (
        <Input.TextArea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={bulkEdit?.placeholder}
          autoSize={{ minRows: 6, maxRows: 18 }}
          variant="borderless"
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            padding: '8px 12px',
            background: token.colorBgContainer,
          }}
        />
      ) : (
        <>
          {/* Suggestion rows — read-only, toggleable, not draggable. */}
          {suggestionRows.map((s) => (
            <div
              key={`suggestion:${s.key}`}
              style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                alignItems: 'center',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span />
              {!hideEnabled && (
                <span style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => s.onToggle(e.target.checked)}
                    style={{
                      width: 14,
                      height: 14,
                      cursor: 'pointer',
                      opacity: s.enabled ? 0.65 : 1,
                    }}
                  />
                </span>
              )}
              <span
                style={{
                  ...cellFont,
                  padding: '6px 10px',
                  color: s.enabled ? token.colorText : token.colorTextQuaternary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.key}
                </span>
                {s.hint && (
                  <Tooltip title={s.hint}>
                    <InfoCircleOutlined
                      style={{ color: token.colorTextTertiary, fontSize: 12, cursor: 'help', flexShrink: 0 }}
                    />
                  </Tooltip>
                )}
              </span>
              {showValueColumn && (
                <span
                  style={{
                    ...cellFont,
                    padding: '6px 10px',
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                    color: s.enabled ? token.colorTextSecondary : token.colorTextQuaternary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.value}
                </span>
              )}
              {showDescriptionColumn && (
                <span
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                  }}
                />
              )}
              <span />
            </div>
          ))}

          {/* User rows — sortable. */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {effectiveRows.map((r, i) => {
                const isPlaceholder = i === effectiveRows.length - 1 && adapter.isEmpty(r);
                return (
                  <SortableEditableRow
                    key={adapter.getId(r)}
                    row={r}
                    adapter={adapter}
                    isPlaceholder={isPlaceholder}
                    gridTemplate={gridTemplate}
                    hideEnabled={hideEnabled}
                    showValueColumn={showValueColumn}
                    showDescriptionColumn={showDescriptionColumn}
                    keyPlaceholder={keyPlaceholder}
                    renderValueCell={renderValueCell}
                    renderKeyCell={renderKeyCell}
                    renderDescriptionCell={renderDescriptionCell}
                    rowPath={rowPath}
                    conflictBridge={conflictBridge}
                    isPersisted={!isPlaceholder}
                    onUpdate={(next) => updateRow(adapter.getId(r), next)}
                    onRemove={() => removeRow(adapter.getId(r))}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

interface SortableEditableRowProps<Row> {
  row: Row;
  adapter: EditableRowAdapter<Row>;
  isPlaceholder: boolean;
  gridTemplate: string;
  hideEnabled: boolean;
  showValueColumn: boolean;
  showDescriptionColumn: boolean;
  keyPlaceholder: string;
  renderValueCell: EditableGridTableProps<Row>['renderValueCell'];
  renderKeyCell?: EditableGridTableProps<Row>['renderKeyCell'];
  renderDescriptionCell?: EditableGridTableProps<Row>['renderDescriptionCell'];
  rowPath?: EditableGridTableProps<Row>['rowPath'];
  conflictBridge?: KeyValueRowConflictBridge;
  /** True for materialized rows (not the trailing ghost). Conflict
   *  chips suppress on placeholder rows since they have no persisted
   *  identity in the canonical baseline. */
  isPersisted: boolean;
  onUpdate: (next: Row) => void;
  onRemove: () => void;
}

function SortableEditableRow<Row>({
  row,
  adapter,
  isPlaceholder,
  gridTemplate,
  hideEnabled,
  showValueColumn,
  showDescriptionColumn,
  keyPlaceholder,
  renderValueCell,
  renderKeyCell,
  renderDescriptionCell,
  rowPath,
  conflictBridge,
  isPersisted,
  onUpdate,
  onRemove,
}: SortableEditableRowProps<Row>): React.ReactElement {
  const { token } = theme.useToken();
  const id = adapter.getId(row);

  // ── Conflict lookups ──────────────────────────────────────────
  // Suppress on placeholder rows — they have no canonical baseline
  // entry. Once the user types the row materializes with this same
  // uid; chips light up on the next render via the bridge.
  const showConflicts = !!conflictBridge && isPersisted;
  const localKey = adapter.getKey(row);
  const localDescription = adapter.getDescription(row);
  // `renderValueCell` owns the value control — we don't have direct
  // access to its string. Read it off the row via the convention that
  // KeyValueRow's `value` is the controlled string. The chip lookup is
  // tolerant of `undefined`: falls back to empty string.
  const localValue = String(((row as unknown as { value?: unknown }).value ?? ''));
  const keyPath = rowPath?.(id, 'key');
  const valuePath = rowPath?.(id, 'value');
  const descPath = rowPath?.(id, 'description');
  const keyConflict =
    showConflicts && keyPath ? (conflictBridge?.getLeafConflict(keyPath, localKey) ?? null) : null;
  const valueConflict =
    showConflicts && valuePath ? (conflictBridge?.getLeafConflict(valuePath, localValue) ?? null) : null;
  const descConflict =
    showConflicts && descPath ? (conflictBridge?.getLeafConflict(descPath, localDescription) ?? null) : null;
  const setRowConflictRaw =
    showConflicts && conflictBridge?.getSetConflict
      ? conflictBridge.getSetConflict(conflictBridge.setPath, id, true)
      : null;
  const setRowConflict = setRowConflictRaw?.kind === 'set-remove' ? setRowConflictRaw : null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isPlaceholder,
  });
  const enabled = adapter.getEnabled(row);
  const dim = !enabled || isPlaceholder;

  // Row-level expand: focusing any cell expands EVERY cell in the row
  // (each grows to its own content) so the whole row is readable while
  // editing — not just the focused cell. Collapses back to ellipses when
  // focus leaves the row entirely.
  const [rowFocused, setRowFocused] = useState(false);

  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplate,
    alignItems: 'start',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? token.colorFillTertiary : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="editable-grid-row"
      onFocusCapture={() => setRowFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRowFocused(false);
      }}
    >
      <span
        {...(isPlaceholder ? {} : attributes)}
        {...(isPlaceholder ? {} : listeners)}
        className="editable-grid-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: ROW_CONTROL_HEIGHT,
          cursor: isPlaceholder ? 'default' : 'grab',
          color: token.colorTextTertiary,
          fontSize: 12,
          visibility: isPlaceholder ? 'hidden' : 'visible',
        }}
      >
        <HolderOutlined />
      </span>
      {!hideEnabled && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: ROW_CONTROL_HEIGHT,
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={isPlaceholder}
            onChange={(e) => onUpdate(adapter.setEnabled(row, e.target.checked))}
            style={{ width: 14, height: 14, cursor: isPlaceholder ? 'not-allowed' : 'pointer' }}
          />
        </span>
      )}
      <div
        data-field-path={rowPath ? rowPath(id, 'key') : undefined}
        style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 4 }}
      >
        {renderKeyCell ? (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            {renderKeyCell(row, onUpdate, { isPlaceholder, dim, expanded: rowFocused })}
          </div>
        ) : (
          <Input
            variant="borderless"
            value={localKey}
            placeholder={keyPlaceholder}
            onChange={(e) => onUpdate(adapter.setKey(row, e.target.value))}
            style={{
              ...cellFont,
              padding: '4px 10px',
              flex: 1,
              minWidth: 0,
              color: dim ? token.colorTextQuaternary : token.colorText,
            }}
          />
        )}
        {keyConflict && conflictBridge && keyPath && (
          <ConflictDiffChip
            theirs={keyConflict.theirs}
            base={keyConflict.base}
            local={localKey}
            remote={keyConflict.remote}
            onTakeTheirs={() => {
              onUpdate(adapter.setKey(row, keyConflict.theirs));
              conflictBridge.onAcceptTheirs(keyPath, keyConflict.theirs);
            }}
            onKeepMine={() => conflictBridge.onDismiss(keyPath)}
          />
        )}
      </div>
      {showValueColumn && (
        <div
          data-field-path={rowPath ? rowPath(id, 'value') : undefined}
          style={{
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            gap: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            {renderValueCell(row, onUpdate, { isPlaceholder, dim, expanded: rowFocused })}
          </div>
          {valueConflict && conflictBridge && valuePath && (
            <ConflictDiffChip
              theirs={valueConflict.theirs}
              base={valueConflict.base}
              local={localValue}
              remote={valueConflict.remote}
              onTakeTheirs={() => {
                // Cells render their own controlled input via
                // `renderValueCell`; this row only knows the value via
                // the row shape. Adapter has no `setValue` slot — but
                // the value cell's `update(next)` callback already
                // accepts a full row replacement, and the value lives
                // at the conventional `value` key on KeyValueRow. Use
                // a structural patch here so the table stays generic.
                onUpdate({ ...(row as object), value: valueConflict.theirs } as Row);
                conflictBridge.onAcceptTheirs(valuePath, valueConflict.theirs);
              }}
              onKeepMine={() => conflictBridge.onDismiss(valuePath)}
            />
          )}
        </div>
      )}
      {showDescriptionColumn && (
        <div
          data-field-path={rowPath ? rowPath(id, 'description') : undefined}
          style={{
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            gap: 4,
          }}
        >
          {renderDescriptionCell ? (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
              {renderDescriptionCell(row, onUpdate, { isPlaceholder, dim, expanded: rowFocused })}
            </div>
          ) : (
            <Input
              variant="borderless"
              value={localDescription}
              placeholder="Description"
              onChange={(e) => onUpdate(adapter.setDescription(row, e.target.value))}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                flex: 1,
                minWidth: 0,
                color: dim ? token.colorTextQuaternary : token.colorText,
              }}
            />
          )}
          {descConflict && conflictBridge && descPath && (
            <ConflictDiffChip
              theirs={descConflict.theirs}
              base={descConflict.base}
              local={localDescription}
              remote={descConflict.remote}
              onTakeTheirs={() => {
                onUpdate(adapter.setDescription(row, descConflict.theirs));
                conflictBridge.onAcceptTheirs(descPath, descConflict.theirs);
              }}
              onKeepMine={() => conflictBridge.onDismiss(descPath)}
            />
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minHeight: ROW_CONTROL_HEIGHT,
          gap: 4,
        }}
      >
        {setRowConflict && conflictBridge && (
          <SetRowConflictChip
            baseSummary={setRowConflict.base}
            remote={setRowConflict.remote}
            onUseSaved={() => {
              onRemove();
              conflictBridge.onAcceptTheirs(`set:${conflictBridge.setPath}.${id}`, '');
            }}
            onKeepMine={() => conflictBridge.onDismiss(`set:${conflictBridge.setPath}.${id}`)}
          />
        )}
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          disabled={isPlaceholder}
          onClick={onRemove}
          className="editable-grid-delete"
          style={{
            color: token.colorTextTertiary,
            visibility: isPlaceholder ? 'hidden' : undefined,
          }}
        />
      </div>
    </div>
  );
}

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
 *
 * Contracts live in `editable-grid-types.ts` (re-exported here for
 * callers); the row component in `SortableEditableRow.tsx`; shared
 * presentation constants in `editable-grid-styles.ts`.
 */

import { EditOutlined, InfoCircleOutlined, MoreOutlined, RiseOutlined } from '@ant-design/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Checkbox, Input, Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { TemplateInput } from '../template-input';
import { cellFont, DEFAULT_COLUMN_WIDTH, headerLabelStyle, RESIZE_MIN_WIDTH } from './editable-grid-styles';
import type { EditableGridTableProps } from './editable-grid-types';
import { SortableEditableRow } from './SortableEditableRow';
import { GRID_COL_RESIZER_CLASS, type ResizableColumn, useGridColumnResize } from './use-grid-column-resize';

export type {
  BulkEditConfig,
  EditableGridTableProps,
  EditableRowAdapter,
  KeyValueRowConflictBridge,
  SuggestionRow,
} from './editable-grid-types';

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
  // Read-only suggestion values expand to full wrapped text on click
  // (e.g. the long User-Agent) — keyed by suggestion key.
  const [expandedSuggestionKeys, setExpandedSuggestionKeys] = useState<ReadonlySet<string>>(new Set());
  const toggleSuggestionExpanded = useCallback((key: string) => {
    setExpandedSuggestionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Draggable column widths + full-height dividers — the whole concern
  // lives in this hook; we just attach its container/header refs, read px
  // overrides into the grid template, and render the dividers it reports.
  const resize = useGridColumnResize({
    showValueColumn,
    showDescriptionColumn,
    hideEnabled,
    minWidth: RESIZE_MIN_WIDTH,
  });

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
      const px = resize.columnPxWidth(col);
      return px != null ? `${px}px` : (columnWidths?.[col] ?? DEFAULT_COLUMN_WIDTH);
    };
    const parts: string[] = ['20px'];
    if (!hideEnabled) parts.push('28px');
    parts.push(trackFor('key'));
    if (showValueColumn) parts.push(trackFor('value'));
    if (showDescriptionColumn) parts.push(trackFor('description'));
    parts.push('32px');
    return parts.join(' ');
  }, [hideEnabled, showValueColumn, showDescriptionColumn, columnWidths, resize.columnPxWidth]);

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

  // ── Select-all (header checkbox) ────────────────────────────────
  // A single hover-revealed checkbox in the enabled-column header
  // toggles `enabled` across every materialized row at once. Binary
  // by design — checked only when all rows are on, empty in every
  // other case (no indeterminate dash); clicking an empty box enables
  // all, clicking a full box disables all. The trailing ghost row is
  // excluded from the count + toggle.
  const toggleableRows = useMemo(() => rows.filter((r) => !adapter.isEmpty(r)), [rows, adapter]);
  const allEnabled = toggleableRows.length > 0 && toggleableRows.every((r) => adapter.getEnabled(r));
  const toggleAll = useCallback(
    (checked: boolean) => {
      onChange(rows.map((r) => (adapter.isEmpty(r) ? r : adapter.setEnabled(r, checked))));
    },
    [adapter, onChange, rows],
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

  // The Bulk/Key-Value toggle sits right-aligned inside the LAST visible
  // column's header cell — discoverable at a glance (the `⋯` menu only
  // keeps the column toggles). It can't live in the trailing 32px track:
  // each row is its own grid, so a content-sized trailing track would
  // misalign the header against the rows.
  const lastVisibleColumn: ResizableColumn = showDescriptionColumn ? 'description' : showValueColumn ? 'value' : 'key';
  const bulkToggleButton = bulkEdit ? (
    <Button
      size="small"
      type="text"
      icon={<EditOutlined />}
      onClick={() => (bulkMode ? exitBulk() : enterBulk())}
      style={{ fontSize: 11, height: 20, padding: '0 6px', color: token.colorTextSecondary, flexShrink: 0 }}
    >
      {bulkMode ? 'Key-Value' : 'Bulk'}
    </Button>
  ) : null;

  // Header label cell. The resize handle isn't here — it's a full-height
  // overlay (rendered below) positioned at this cell's right edge — but
  // we register the cell ref so the overlay can read that edge and a drag
  // can measure the column's start width.
  const renderHeaderLabel = (col: ResizableColumn, label: string, withBorder: boolean) => (
    <span
      ref={resize.registerHeaderRef(col)}
      style={{
        ...headerLabelStyle,
        ...(withBorder ? { borderLeft: `1px solid ${token.colorBorderSecondary}` } : null),
        ...(col === lastVisibleColumn && bulkToggleButton
          ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '3px 4px 3px 10px' }
          : null),
      }}
    >
      {col === lastVisibleColumn && bulkToggleButton ? (
        <>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          {bulkToggleButton}
        </>
      ) : (
        label
      )}
    </span>
  );

  return (
    <div
      ref={resize.containerRef}
      style={{
        position: 'relative',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        overflow: 'visible',
      }}
    >
      {/* Full-height draggable column dividers — grabbable from any row,
        not just the header. The drag rewrites the shared grid template so
        every row reflows together; double-click resets the column to its
        flex default. */}
      {!bulkMode &&
        resize.dividers.map(({ col, x }) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: pointer-drag-only resize affordance
          <span
            key={col}
            className={GRID_COL_RESIZER_CLASS}
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${col} column`}
            style={{ left: x - 4 }}
            onPointerDown={(e) => resize.beginResize(e, col)}
            onDoubleClick={() => resize.resetColumn(col)}
          />
        ))}
      {/* Header row — sticky to the parent scroll container. */}
      <div
        className="editable-grid-header"
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
        {!hideEnabled &&
          (toggleableRows.length > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                className="editable-grid-select-all"
                checked={allEnabled}
                onChange={(e) => toggleAll(e.target.checked)}
                aria-label="Enable or disable all rows"
                title="Enable / disable all"
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
            </span>
          ) : (
            <span />
          ))}
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
          {/* Suggestion rows — generated, toggleable, not draggable.
              Tinted like the header so they read as a distinct band
              from the user's own (white) rows. */}
          {suggestionRows.map((s) => {
            const valueColor = s.enabled ? token.colorTextSecondary : token.colorTextQuaternary;
            const struck = s.overriddenBy
              ? ({ textDecoration: 'line-through', textDecorationThickness: 1 } as const)
              : null;
            const valueExpanded = expandedSuggestionKeys.has(s.key);
            const actionNode = s.action ? (
              <Button
                className="editable-grid-suggestion-action"
                type="link"
                size="small"
                icon={<RiseOutlined />}
                onClick={s.action.onClick}
                style={{ fontSize: 12, height: 20, padding: '0 4px', flexShrink: 0 }}
              >
                {s.action.label}
              </Button>
            ) : null;
            const withOverrideTooltip = (node: React.ReactElement) =>
              s.overriddenBy ? (
                <Tooltip title={`Duplicate — overridden by the ${s.overriddenBy} row you added.`}>{node}</Tooltip>
              ) : (
                node
              );
            return (
              <div
                key={`suggestion:${s.key}`}
                className="editable-grid-suggestion-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridTemplate,
                  alignItems: 'center',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorFillAlter,
                }}
              >
                <span />
                {!hideEnabled && (
                  <span style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      disabled={!s.onToggle}
                      onChange={(e) => s.onToggle?.(e.target.checked)}
                      style={{
                        width: 14,
                        height: 14,
                        cursor: s.onToggle ? 'pointer' : 'default',
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
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      // With no description column the action link takes the
                      // trailing actions track too — suggestion rows have no
                      // delete button, so the link lands at the row's true
                      // right edge.
                      ...(showDescriptionColumn ? null : { gridColumn: 'span 2' }),
                    }}
                  >
                    {s.editableValue ? (
                      <TemplateInput
                        variant="borderless"
                        expandOnFocus
                        maxRows={7}
                        secret={s.editableValue.secret}
                        value={s.value}
                        onChange={s.editableValue.onChange}
                        aria-label={`${s.key} value`}
                        style={{
                          ...cellFont,
                          flex: 1,
                          minWidth: 0,
                          padding: '6px 10px',
                          color: valueColor,
                          ...struck,
                        }}
                      />
                    ) : (
                      withOverrideTooltip(
                        // Read-only, but still inspectable: clicking a
                        // truncated value expands it to the full wrapped
                        // text (click again to collapse).
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSuggestionExpanded(s.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleSuggestionExpanded(s.key);
                            }
                          }}
                          style={{
                            ...cellFont,
                            flex: 1,
                            minWidth: 0,
                            padding: '6px 10px',
                            color: valueColor,
                            overflow: 'hidden',
                            cursor: 'default',
                            ...(valueExpanded
                              ? { whiteSpace: 'normal', wordBreak: 'break-all' }
                              : { textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                            ...struck,
                          }}
                        >
                          {s.value}
                        </span>,
                      )
                    )}
                    {!showDescriptionColumn && actionNode}
                  </span>
                )}
                {showDescriptionColumn && (
                  <span
                    style={{
                      padding: '6px 4px 6px 10px',
                      fontSize: 12,
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      minWidth: 0,
                      // Span the trailing actions track — suggestion rows
                      // have no delete button, so the "Go to …" link lands
                      // at the row's true right edge.
                      gridColumn: 'span 2',
                    }}
                  >
                    {actionNode}
                  </span>
                )}
                {!showValueColumn && !showDescriptionColumn && <span />}
              </div>
            );
          })}

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

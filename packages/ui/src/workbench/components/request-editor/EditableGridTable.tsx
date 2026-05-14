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

import { DeleteOutlined, HolderOutlined, InfoCircleOutlined, MoreOutlined } from '@ant-design/icons';
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
import { useCallback, useMemo, useState } from 'react';
import { ConflictDiffChip, SetRowConflictChip } from '@openheaders/ui/shared/awareness';
import type { PathConflict } from '@openheaders/ui/shared/conflicts/types';

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
    context: { isPlaceholder: boolean; dim: boolean },
  ) => React.ReactNode;
  keyPlaceholder?: string;
  hideEnabled?: boolean;
  suggestionRows?: SuggestionRow[];
  /** Enable the "Bulk Edit" toggle in the header. When the user
   *  clicks it, the table swaps for a textarea with the serialized
   *  rows; clicking again parses the textarea back into rows. */
  bulkEdit?: BulkEditConfig<Row>;
  /** Per-column width overrides — default is `minmax(180px, 1fr)`
   *  for each of Key / Value / Description. */
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

const DEFAULT_COLUMN_WIDTH = 'minmax(180px, 1fr)';

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

// Hover-reveal for the drag handle + delete button. Same transition
// on both so the row controls appear together and disappear together.
// Injected once at module load so every usage shares the same CSS rule.
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
  `;
  document.head.appendChild(style);
}

export function EditableGridTable<Row>({
  rows,
  onChange,
  adapter,
  renderValueCell,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Compute grid template from current visibility + custom widths.
  const gridTemplate = useMemo(() => {
    const parts: string[] = ['20px'];
    if (!hideEnabled) parts.push('28px');
    parts.push(columnWidths?.key ?? DEFAULT_COLUMN_WIDTH);
    if (showValueColumn) parts.push(columnWidths?.value ?? DEFAULT_COLUMN_WIDTH);
    if (showDescriptionColumn) parts.push(columnWidths?.description ?? DEFAULT_COLUMN_WIDTH);
    parts.push('32px');
    return parts.join(' ');
  }, [hideEnabled, showValueColumn, showDescriptionColumn, columnWidths]);

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

  const columnsPopoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 500, marginBottom: 4 }}>
        Show columns
      </div>
      <Checkbox checked={showValueColumn} onChange={(e) => setShowValueColumn(e.target.checked)}>
        Value
      </Checkbox>
      <Checkbox checked={showDescriptionColumn} onChange={(e) => setShowDescriptionColumn(e.target.checked)}>
        Description
      </Checkbox>
    </div>
  );

  const trailingActionsCell = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        padding: '4px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {bulkEdit && (
        <button
          type="button"
          onClick={bulkMode ? exitBulk : enterBulk}
          style={{
            color: token.colorPrimary,
            fontWeight: 500,
            background: 'transparent',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {bulkMode ? 'Key-Value Edit' : 'Bulk Edit'}
        </button>
      )}
      <Popover content={columnsPopoverContent} trigger="click" placement="bottomRight">
        <Button
          size="small"
          type="text"
          icon={<MoreOutlined />}
          aria-label="Show columns menu"
          style={{ color: token.colorTextTertiary }}
        />
      </Popover>
    </div>
  );

  return (
    <div
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
          background: token.colorFillAlter,
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
        <span style={{ padding: '6px 10px' }}>Key</span>
        {showValueColumn && (
          <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Value</span>
        )}
        {showDescriptionColumn && (
          <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>
            Description
          </span>
        )}
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

  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplate,
    alignItems: 'center',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? token.colorFillTertiary : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="editable-grid-row">
      <span
        {...(isPlaceholder ? {} : attributes)}
        {...(isPlaceholder ? {} : listeners)}
        className="editable-grid-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isPlaceholder ? 'default' : 'grab',
          color: token.colorTextTertiary,
          fontSize: 12,
          visibility: isPlaceholder ? 'hidden' : 'visible',
        }}
      >
        <HolderOutlined />
      </span>
      {!hideEnabled && (
        <span style={{ textAlign: 'center' }}>
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
            {renderValueCell(row, onUpdate, { isPlaceholder, dim })}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
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

/**
 * SortableEditableRow — one user row of `EditableGridTable`: drag
 * handle + enable checkbox + Key / Value / Description cells + delete,
 * with per-cell inline conflict chips. Sortable via @dnd-kit (the
 * trailing ghost row is drag-disabled).
 */

import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { ConflictDiffChip, SetRowConflictChip } from '@openheaders/ui/shared/awareness';
import type { GripResizeXHandler } from '../template-input';
import { cellFont, ROW_CONTROL_HEIGHT } from './editable-grid-styles';
import type {
  EditableGridTableProps,
  EditableRowAdapter,
  KeyValueRowConflictBridge,
} from './editable-grid-types';

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
  /** Value-column boundary handler forwarded into the Value cell's
   *  render context (see `EditableGridTableProps.renderValueCell`). */
  valueGripResizeX?: GripResizeXHandler;
  /** True for materialized rows (not the trailing ghost). Conflict
   *  chips suppress on placeholder rows since they have no persisted
   *  identity in the canonical baseline. */
  isPersisted: boolean;
  onUpdate: (next: Row) => void;
  onRemove: () => void;
}

export function SortableEditableRow<Row>({
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
  valueGripResizeX,
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
      onFocusCapture={(e) => {
        // Only a text-editing surface expands the row — buttons inside
        // it (delete, "Go to …" jump links, conflict chips) and the
        // enable checkbox are focusable too, and a click on them must
        // not balloon every cell open.
        const t = e.target as HTMLElement;
        const isTextEditor =
          t.isContentEditable ||
          t instanceof HTMLTextAreaElement ||
          (t instanceof HTMLInputElement && t.type === 'text');
        if (isTextEditor) setRowFocused(true);
      }}
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
            {renderValueCell(row, onUpdate, {
              isPlaceholder,
              dim,
              expanded: rowFocused,
              onValueResizeX: valueGripResizeX,
            })}
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

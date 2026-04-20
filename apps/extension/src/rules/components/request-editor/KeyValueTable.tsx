/**
 * KeyValueTable — three-column (Key / Value / Description) editable
 * grid used by the Params tab and the Headers tab. A persistent empty
 * row at the bottom lets users add without an explicit "add" button;
 * the row materializes as soon as the user types into any cell and a
 * fresh placeholder appears below.
 *
 * Each user-editable row has:
 *   • A hover-revealed drag handle (leftmost).
 *   • An enable checkbox.
 *   • Three text inputs (Key, Value, Description).
 *   • A trailing delete button.
 *
 * `suggestionRows` renders above the user-editable rows. Suggestions
 * are read-only informational entries (e.g. browser-managed
 * auto-generated headers) with a toggleable checkbox + info-icon
 * right-aligned on the Key cell with a tooltip explaining the row.
 * Suggestion rows intentionally DO NOT carry a drag handle — their
 * order is fixed, and they sit above the user rows so ordering is
 * always "browser-side first, user-side second".
 *
 * Drag-and-drop uses @dnd-kit/sortable — the same library the
 * MultipartEditor + rule-flow editor use — so the interaction +
 * visual feel match the rest of the extension.
 */

import { DeleteOutlined, HolderOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
import { Button, Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

export interface KeyValueRow {
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface SuggestionRow {
  key: string;
  value: string;
  /** Tooltip body shown under the info icon on the Key cell. */
  hint?: string;
  /** Current enable state — toggled by the row's checkbox. */
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  suggestionRows?: SuggestionRow[];
  /** When true, hides the leading checkbox column. */
  hideEnabled?: boolean;
}

let ROW_ID_COUNTER = 0;
const nextUid = (): string => `kv-${++ROW_ID_COUNTER}`;

export const makeKvRow = (overrides: Partial<KeyValueRow> = {}): KeyValueRow => ({
  uid: nextUid(),
  key: '',
  value: '',
  description: '',
  enabled: true,
  ...overrides,
});

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

// Hover-reveal for the drag handle + subtle dragging state. Injected
// once at module load so the component stays style-prop-only for the
// rest of its surface.
const STYLE_ID = 'rules-kv-row-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.kv-row .kv-row-drag-handle { opacity: 0; transition: opacity 120ms ease; }
.kv-row:hover .kv-row-drag-handle { opacity: 1; }
.kv-row .kv-row-drag-handle:active { cursor: grabbing; }
  `;
  document.head.appendChild(style);
}

const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  suggestionRows = [],
  hideEnabled = false,
}) => {
  const { token } = theme.useToken();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const effectiveRows = useMemo(() => {
    const last = rows[rows.length - 1];
    if (!last || last.key || last.value || last.description) {
      return [...rows, makeKvRow()];
    }
    return rows;
  }, [rows]);

  const update = (uid: string, patch: Partial<KeyValueRow>) => {
    const next = effectiveRows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
    const tail = next[next.length - 1];
    const tidy = tail && !tail.key && !tail.value && !tail.description ? next.slice(0, -1) : next;
    onChange(tidy);
  };

  const remove = (uid: string) => {
    const next = effectiveRows.filter((r) => r.uid !== uid);
    const tail = next[next.length - 1];
    const tidy = tail && !tail.key && !tail.value && !tail.description ? next.slice(0, -1) : next;
    onChange(tidy);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = effectiveRows.map((r) => r.uid);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(effectiveRows, oldIndex, newIndex);
    const tail = reordered[reordered.length - 1];
    const tidy = tail && !tail.key && !tail.value && !tail.description ? reordered.slice(0, -1) : reordered;
    onChange(tidy);
  };

  // Grid columns:
  //   [drag handle 20px] [checkbox 28px?] [key 1fr] [value 1fr] [desc 1fr] [delete 32px]
  // The drag column gets 20px; suggestion + header rows render it as
  // a blank spacer so the user-row columns line up under them.
  const gridTemplate = hideEnabled
    ? '20px minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) 32px'
    : '20px 28px minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) 32px';

  const rowIds = effectiveRows.map((r) => r.uid);

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
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Value</span>
        <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Description</span>
        <span />
      </div>

      {/* Suggestion rows (read-only, toggleable). No drag handle. */}
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
          <span
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
            }}
          />
          <span />
        </div>
      ))}

      {/* User-editable rows — sortable. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {effectiveRows.map((r, i) => {
            const isPlaceholder = i === effectiveRows.length - 1 && !r.key && !r.value && !r.description;
            return (
              <SortableKvRow
                key={r.uid}
                row={r}
                gridTemplate={gridTemplate}
                hideEnabled={hideEnabled}
                isPlaceholder={isPlaceholder}
                keyPlaceholder={keyPlaceholder}
                valuePlaceholder={valuePlaceholder}
                onUpdate={(patch) => update(r.uid, patch)}
                onRemove={() => remove(r.uid)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
};

// ── Sortable row ─────────────────────────────────────────────────

interface SortableKvRowProps {
  row: KeyValueRow;
  gridTemplate: string;
  hideEnabled: boolean;
  isPlaceholder: boolean;
  keyPlaceholder: string;
  valuePlaceholder: string;
  onUpdate: (patch: Partial<KeyValueRow>) => void;
  onRemove: () => void;
}

const SortableKvRow: React.FC<SortableKvRowProps> = ({
  row,
  gridTemplate,
  hideEnabled,
  isPlaceholder,
  keyPlaceholder,
  valuePlaceholder,
  onUpdate,
  onRemove,
}) => {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
    disabled: isPlaceholder,
  });

  const dim = !row.enabled || isPlaceholder;

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
    <div ref={setNodeRef} style={style} className="kv-row">
      <span
        {...(isPlaceholder ? {} : attributes)}
        {...(isPlaceholder ? {} : listeners)}
        className="kv-row-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isPlaceholder ? 'default' : 'grab',
          color: token.colorTextTertiary,
          fontSize: 12,
          // The stylesheet injected at module load reveals this on row
          // hover; we keep the element mounted so @dnd-kit's sensors
          // stay attached even when visually hidden.
          visibility: isPlaceholder ? 'hidden' : 'visible',
        }}
      >
        <HolderOutlined />
      </span>
      {!hideEnabled && (
        <span style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={row.enabled}
            disabled={isPlaceholder}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            style={{ width: 14, height: 14, cursor: isPlaceholder ? 'not-allowed' : 'pointer' }}
          />
        </span>
      )}
      <Input
        variant="borderless"
        value={row.key}
        placeholder={keyPlaceholder}
        onChange={(e) => onUpdate({ key: e.target.value })}
        style={{ ...cellFont, padding: '4px 10px', color: dim ? token.colorTextQuaternary : token.colorText }}
      />
      <Input
        variant="borderless"
        value={row.value}
        placeholder={valuePlaceholder}
        onChange={(e) => onUpdate({ value: e.target.value })}
        style={{
          ...cellFont,
          padding: '4px 10px',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          color: dim ? token.colorTextQuaternary : token.colorText,
        }}
      />
      <Input
        variant="borderless"
        value={row.description ?? ''}
        placeholder="Description"
        onChange={(e) => onUpdate({ description: e.target.value })}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          color: dim ? token.colorTextQuaternary : token.colorText,
        }}
      />
      <Button
        type="text"
        size="small"
        icon={<DeleteOutlined />}
        disabled={isPlaceholder}
        onClick={onRemove}
        style={{ color: token.colorTextTertiary }}
      />
    </div>
  );
};

export default KeyValueTable;

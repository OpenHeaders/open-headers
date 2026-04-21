/**
 * VariableTable — shared spreadsheet-style editor used by the
 * environment, workspace-vars, and collection-vars tab surfaces.
 *
 * Mirrors the desktop EnvironmentEditor's UX: inline borderless
 * inputs, trailing placeholder row that materializes on type, hover
 * reveals drag handle / secret toggle / reveal / delete. Secret
 * values mask with `••••••••` until the user clicks the eye.
 *
 * State is fully owned by the parent (controlled component). Parents
 * compute dirty/save based on the `variables` prop. Keeping the local
 * editing state INSIDE is fine because `variables` is the canonical
 * snapshot — `useEffect` re-syncs the rows when the prop identity
 * changes, so an external save doesn't drop keystrokes.
 */

import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  SecurityScanOutlined,
  SecurityScanTwoTone,
} from '@ant-design/icons';
import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { V5 } from '@openheaders/core/types';
import { Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────

interface LocalRow {
  uid: string;
  name: string;
  value: string;
  isSensitive: boolean;
  isPlaceholder: boolean;
}

interface VariableTableProps {
  variables: V5.Variable[];
  /** Disallow marking rows as secret (used for the collection-vars
   *  editor — collection vars are synced via Git and never encrypted). */
  allowSecrets?: boolean;
  onChange: (next: V5.Variable[]) => void;
}

let nextUid = 1;
function genUid(): string {
  return `vt-${nextUid++}`;
}

// Pin the drag to vertical only; our row layout is a spreadsheet and
// horizontal drift adds noise without any meaningful UX gain. Inlined
// because `@dnd-kit/modifiers` isn't in the extension's dependency
// set and this one-liner is the only modifier we use.
const restrictVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function toLocal(variables: V5.Variable[]): LocalRow[] {
  const rows: LocalRow[] = variables.map((v) => ({
    uid: genUid(),
    name: v.name,
    value: v.value,
    isSensitive: v.type === 'secret',
    isPlaceholder: false,
  }));
  rows.push({ uid: genUid(), name: '', value: '', isSensitive: false, isPlaceholder: true });
  return rows;
}

function fromLocal(rows: LocalRow[]): V5.Variable[] {
  const result: V5.Variable[] = [];
  for (const row of rows) {
    if (row.isPlaceholder || !row.name.trim()) continue;
    result.push({
      name: row.name.trim(),
      value: row.value,
      type: row.isSensitive ? 'secret' : 'default',
    });
  }
  return result;
}

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}

// ── Grid template ──────────────────────────────────────────────────

const GRID_COLS = '28px 1fr 1fr 28px';

// ── Value cell with expand-on-focus ───────────────────────────────

interface ValueCellProps {
  value: string;
  masked: boolean;
  onChange: (next: string) => void;
  onReveal?: () => void;
}

function ValueCell({ value, masked, onChange, onReveal }: ValueCellProps) {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    onReveal?.();
    setEditing(true);
  };

  if (editing) {
    return (
      <Input.TextArea
        value={value}
        autoFocus
        variant="borderless"
        autoSize={{ minRows: 1, maxRows: 4 }}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 12,
          padding: '4px 6px',
          resize: 'none',
          width: '100%',
        }}
      />
    );
  }

  const displayValue = masked && value ? '••••••••' : value;

  return (
    <div
      onClick={startEditing}
      role="textbox"
      tabIndex={0}
      onFocus={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing();
      }}
      style={{
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 12,
        color: displayValue ? token.colorText : token.colorTextQuaternary,
        width: '100%',
        padding: '4px 6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'text',
        lineHeight: '22px',
        minHeight: 22,
      }}
    >
      {displayValue || 'Value'}
    </div>
  );
}

// ── Sortable row ───────────────────────────────────────────────────

interface SortableRowProps {
  row: LocalRow;
  index: number;
  isLast: boolean;
  isRevealed: boolean;
  allowSecrets: boolean;
  update: (i: number, patch: Partial<LocalRow>) => void;
  remove: (i: number) => void;
  toggleReveal: (uid: string) => void;
}

function SortableRow({ row, index, isLast, isRevealed, allowSecrets, update, remove, toggleReveal }: SortableRowProps) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
    disabled: row.isPlaceholder,
  });

  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: GRID_COLS,
    borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative' as const, zIndex: 50, opacity: 0.85 } : {}),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!row.isPlaceholder && (
          <span ref={setActivatorNodeRef} {...listeners} style={{ cursor: 'grab', display: 'flex' }}>
            <HolderOutlined style={{ fontSize: 12, color: token.colorTextQuaternary }} />
          </span>
        )}
      </div>

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <input
          value={row.name}
          placeholder={row.isPlaceholder ? 'Add variable…' : 'Name'}
          onChange={(e) => update(index, { name: e.target.value, isPlaceholder: false })}
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            fontWeight: row.isPlaceholder ? 400 : 500,
            color: row.isPlaceholder ? token.colorTextQuaternary : token.colorText,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            flex: 1,
            minWidth: 0,
            padding: '6px',
          }}
        />
        {allowSecrets && !row.isPlaceholder && (
          <Tooltip title={row.isSensitive ? 'Unmark as sensitive' : 'Mark as sensitive'}>
            {row.isSensitive ? (
              <SecurityScanTwoTone
                twoToneColor={token.colorPrimary}
                style={{ fontSize: 14, cursor: 'pointer' }}
                onClick={() => update(index, { isSensitive: false })}
              />
            ) : (
              <SecurityScanOutlined
                style={{ fontSize: 14, cursor: 'pointer', color: token.colorTextQuaternary }}
                onClick={() => update(index, { isSensitive: true })}
              />
            )}
          </Tooltip>
        )}
      </div>

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 4,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <ValueCell
          value={row.value}
          masked={row.isSensitive && !isRevealed && !row.isPlaceholder}
          onChange={(v) => update(index, { value: v, isPlaceholder: false })}
          onReveal={() => {
            if (row.isSensitive && !isRevealed) toggleReveal(row.uid);
          }}
        />
        {row.isSensitive && !row.isPlaceholder && (
          <Tooltip title={isRevealed ? 'Hide value' : 'Show value'}>
            <span
              role="button"
              tabIndex={0}
              onClick={() => toggleReveal(row.uid)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toggleReveal(row.uid);
              }}
              style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary, padding: '0 4px' }}
            >
              {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </span>
          </Tooltip>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!row.isPlaceholder && (
          <DeleteOutlined
            style={{ fontSize: 12, color: token.colorErrorText, cursor: 'pointer' }}
            onClick={() => remove(index)}
          />
        )}
      </div>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────

const VariableTable: React.FC<VariableTableProps> = ({ variables, allowSecrets = true, onChange }) => {
  const { token } = theme.useToken();
  const [rows, setRows] = useState<LocalRow[]>(() => toLocal(variables));
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const lastExternalFp = useRef<string>(fingerprint(variables));

  // Re-sync when the controlling prop changes from outside (workspace
  // switch, external save). Comparing fingerprints avoids clobbering
  // in-flight edits on re-renders where the prop object identity
  // changes but the data is equivalent.
  useEffect(() => {
    const nextFp = fingerprint(variables);
    if (nextFp !== lastExternalFp.current) {
      lastExternalFp.current = nextFp;
      setRows(toLocal(variables));
      setRevealed(new Set());
    }
  }, [variables]);

  // Push row changes back to the parent as a typed V5.Variable[].
  const pushUp = useCallback(
    (nextRows: LocalRow[]) => {
      const next = fromLocal(nextRows);
      const nextFp = fingerprint(next);
      // Mark as "came from us" so the external-prop sync doesn't rebuild
      // local state on the same turn.
      lastExternalFp.current = nextFp;
      onChange(next);
    },
    [onChange],
  );

  const update = useCallback(
    (index: number, patch: Partial<LocalRow>) => {
      setRows((prev) => {
        const row = { ...prev[index], ...patch };
        const next = [...prev];
        next[index] = row;
        // Materialize placeholder → real row + append a fresh placeholder.
        if (prev[index].isPlaceholder && (row.name || row.value)) {
          row.isPlaceholder = false;
          next[index] = row;
          next.push({ uid: genUid(), name: '', value: '', isSensitive: false, isPlaceholder: true });
        }
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  const remove = useCallback(
    (index: number) => {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (!next.some((r) => r.isPlaceholder)) {
          next.push({ uid: genUid(), name: '', value: '', isSensitive: false, isPlaceholder: true });
        }
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  const toggleReveal = useCallback((uid: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      setRows((prev) => {
        const oldIndex = prev.findIndex((r) => r.uid === active.id);
        const newIndex = prev.findIndex((r) => r.uid === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <div style={{ padding: '6px 8px' }} />
        <div
          style={{
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorTextSecondary,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          Variable
        </div>
        <div
          style={{
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorTextSecondary,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          Value
        </div>
        <div style={{ padding: '6px 8px' }} />
      </div>

      <DndContext modifiers={[restrictVertical]} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
          {rows.map((row, index) => (
            <SortableRow
              key={row.uid}
              row={row}
              index={index}
              isLast={index === rows.length - 1}
              isRevealed={revealed.has(row.uid)}
              allowSecrets={allowSecrets}
              update={update}
              remove={remove}
              toggleReveal={toggleReveal}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default VariableTable;

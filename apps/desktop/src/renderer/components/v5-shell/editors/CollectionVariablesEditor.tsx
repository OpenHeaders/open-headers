/**
 * CollectionVariablesEditor — editor for collection-scoped variables.
 *
 * Same Postman-style spreadsheet as WorkspaceVariablesEditor / EnvironmentEditor,
 * but scoped to a single collection. Variables stored on Collection.variables.
 */

import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOutlined,
  HolderOutlined,
  SecurityScanOutlined,
  SecurityScanTwoTone,
} from '@ant-design/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EnvironmentVariable } from '@openheaders/core';
import { Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCollections } from '@/renderer/hooks/useCentralizedWorkspace';

const { Text, Title } = Typography;

interface CollectionVariablesEditorProps {
  collectionId: string;
  onDirtyChange?: (dirty: boolean) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
}

interface LocalVariable {
  uid: string;
  name: string;
  value: string;
  isSensitive: boolean;
  description: string;
  isPlaceholder: boolean;
}

let nextUid = 1;
function genUid(): string {
  return `cv-${nextUid++}`;
}

function envVarsToLocal(variables: Record<string, EnvironmentVariable>): LocalVariable[] {
  const rows: LocalVariable[] = Object.entries(variables).map(([name, v]) => ({
    uid: genUid(),
    name,
    value: v.value,
    isSensitive: v.isSensitive,
    description: v.description ?? '',
    isPlaceholder: false,
  }));
  rows.push({ uid: genUid(), name: '', value: '', isSensitive: false, description: '', isPlaceholder: true });
  return rows;
}

function localToEnvVars(rows: LocalVariable[]): Record<string, EnvironmentVariable> {
  const result: Record<string, EnvironmentVariable> = {};
  for (const row of rows) {
    if (row.isPlaceholder || !row.name.trim()) continue;
    result[row.name.trim()] = {
      value: row.value,
      isSensitive: row.isSensitive,
      ...(row.description ? { description: row.description } : {}),
      updatedAt: new Date().toISOString(),
    };
  }
  return result;
}

function fp(rows: LocalVariable[]): string {
  return JSON.stringify(
    rows
      .filter((r) => !r.isPlaceholder && r.name.trim())
      .map((r) => ({ n: r.name, v: r.value, s: r.isSensitive, d: r.description })),
  );
}

const GRID_COLS = '32px 1fr 1fr 1fr 32px';

// ── Value cell ─────────────────────────────────────────────────

function ValueCell({
  value,
  placeholder,
  masked,
  color,
  onChange,
  onEdit,
}: {
  value: string;
  placeholder?: string;
  masked?: boolean;
  color: string;
  onChange: (v: string) => void;
  onEdit?: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    onEdit?.();
    setEditing(true);
  };

  if (editing) {
    return (
      <div style={{ overflow: 'hidden', width: '100%' }}>
        <Input.TextArea
          value={value}
          placeholder={placeholder}
          variant="borderless"
          autoSize={{ minRows: 1, maxRows: 4 }}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            color,
            padding: '4px 6px',
            resize: 'none',
            width: '100%',
          }}
        />
      </div>
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
        color: displayValue ? color : 'var(--ant-color-text-quaternary)',
        width: '100%',
        padding: '4px 6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'text',
        lineHeight: '22px',
      }}
    >
      {displayValue || placeholder || ''}
    </div>
  );
}

// ── Sortable row ───────────────────────────────────────────────

interface SortableRowProps {
  row: LocalVariable;
  index: number;
  isLast: boolean;
  isRevealed: boolean;
  token: Record<string, string>;
  updateRow: (index: number, field: keyof LocalVariable, value: string | boolean) => void;
  deleteRow: (index: number) => void;
  toggleSecretReveal: (uid: string) => void;
  toggleSecret: (index: number) => void;
}

function SortableRow({
  row,
  index,
  isLast,
  isRevealed,
  token,
  updateRow,
  deleteRow,
  toggleSecretReveal,
  toggleSecret,
}: SortableRowProps) {
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
    <div ref={setNodeRef} className="v5-env-row" style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!row.isPlaceholder && (
          <span ref={setActivatorNodeRef} {...listeners} style={{ display: 'flex', cursor: 'grab' }}>
            <HolderOutlined
              className="v5-env-hover-action"
              style={{ fontSize: 12, color: token.colorTextQuaternary }}
            />
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
          placeholder={row.isPlaceholder ? 'Add variable...' : 'Name'}
          onChange={(e) => updateRow(index, 'name', e.target.value)}
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
        {!row.isPlaceholder &&
          (row.isSensitive ? (
            <Tooltip title="Unmark as sensitive">
              <SecurityScanTwoTone
                twoToneColor={token.colorPrimary}
                style={{ fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                onClick={() => toggleSecret(index)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Mark as sensitive">
              <SecurityScanOutlined
                className="v5-env-hover-action"
                style={{ fontSize: 14, cursor: 'pointer', color: token.colorTextQuaternary, flexShrink: 0 }}
                onClick={() => toggleSecret(index)}
              />
            </Tooltip>
          ))}
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
          placeholder="Value"
          masked={row.isSensitive && !isRevealed && !row.isPlaceholder}
          color={row.isPlaceholder ? token.colorTextQuaternary : token.colorText}
          onChange={(v) => updateRow(index, 'value', v)}
          onEdit={() => {
            if (row.isSensitive && !isRevealed) toggleSecretReveal(row.uid);
          }}
        />
        {row.isSensitive && !row.isPlaceholder && (
          <Tooltip title={isRevealed ? 'Hide value' : 'Show value'}>
            <span
              style={{
                cursor: 'pointer',
                color: token.colorTextTertiary,
                fontSize: 12,
                flexShrink: 0,
                padding: '0 4px',
              }}
              onClick={() => toggleSecretReveal(row.uid)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') toggleSecretReveal(row.uid);
              }}
            >
              {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </span>
          </Tooltip>
        )}
      </div>

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <input
          value={row.description}
          placeholder=""
          onChange={(e) => updateRow(index, 'description', e.target.value)}
          style={{
            fontSize: 12,
            color: row.isPlaceholder ? token.colorTextQuaternary : token.colorTextSecondary,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            padding: '6px',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!row.isPlaceholder && (
          <DeleteOutlined
            className="v5-env-hover-action"
            style={{ fontSize: 12, color: token.colorErrorText, cursor: 'pointer' }}
            onClick={() => deleteRow(index)}
          />
        )}
      </div>
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────

export function CollectionVariablesEditor({ collectionId, onDirtyChange, saveRef }: CollectionVariablesEditorProps) {
  const { token } = theme.useToken();
  const { collections, updateCollection } = useCollections();
  const collection = collections.find((c) => c.id === collectionId);

  const [rows, setRows] = useState<LocalVariable[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const snapshotRef = useRef('');
  const initializedRef = useRef<string | null>(null);

  // Initialize local state when collection changes
  useEffect(() => {
    if (collection && initializedRef.current !== collection.id) {
      initializedRef.current = collection.id;
      const local = envVarsToLocal(collection.variables ?? {});
      setRows(local);
      snapshotRef.current = fp(local);
    }
  }, [collection]);

  const isDirty = snapshotRef.current !== '' && fp(rows) !== snapshotRef.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    const variables = localToEnvVars(rows);
    void updateCollection(collectionId, { variables }).then((ok) => {
      if (ok) {
        snapshotRef.current = fp(rows);
        onDirtyChange?.(false);
      }
    });
  }, [rows, collectionId, updateCollection, onDirtyChange]);

  useEffect(() => {
    if (saveRef) saveRef.current = handleSave;
  }, [saveRef, handleSave]);

  const updateRow = useCallback((index: number, field: keyof LocalVariable, value: string | boolean) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };

      if (row.isPlaceholder && (field === 'name' || field === 'value' || field === 'description') && value) {
        row.isPlaceholder = false;
        next[index] = row;
        next.push({ uid: genUid(), name: '', value: '', isSensitive: false, description: '', isPlaceholder: true });
      } else {
        next[index] = row;
      }

      return next;
    });
  }, []);

  const deleteRow = useCallback((index: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((r) => r.isPlaceholder)) {
        next.push({ uid: genUid(), name: '', value: '', isSensitive: false, description: '', isPlaceholder: true });
      }
      return next;
    });
  }, []);

  const toggleSecret = useCallback(
    (index: number) => {
      const becomingSecret = !rows[index].isSensitive;
      updateRow(index, 'isSensitive', becomingSecret);
      if (becomingSecret) {
        setRevealedSecrets((prev) => {
          const next = new Set(prev);
          next.delete(rows[index].uid);
          return next;
        });
      }
    },
    [rows, updateRow],
  );

  const toggleSecretReveal = useCallback((rowUid: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(rowUid)) next.delete(rowUid);
      else next.add(rowUid);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.uid === active.id);
      const newIndex = prev.findIndex((r) => r.uid === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const tokenStrings = {
    colorBorderSecondary: token.colorBorderSecondary,
    colorTextQuaternary: token.colorTextQuaternary,
    colorText: token.colorText,
    colorTextTertiary: token.colorTextTertiary,
    colorTextSecondary: token.colorTextSecondary,
    colorPrimary: token.colorPrimary,
    colorErrorText: token.colorErrorText,
  };

  if (!collection) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Collection not found.</Text>
      </div>
    );
  }

  const sortableIds = rows.map((r) => r.uid);
  const userVarCount = rows.filter((r) => !r.isPlaceholder && r.name.trim()).length;

  return (
    <div className="v5-editor-content" style={{ background: token.colorBgContainer, overflow: 'auto' }}>
      <div className="v5-rule-editor">
        {/* Header */}
        <div className="v5-rule-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              {collection.name} — Variables
            </Title>
          </div>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            Variables scoped to this collection. Available to all requests and rules inside it.
          </Text>
        </div>

        {/* Variables table */}
        <div className="v5-rule-editor-body">
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              COLLECTION VARIABLES ({userVarCount})
            </Text>

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
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: token.colorTextSecondary,
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  Description
                </div>
                <div style={{ padding: '6px 8px' }} />
              </div>

              <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {rows.map((row, index) => (
                    <SortableRow
                      key={row.uid}
                      row={row}
                      index={index}
                      isLast={index === rows.length - 1}
                      isRevealed={revealedSecrets.has(row.uid)}
                      token={tokenStrings}
                      updateRow={updateRow}
                      deleteRow={deleteRow}
                      toggleSecretReveal={toggleSecretReveal}
                      toggleSecret={toggleSecret}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

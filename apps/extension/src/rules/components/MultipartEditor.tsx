/**
 * MultipartEditor — structured editor for `body.multipartParts`.
 *
 * Lets users compose a `multipart/form-data` body part-by-part:
 *   • Text parts — `name` + `value`. Values run through template
 *     resolution at send time (Phase 12.4b).
 *   • File parts — pick from the workspace's file blobs, optionally
 *     override the filename sent over the wire. An inline "Upload"
 *     button routes through the same bridge RPC as Settings → Data.
 *
 * Reorder is drag-based via @dnd-kit (same library the rule-flow and
 * sidebar use — one DragAndDrop story per surface). A placeholder
 * FileRef emitted by an importer surfaces as an "Upload required"
 * badge; clicking it opens the file picker so the user fills the gap
 * without leaving the editor.
 */

import {
  DeleteOutlined,
  FileOutlined,
  HolderOutlined,
  PaperClipOutlined,
  PlusOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
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
import { useFiles } from '@hooks/useFiles';
import type { FileRef } from '@openheaders/core/files';
import { isPlaceholderFileRef } from '@openheaders/core/files';
import type { V5 } from '@openheaders/core/types';
import { Button, Input, Select, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';

const { Text } = Typography;

interface MultipartEditorProps {
  parts: V5.MultipartPart[];
  onChange: (parts: V5.MultipartPart[]) => void;
}

// Each part row needs a stable key across renders so React can track
// drag-reorder moves without losing input focus. Parts don't carry a
// uid field (persisted shape doesn't need one — ordering is positional),
// so the editor assigns a transient id on mount and preserves it while
// the draft lives.
interface Row {
  id: string;
  part: V5.MultipartPart;
}

let rowIdCounter = 0;
const nextRowId = (): string => `mp-${++rowIdCounter}`;

const MultipartEditor: React.FC<MultipartEditorProps> = ({ parts, onChange }) => {
  const { token } = theme.useToken();
  const { files, isReady: filesReady, uploadFile } = useFiles();

  // Hydrate transient ids once per incoming parts change. The rowMap
  // ref preserves ids across re-renders so stable keying survives
  // in-place edits without re-mounting inputs.
  const rowMapRef = useRef<WeakMap<V5.MultipartPart, string>>(new WeakMap());
  const rows = useMemo<Row[]>(() => {
    return parts.map((part) => {
      let id = rowMapRef.current.get(part);
      if (!id) {
        id = nextRowId();
        rowMapRef.current.set(part, id);
      }
      return { id, part };
    });
  }, [parts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = useCallback(
    (next: Row[]) => {
      rowMapRef.current = new WeakMap();
      for (const r of next) rowMapRef.current.set(r.part, r.id);
      onChange(next.map((r) => r.part));
    },
    [onChange],
  );

  const updatePart = useCallback(
    (id: string, mutate: (part: V5.MultipartPart) => V5.MultipartPart) => {
      commit(rows.map((r) => (r.id === id ? { id, part: mutate(r.part) } : r)));
    },
    [commit, rows],
  );

  const addTextPart = useCallback(() => {
    commit([...rows, { id: nextRowId(), part: { kind: 'text', name: '', value: '' } }]);
  }, [commit, rows]);

  const addFilePart = useCallback(
    (fileRef: FileRef) => {
      commit([
        ...rows,
        {
          id: nextRowId(),
          part: { kind: 'file', name: '', fileRef },
        },
      ]);
    },
    [commit, rows],
  );

  const removePart = useCallback(
    (id: string) => {
      commit(rows.filter((r) => r.id !== id));
    },
    [commit, rows],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const newIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      commit(arrayMove(rows, oldIndex, newIndex));
    },
    [commit, rows],
  );

  const handleUploadAndReplace = useCallback(
    async (id: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      await new Promise<void>((resolve) => {
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve();
            return;
          }
          const ref = await uploadFile(file, file.name, file.type || undefined);
          if (ref) {
            updatePart(id, (part) => {
              if (part.kind !== 'file') return part;
              return { ...part, fileRef: ref };
            });
          }
          resolve();
        };
        input.click();
      });
    },
    [uploadFile, updatePart],
  );

  const handleUploadAsNewPart = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    await new Promise<void>((resolve) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve();
          return;
        }
        const ref = await uploadFile(file, file.name, file.type || undefined);
        if (ref) addFilePart(ref);
        resolve();
      };
      input.click();
    });
  }, [uploadFile, addFilePart]);

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <MultipartRow
              key={row.id}
              row={row}
              files={files}
              filesReady={filesReady}
              onUpdate={(mutate) => updatePart(row.id, mutate)}
              onRemove={() => removePart(row.id)}
              onUploadReplace={() => void handleUploadAndReplace(row.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {rows.length === 0 && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, marginBottom: 8 }}>
          No parts yet. Add a text field or attach a file to build a multipart form body.
        </Text>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={addTextPart}>
          Add text part
        </Button>
        <Button size="small" icon={<UploadOutlined />} onClick={() => void handleUploadAsNewPart()}>
          Upload file
        </Button>
        {files.length > 0 && (
          <Select
            size="small"
            placeholder={
              <>
                <PaperClipOutlined /> Attach existing file
              </>
            }
            value={undefined}
            style={{ width: 240 }}
            onChange={(hash: string) => {
              const ref = files.find((f) => f.hash === hash);
              if (ref) addFilePart(ref);
            }}
            options={files.map((f) => ({
              value: f.hash,
              label: (
                <span>
                  <FileOutlined /> {f.filename}{' '}
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    ({formatBytes(f.size)})
                  </Text>
                </span>
              ),
            }))}
          />
        )}
      </div>

      <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 11, color: token.colorTextTertiary }}>
        Text-part values support <code>{'{{VAR}}'}</code> template resolution at send time. File parts resolve to bytes
        via the workspace blob store; the browser sets the <code>multipart/form-data</code> Content-Type with its own
        boundary.
      </Text>
    </div>
  );
};

// ── Row (sortable) ─────────────────────────────────────────────────

interface MultipartRowProps {
  row: Row;
  files: FileRef[];
  filesReady: boolean;
  onUpdate: (mutate: (part: V5.MultipartPart) => V5.MultipartPart) => void;
  onRemove: () => void;
  onUploadReplace: () => void;
}

const MultipartRow: React.FC<MultipartRowProps> = ({ row, files, filesReady, onUpdate, onRemove, onUploadReplace }) => {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const enabled = row.part.enabled !== false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const kindSelect = (
    <Select
      size="small"
      value={row.part.kind}
      style={{ width: 72 }}
      onChange={(kind: 'text' | 'file') => {
        if (kind === row.part.kind) return;
        onUpdate((part) => {
          if (kind === 'text') {
            return { kind: 'text', name: part.name, value: '', enabled: part.enabled };
          }
          // Flipping to file — leave fileRef as a placeholder until
          // the user picks one. The placeholder hash keeps the shape
          // valid and the "Upload required" badge surfaces until
          // replaced.
          const placeholder: FileRef = {
            hash: 'placeholder:new-file',
            filename: 'new-file',
            size: 0,
          };
          return { kind: 'file', name: part.name, fileRef: placeholder, enabled: part.enabled };
        });
      }}
      options={[
        { value: 'text', label: 'Text' },
        { value: 'file', label: 'File' },
      ]}
    />
  );

  const nameInput = (
    <Input
      size="small"
      placeholder="Field name"
      value={row.part.name}
      onChange={(e) => onUpdate((part) => ({ ...part, name: e.target.value }))}
      style={{
        flex: 1,
        fontFamily: "'SF Mono', monospace",
        fontSize: 11,
        color: enabled ? token.colorText : token.colorTextQuaternary,
      }}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 6,
        padding: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Button
          type="text"
          size="small"
          icon={<HolderOutlined />}
          style={{ cursor: 'grab', padding: 0 }}
          {...attributes}
          {...listeners}
        />
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onUpdate((part) => ({ ...part, enabled: e.target.checked }))}
          style={{ width: 14, height: 14 }}
          aria-label="Enable part"
        />
        {kindSelect}
        {nameInput}
        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={onRemove} aria-label="Remove part" />
      </div>

      {row.part.kind === 'text' ? (
        <Input.TextArea
          size="small"
          autoSize={{ minRows: 1, maxRows: 8 }}
          value={row.part.value}
          placeholder="Value (supports {{VAR}})"
          onChange={(e) =>
            onUpdate((part) => {
              if (part.kind !== 'text') return part;
              return { ...part, value: e.target.value };
            })
          }
          style={{
            fontFamily: "'SF Mono', monospace",
            fontSize: 11,
            color: enabled ? token.colorText : token.colorTextQuaternary,
          }}
        />
      ) : (
        <FilePartRow
          part={row.part}
          files={files}
          filesReady={filesReady}
          onUpdate={onUpdate}
          onUploadReplace={onUploadReplace}
        />
      )}
    </div>
  );
};

// ── File-part sub-row ─────────────────────────────────────────────

interface FilePartRowProps {
  part: Extract<V5.MultipartPart, { kind: 'file' }>;
  files: FileRef[];
  filesReady: boolean;
  onUpdate: (mutate: (part: V5.MultipartPart) => V5.MultipartPart) => void;
  onUploadReplace: () => void;
}

const FilePartRow: React.FC<FilePartRowProps> = ({ part, files, filesReady, onUpdate, onUploadReplace }) => {
  const { token } = theme.useToken();
  const placeholder = isPlaceholderFileRef(part.fileRef);
  const selectedOption = placeholder ? undefined : part.fileRef.hash;
  const exists = !placeholder && files.some((f) => f.hash === part.fileRef.hash);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Select
          size="small"
          placeholder="Select uploaded file"
          style={{ flex: 1 }}
          value={selectedOption}
          onChange={(hash: string) => {
            const ref = files.find((f) => f.hash === hash);
            if (!ref) return;
            onUpdate((p) => {
              if (p.kind !== 'file') return p;
              return { ...p, fileRef: ref };
            });
          }}
          options={files.map((f) => ({
            value: f.hash,
            label: (
              <span>
                <FileOutlined /> {f.filename}{' '}
                <Text type="secondary" style={{ fontSize: 10 }}>
                  ({formatBytes(f.size)}
                  {f.mimeType ? ` · ${f.mimeType}` : ''})
                </Text>
              </span>
            ),
          }))}
          notFoundContent={filesReady ? 'No files uploaded yet — use "Upload file" above.' : 'Loading files…'}
        />
        <Tooltip title={placeholder ? 'Upload file to replace placeholder' : 'Upload new file and use it here'}>
          <Button size="small" icon={<UploadOutlined />} onClick={onUploadReplace}>
            {placeholder ? 'Upload' : 'Replace'}
          </Button>
        </Tooltip>
      </div>

      {placeholder && (
        <Tag icon={<WarningOutlined />} color="warning" style={{ fontSize: 10, margin: 0 }}>
          Upload required — imported placeholder for {part.fileRef.filename}
        </Tag>
      )}
      {!placeholder && !exists && files.length > 0 && (
        <Tag color="error" style={{ fontSize: 10, margin: 0 }}>
          File <code>{part.fileRef.filename}</code> is no longer in this workspace. Re-upload or pick another file.
        </Tag>
      )}

      <Input
        size="small"
        placeholder="filename override (optional — defaults to the uploaded filename)"
        value={part.filenameOverride ?? ''}
        onChange={(e) =>
          onUpdate((p) => {
            if (p.kind !== 'file') return p;
            const next = e.target.value;
            return { ...p, filenameOverride: next.length > 0 ? next : undefined };
          })
        }
        style={{
          fontFamily: "'SF Mono', monospace",
          fontSize: 11,
          color: token.colorText,
        }}
      />
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default MultipartEditor;

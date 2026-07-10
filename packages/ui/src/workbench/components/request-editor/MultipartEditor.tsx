/**
 * MultipartEditor — form-data body editor. Uses the shared
 * `EditableGridTable` shell (same visual language + drag + sticky
 * header + ghost-row logic as Params / Headers). What differs: the
 * Value cell carries a per-row `Text` / `File` kind selector.
 *
 *   • Text parts take a string value run through template resolution
 *     at send time.
 *   • File parts reference ONE OR MORE workspace blobs. HTTP multipart
 *     allows repeated field names by design, so a single row with N
 *     file refs emits N `FormData.append(name, …)` calls at send
 *     time. Each file shows as a tag in the Value cell; users add
 *     files via a single dropdown that groups "upload new" with
 *     existing workspace files.
 *
 * A placeholder FileRef emitted by an importer (curl `-F @path`, HAR
 * multipart parts, etc.) surfaces as an "Upload required" tag + inline
 * Upload button so reconciliation is one click.
 */

import { CloseOutlined, DeleteOutlined, FileOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { useFiles } from '@openheaders/ui/shared/hooks/readers/useFiles';
import type { FileRef } from '@openheaders/core/files';
import { isPlaceholderFileRef, placeholderFileRef } from '@openheaders/core/files';
import type { MultipartPart } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MenuProps } from 'antd';
import { Dropdown, Select, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { GripResizeXHandler } from '../template-input';
import { EditableGridTable, type EditableRowAdapter } from './EditableGridTable';
import { GridValueField } from './GridValueField';

// Value column gets a wider proportional share (1.6fr) for the file
// picker, but no fixed px floor — it flexes down to fit a narrow pane
// instead of forcing a horizontal scroll (see EditableGridTable's
// DEFAULT_COLUMN_WIDTH note).
const FORM_DATA_COLUMN_WIDTHS = { value: 'minmax(0, 1.6fr)' };

// Injected once at module load: hover-reveal for the per-file delete
// button inside the multipart file dropdown.
const MP_DROPDOWN_STYLE_ID = 'mp-file-dropdown-styles';
if (typeof document !== 'undefined' && !document.getElementById(MP_DROPDOWN_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = MP_DROPDOWN_STYLE_ID;
  style.textContent = `
.mp-file-menu-item .mp-file-menu-delete { opacity: 0; transition: opacity 120ms ease; }
.mp-file-menu-item:hover .mp-file-menu-delete { opacity: 1; }
  `;
  document.head.appendChild(style);
}

interface MultipartEditorProps {
  parts: MultipartPart[];
  onChange: (parts: MultipartPart[]) => void;
}

let rowIdCounter = 0;
const nextRowId = (): string => `mp-${++rowIdCounter}`;

type IdentifiedPart = MultipartPart & { __id: string };
type IdentifiedFilePart = Extract<IdentifiedPart, { kind: 'file' }>;

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const makeEmptyText = (id: string): IdentifiedPart => ({
  __id: id,
  kind: 'text',
  uid: generateUid(),
  name: '',
  value: '',
  description: '',
  enabled: true,
});

const ADAPTER: EditableRowAdapter<IdentifiedPart> = {
  getId: (r) => r.__id,
  getEnabled: (r) => r.enabled !== false,
  setEnabled: (r, v) => ({ ...r, enabled: v }),
  getKey: (r) => r.name,
  setKey: (r, v) => ({ ...r, name: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => makeEmptyText(nextRowId()),
  isEmpty: (r) => r.kind === 'text' && r.name === '' && r.value === '' && (r.description ?? '') === '',
};

function stripId(row: IdentifiedPart): MultipartPart {
  const { __id: _id, ...part } = row;
  return part as MultipartPart;
}

const MultipartEditor: React.FC<MultipartEditorProps> = ({ parts, onChange }) => {
  const { files, isReady: filesReady, uploadFile, deleteFile } = useFiles();

  const idMapRef = useRef<WeakMap<MultipartPart, string>>(new WeakMap());
  const rows = useMemo<IdentifiedPart[]>(() => {
    return parts.map((part) => {
      let id = idMapRef.current.get(part);
      if (!id) {
        id = nextRowId();
        idMapRef.current.set(part, id);
      }
      return { ...part, __id: id } as IdentifiedPart;
    });
  }, [parts]);

  const handleChange = useCallback(
    (next: IdentifiedPart[]) => {
      const fresh = new WeakMap<MultipartPart, string>();
      const stripped = next.map((row) => {
        const bare = stripId(row);
        fresh.set(bare, row.__id);
        return bare;
      });
      idMapRef.current = fresh;
      onChange(stripped);
    },
    [onChange],
  );

  return (
    <EditableGridTable<IdentifiedPart>
      rows={rows}
      onChange={handleChange}
      adapter={ADAPTER}
      columnWidths={FORM_DATA_COLUMN_WIDTHS}
      bulkEdit={{
        serialize: serializeMultipartToText,
        parse: (text) => parseMultipartFromText(text, rows, files),
        placeholder:
          'field1:text value\n' +
          'avatar:@profile.png # file reference — rebinds by filename\n' +
          'attachments:@one.pdf,@two.pdf # multiple files on one row\n' +
          '//disabled:value',
      }}
      renderValueCell={(row, update, ctx) => (
        <ValueCell
          row={row}
          update={update}
          dim={ctx.dim}
          isPlaceholder={ctx.isPlaceholder}
          expanded={ctx.expanded}
          onResizeX={ctx.onValueResizeX}
          files={files}
          filesReady={filesReady}
          uploadFile={uploadFile}
          deleteFile={deleteFile}
        />
      )}
    />
  );
};

// ── Value cell (Text/File switch) ─────────────────────────────────

interface ValueCellProps {
  row: IdentifiedPart;
  update: (next: IdentifiedPart) => void;
  dim: boolean;
  isPlaceholder: boolean;
  expanded: boolean;
  onResizeX?: GripResizeXHandler;
  files: FileRef[];
  filesReady: boolean;
  uploadFile: (file: File, filename: string, mimeType?: string) => Promise<FileRef | null>;
  deleteFile: (hash: string) => Promise<boolean>;
}

const ValueCell: React.FC<ValueCellProps> = ({
  row,
  update,
  dim,
  isPlaceholder,
  expanded,
  onResizeX,
  files,
  filesReady,
  uploadFile,
  deleteFile,
}) => {
  const { token } = theme.useToken();

  const switchKind = (kind: 'text' | 'file') => {
    if (kind === row.kind) return;
    const common = {
      uid: row.uid,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      __id: row.__id,
    };
    if (kind === 'text') {
      update({ ...common, kind: 'text', value: '' });
      return;
    }
    update({ ...common, kind: 'file', fileRefs: [] });
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <Select
        variant="borderless"
        size="small"
        value={row.kind}
        onChange={switchKind}
        options={[
          { value: 'text', label: 'Text' },
          { value: 'file', label: 'File' },
        ]}
        style={{ width: 72, flexShrink: 0 }}
        disabled={isPlaceholder}
        popupMatchSelectWidth={false}
      />
      {row.kind === 'text' ? (
        <GridValueField
          expanded={expanded}
          flagUnresolved
          value={row.value}
          placeholder="Value"
          onChange={(next) => update({ ...row, value: next })}
          onResizeX={onResizeX}
          style={{
            ...cellFont,
            flex: 1,
            minWidth: 0,
            padding: '4px 6px',
            color: dim ? token.colorTextQuaternary : token.colorText,
          }}
        />
      ) : (
        <FileValueCell
          row={row as IdentifiedFilePart}
          update={update}
          files={files}
          filesReady={filesReady}
          uploadFile={uploadFile}
          deleteFile={deleteFile}
          disabled={isPlaceholder}
        />
      )}
    </div>
  );
};

// ── File-value cell ───────────────────────────────────────────────

interface FileValueCellProps {
  row: IdentifiedFilePart;
  update: (next: IdentifiedPart) => void;
  files: FileRef[];
  filesReady: boolean;
  uploadFile: (file: File, filename: string, mimeType?: string) => Promise<FileRef | null>;
  deleteFile: (hash: string) => Promise<boolean>;
  disabled: boolean;
}

const FileValueCell: React.FC<FileValueCellProps> = ({
  row,
  update,
  files,
  filesReady,
  uploadFile,
  deleteFile,
  disabled,
}) => {
  const { token } = theme.useToken();
  // `fileRefs` can be undefined on rows that pre-date the multi-file
  // schema widening; normalize to an empty list so the UI treats it
  // as "no selection yet".
  const fileRefs = row.fileRefs ?? [];
  const hasPlaceholder = fileRefs.some((ref) => isPlaceholderFileRef(ref));
  const isEmpty = fileRefs.length === 0;

  const promptUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    await new Promise<void>((resolve) => {
      input.onchange = async () => {
        const picked = Array.from(input.files ?? []);
        if (picked.length === 0) {
          resolve();
          return;
        }
        // Each upload produces a fresh `fileId`, so there's no true
        // dedup at the upload layer — but attaching the SAME fileId
        // twice to one row would emit the identical FormData entry
        // back-to-back, which is almost never what the user wants.
        // Gate on fileId (not hash) so "two uploads of the same
        // bytes" still produce two separate chips.
        const attached = new Set(fileRefs.map((r) => r.fileId));
        const appended: FileRef[] = [];
        for (const file of picked) {
          const ref = await uploadFile(file, file.name, file.type || undefined);
          if (!ref) continue;
          if (attached.has(ref.fileId)) continue;
          attached.add(ref.fileId);
          appended.push(ref);
        }
        if (appended.length > 0) {
          update({ ...row, fileRefs: [...fileRefs, ...appended] });
        }
        resolve();
      };
      input.click();
    });
  }, [uploadFile, row, update, fileRefs]);

  const pickExisting = useCallback(
    (fileId: string) => {
      const ref = files.find((f) => f.fileId === fileId);
      if (!ref) return;
      // Same fileId already on the row — picking again would add a
      // duplicate. Silently skip.
      if (fileRefs.some((r) => r.fileId === ref.fileId)) return;
      update({ ...row, fileRefs: [...fileRefs, ref] });
    },
    [files, row, update, fileRefs],
  );

  const removeRef = useCallback(
    (idx: number) => {
      const next = fileRefs.filter((_, i) => i !== idx);
      update({ ...row, fileRefs: next });
    },
    [row, update, fileRefs],
  );

  const handleDelete = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      // Stop propagation first so the enclosing menu item's onClick
      // (which would attach the file to the row) doesn't also fire.
      e.stopPropagation();
      e.preventDefault();
      void deleteFile(fileId);
    },
    [deleteFile],
  );

  // Dropdown menu: "+ New file" action on top, uploaded files below
  // (minus anything already attached so the user can't pick a dupe).
  // Each uploaded row exposes a hover-revealed delete button that
  // purges the file from the workspace blob store.
  const menuItems: MenuProps['items'] = useMemo(() => {
    const attached = new Set(fileRefs.map((r) => r.fileId));
    const available = files.filter((f) => !attached.has(f.fileId));
    const items: NonNullable<MenuProps['items']> = [
      {
        key: '__new_file__',
        icon: <PlusOutlined />,
        label: 'New file from local machine',
        onClick: () => void promptUpload(),
      },
    ];
    if (filesReady && files.length > 0) {
      items.push({ type: 'divider' });
      items.push({
        key: '__uploaded_header__',
        type: 'group',
        label: <span style={{ fontSize: 11, color: token.colorTextSecondary }}>Uploaded files</span>,
        children:
          available.length > 0
            ? available.map((f) => ({
                key: f.fileId,
                icon: <FileOutlined />,
                label: (
                  <span
                    className="mp-file-menu-item"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.filename}
                      <span style={{ color: token.colorTextTertiary, marginLeft: 6, fontSize: 10 }}>
                        ({formatBytes(f.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      className="mp-file-menu-delete"
                      aria-label={`Delete ${f.filename} from workspace`}
                      onClick={(e) => handleDelete(f.fileId, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        color: token.colorTextTertiary,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                ),
                onClick: () => pickExisting(f.fileId),
              }))
            : [
                {
                  key: '__all_attached__',
                  label: 'All uploaded files already attached',
                  disabled: true,
                },
              ],
      });
    }
    return items;
  }, [files, fileRefs, filesReady, promptUpload, pickExisting, handleDelete, token]);

  const triggerLabel = isEmpty ? (filesReady ? 'Select files' : 'Loading files…') : '+ Add file';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        minWidth: 0,
        padding: '2px 0',
      }}
    >
      {fileRefs.map((ref, i) => (
        <FileChip
          key={`${ref.fileId}:${i}`}
          ref_={ref}
          onRemove={() => removeRef(i)}
          missingInWorkspace={
            !isPlaceholderFileRef(ref) && files.length > 0 && !files.some((f) => f.fileId === ref.fileId)
          }
        />
      ))}
      <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={disabled} overlayStyle={{ minWidth: 260 }}>
        <button
          type="button"
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 120,
            background: 'transparent',
            border: 'none',
            padding: '2px 6px',
            textAlign: 'left',
            color: isEmpty ? token.colorTextTertiary : token.colorPrimary,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {triggerLabel}
        </button>
      </Dropdown>
      {hasPlaceholder && (
        <Tag icon={<WarningOutlined />} color="warning" style={{ fontSize: 10, margin: 0 }}>
          Upload required
        </Tag>
      )}
    </div>
  );
};

interface FileChipProps {
  ref_: FileRef;
  onRemove: () => void;
  missingInWorkspace: boolean;
}

const FileChip: React.FC<FileChipProps> = ({ ref_, onRemove, missingInWorkspace }) => {
  const { token } = theme.useToken();
  const isPlaceholder = isPlaceholderFileRef(ref_);
  const warning = isPlaceholder || missingInWorkspace;
  return (
    <Tag
      closable
      onClose={(e) => {
        e.preventDefault();
        onRemove();
      }}
      closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
      icon={warning ? <WarningOutlined /> : undefined}
      color={warning ? 'warning' : 'default'}
      style={{
        fontSize: 11,
        margin: 0,
        color: warning ? token.colorWarningText : token.colorText,
        background: warning ? token.colorWarningBg : token.colorFillQuaternary,
        border: `1px solid ${warning ? token.colorWarningBorder : token.colorBorderSecondary}`,
      }}
    >
      {ref_.filename}
    </Tag>
  );
};

// ── Bulk-edit serialize / parse ───────────────────────────────────

/**
 * Serialize parts to the bulk-edit text format. Order is preserved so
 * the user can reorder rows by moving lines around.
 *   • Text part:  `name:value` (+ optional ` # description`)
 *   • File part:  `name:@file1.ext[,@file2.ext…]` — one row can list
 *     multiple file references; each is rebound by filename on parse.
 *   • Disabled:   leading `//`.
 */
function serializeMultipartToText(parts: IdentifiedPart[]): string {
  return parts
    .filter((p) => {
      if (p.kind === 'text') return p.name.trim() || p.value.trim() || p.description?.trim();
      return (p.fileRefs ?? []).length > 0 || p.name.trim() || p.description?.trim();
    })
    .map((p) => {
      const prefix = p.enabled === false ? '//' : '';
      const note = p.description ? ` # ${p.description}` : '';
      if (p.kind === 'text') {
        return `${prefix}${p.name}:${p.value}${note}`;
      }
      const refs = p.fileRefs ?? [];
      const fileList = refs.length === 0 ? '' : refs.map((ref) => `@${ref.filename}`).join(',');
      return `${prefix}${p.name}:${fileList}${note}`;
    })
    .join('\n');
}

/**
 * Parse bulk-edit text back into parts. File-reference entries
 * (`name:@filename[,@filename2…]`) resolve each filename
 * independently, in this order:
 *
 *   1. Existing file part on the draft with a FileRef matching the
 *      declared filename — preserves the underlying hash + mimeType.
 *   2. Uploaded workspace file with that filename — rebinds so the
 *      user can swap files by retyping the name.
 *   3. Placeholder FileRef — shows "Upload required" warning on exit.
 *
 * Any existing file parts NOT re-mentioned in the bulk text are
 * dropped (same semantic as deleting a row in the table).
 */
function parseMultipartFromText(
  text: string,
  currentRows: IdentifiedPart[],
  workspaceFiles: FileRef[],
): IdentifiedPart[] {
  const currentFileParts = currentRows.filter((p): p is IdentifiedFilePart => p.kind === 'file');
  // Flatten every FileRef on the current draft so `@filename` lookups
  // can match any ref in any row — lets users freely move file refs
  // between rows by editing text.
  const draftRefsByName = new Map<string, FileRef>();
  for (const part of currentFileParts) {
    for (const ref of part.fileRefs ?? []) {
      if (!draftRefsByName.has(ref.filename)) draftRefsByName.set(ref.filename, ref);
    }
  }

  const result: IdentifiedPart[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const colonIdx = noteless.indexOf(':');
    const name = colonIdx >= 0 ? noteless.slice(0, colonIdx).trim() : noteless.trim();
    const valueRaw = colonIdx >= 0 ? noteless.slice(colonIdx + 1).trim() : '';

    if (valueRaw.startsWith('@') || valueRaw === '') {
      // Split `@a.log,@b.log` — each entry resolved independently.
      const refs: FileRef[] = [];
      if (valueRaw.length > 0) {
        const entries = valueRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.startsWith('@'));
        for (const entry of entries) {
          const declared = entry.slice(1).trim();
          if (!declared) continue;
          const fromDraft = draftRefsByName.get(declared);
          if (fromDraft) {
            refs.push(fromDraft);
            continue;
          }
          const fromWorkspace = workspaceFiles.find((f) => f.filename === declared);
          if (fromWorkspace) {
            refs.push(fromWorkspace);
            continue;
          }
          // Unknown — emit a placeholder whose filename echoes what
          // the user typed so the exit chip reads `<name> — not found`.
          refs.push(placeholderFileRef({ filename: declared }));
        }
      }
      result.push({ __id: nextRowId(), kind: 'file', uid: generateUid(), name, fileRefs: refs, description, enabled });
    } else {
      result.push({
        __id: nextRowId(),
        kind: 'text',
        uid: generateUid(),
        name,
        value: valueRaw,
        description,
        enabled,
      });
    }
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default MultipartEditor;

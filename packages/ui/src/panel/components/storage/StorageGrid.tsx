/**
 * The Storage tool window's key/value grid, with its write affordances:
 * an add row (pinned under the header while adding), inline row editing
 * (double-click or the pencil — key change = rename, committed as
 * write-new-then-remove-old by the hook), and a per-row hover delete.
 *
 * A clipped entry's edit starts with the lazy full-value fetch — saving
 * the 16k preview back would corrupt the value — and blocks with a note
 * when the value is past the host's edit ceiling.
 */

import { CloseOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import type { DomStorageEntry, DomStorageFullValue } from '../../data/storage/storage-inspector-host';

function formatLength(chars: number): string {
  if (chars < 1024) return `${chars} chars`;
  return `${(chars / 1024).toFixed(1)}k chars`;
}

type EditPhase = 'ready' | 'loading' | 'too-large' | 'fetch-failed';

interface EditState {
  originalKey: string;
  key: string;
  value: string;
  phase: EditPhase;
}

interface StorageGridProps {
  entries: ReadonlyArray<DomStorageEntry>;
  /** Add-row visibility is owned by the panel (its + button toggles it). */
  adding: boolean;
  onCloseAdd: () => void;
  onCommit: (originalKey: string | null, key: string, value: string) => Promise<boolean>;
  onRemove: (key: string) => Promise<boolean>;
  fetchFullValue: (key: string) => Promise<DomStorageFullValue | null>;
}

export function StorageGrid({ entries, adding, onCloseAdd, onCommit, onRemove, fetchFullValue }: StorageGridProps) {
  const [editing, setEditing] = useState<EditState | null>(null);

  const startEdit = (entry: DomStorageEntry): void => {
    if (!entry.clipped) {
      setEditing({ originalKey: entry.key, key: entry.key, value: entry.value, phase: 'ready' });
      return;
    }
    setEditing({ originalKey: entry.key, key: entry.key, value: '', phase: 'loading' });
    void fetchFullValue(entry.key).then((full) => {
      setEditing((prev) => {
        if (!prev || prev.originalKey !== entry.key || prev.phase !== 'loading') return prev;
        if (full?.value != null) return { ...prev, value: full.value, phase: 'ready' };
        return { ...prev, phase: full?.tooLarge ? 'too-large' : 'fetch-failed' };
      });
    });
  };

  const commitEdit = (): void => {
    if (!editing || editing.phase !== 'ready' || !editing.key) return;
    void onCommit(editing.originalKey, editing.key, editing.value).then((ok) => {
      if (ok) setEditing(null);
    });
  };

  return (
    <div className="dt-storage-grid" role="table" aria-label="Storage entries">
      <div className="dt-storage-grid-header" role="row">
        <span role="columnheader">Key</span>
        <span role="columnheader">Value</span>
      </div>
      {adding && (
        <AddRow
          onCancel={onCloseAdd}
          onCommit={(key, value) =>
            void onCommit(null, key, value).then((ok) => {
              if (ok) onCloseAdd();
            })
          }
        />
      )}
      {entries.map((e) =>
        editing && editing.originalKey === e.key ? (
          <EditRow
            key={e.key}
            editing={editing}
            onChange={setEditing}
            onCommit={commitEdit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="dt-storage-row" role="row" key={e.key} onDoubleClick={() => startEdit(e)}>
            <span className="dt-storage-key" role="cell" title={e.key}>
              {e.key}
            </span>
            <span className="dt-storage-value" role="cell" title={e.clipped ? undefined : e.value}>
              {e.value}
              {e.clipped && <span className="dt-storage-clip-note"> … clipped ({formatLength(e.valueLength)})</span>}
            </span>
            <span className="dt-storage-row-actions">
              <button
                type="button"
                className="dt-storage-action"
                title="Edit this entry"
                aria-label={`Edit ${e.key}`}
                onClick={() => startEdit(e)}
              >
                <EditOutlined />
              </button>
              <button
                type="button"
                className="dt-storage-action"
                title="Delete this entry"
                aria-label={`Delete ${e.key}`}
                onClick={() => void onRemove(e.key)}
              >
                <DeleteOutlined />
              </button>
            </span>
          </div>
        ),
      )}
    </div>
  );
}

interface AddRowProps {
  onCancel: () => void;
  onCommit: (key: string, value: string) => void;
}

function AddRow({ onCancel, onCommit }: AddRowProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    keyRef.current?.focus();
  }, []);

  const commit = (): void => {
    if (key) onCommit(key, value);
  };
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="dt-storage-row dt-storage-row--editing" role="row">
      <input
        ref={keyRef}
        type="text"
        className="dt-storage-cell-input"
        placeholder="Key"
        aria-label="New entry key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <input
        type="text"
        className="dt-storage-cell-input"
        placeholder="Value"
        aria-label="New entry value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className="dt-storage-row-actions dt-storage-row-actions--pinned">
        <button type="button" className="dt-storage-action" title="Cancel" aria-label="Cancel add" onClick={onCancel}>
          <CloseOutlined />
        </button>
      </span>
    </div>
  );
}

interface EditRowProps {
  editing: EditState;
  onChange: (next: EditState) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function EditRow({ editing, onChange, onCommit, onCancel }: EditRowProps) {
  const busy = editing.phase === 'loading';
  const blocked = editing.phase === 'too-large' || editing.phase === 'fetch-failed';
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') onCommit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="dt-storage-row dt-storage-row--editing" role="row">
      <input
        type="text"
        className="dt-storage-cell-input"
        aria-label="Entry key"
        value={editing.key}
        disabled={busy || blocked}
        onChange={(e) => onChange({ ...editing, key: e.target.value })}
        onKeyDown={onKeyDown}
      />
      {blocked ? (
        <span className="dt-storage-edit-note">
          {editing.phase === 'too-large'
            ? 'Too large to edit here — the full value exceeds the edit ceiling.'
            : 'The full value can’t be read right now.'}
        </span>
      ) : (
        <input
          type="text"
          className="dt-storage-cell-input"
          aria-label="Entry value"
          value={busy ? 'Loading full value…' : editing.value}
          disabled={busy}
          onChange={(e) => onChange({ ...editing, value: e.target.value })}
          onKeyDown={onKeyDown}
        />
      )}
      <span className="dt-storage-row-actions dt-storage-row-actions--pinned">
        <button
          type="button"
          className="dt-storage-action"
          title="Cancel"
          aria-label="Cancel edit"
          onClick={onCancel}
        >
          <CloseOutlined />
        </button>
      </span>
    </div>
  );
}

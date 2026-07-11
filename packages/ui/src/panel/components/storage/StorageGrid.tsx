/**
 * The Storage tool window's key/value grid, with its write affordances:
 * an add row (pinned under the header while adding), inline row editing
 * (double-click or the pencil — key change = rename, committed as
 * write-new-then-remove-old by the hook), and a per-row hover delete.
 * Edit/add rows carry the shared storage Save button (orange ⇔ dirty
 * against the base, grey when clean or reverted) plus the ✕ cancel; a
 * commit lands on the button, Enter, or ⌘S from either input.
 * A single click on a row opens the entry as a full editor-tab document
 * (IDB-record parity); the inline edit stays for quick tweaks.
 *
 * A clipped entry's edit starts with the lazy full-value fetch — saving
 * the 16k preview back would corrupt the value — and blocks with a note
 * when the value is past the host's edit ceiling.
 */

import { CloseOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { isMac } from '@openheaders/ui/shared/platform';
import { useEffect, useRef, useState } from 'react';
import type { DomStorageArea, DomStorageEntry, DomStorageFullValue } from '../../data/storage/storage-inspector-host';
import { DomStorageColumnInfo } from './DomStorageColumnInfo';
import { StorageColumnHeaderCell } from './StorageColumnHeaderCell';
import { StorageDocSaveButton } from './StorageDocSaveButton';
import { UndoableCellInput } from './UndoableCellInput';

function formatLength(chars: number): string {
  if (chars < 1024) return `${chars} chars`;
  return `${(chars / 1024).toFixed(1)}k chars`;
}

type EditPhase = 'ready' | 'loading' | 'too-large' | 'fetch-failed';

interface EditState {
  originalKey: string;
  /** The base value the draft is diffed against for the dirty state —
   *  a clipped entry's base is the lazily fetched FULL value. */
  originalValue: string;
  key: string;
  value: string;
  phase: EditPhase;
}

/** ⌘S / Ctrl+S inside the row's inputs — scoped to the field (not the
 *  window) so it can't race a document editor's own chord; stopping
 *  propagation keeps it from reaching those window-level handlers. */
function isSaveChord(e: React.KeyboardEvent): boolean {
  return (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's';
}

interface StorageGridProps {
  /** Which DOM storage area the grid shows — the column popovers'
   *  example write names the matching global. */
  area: DomStorageArea;
  entries: ReadonlyArray<DomStorageEntry>;
  /** Add-row visibility is owned by the panel (its + button toggles it). */
  adding: boolean;
  onCloseAdd: () => void;
  onCommit: (originalKey: string | null, key: string, value: string) => Promise<boolean>;
  onRemove: (key: string) => Promise<boolean>;
  fetchFullValue: (key: string) => Promise<DomStorageFullValue | null>;
  /** Open one entry as an editor-tab document (single-click gesture). */
  onOpenEntry?: (key: string) => void;
  /** Whether an entry is the ACTIVE editor tab's document — exactly
   *  that row renders highlighted, tracking tab switches. */
  isEntryActive?: (key: string) => boolean;
}

export function StorageGrid({
  area,
  entries,
  adding,
  onCloseAdd,
  onCommit,
  onRemove,
  fetchFullValue,
  onOpenEntry,
  isEntryActive,
}: StorageGridProps) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (entry: DomStorageEntry): void => {
    if (!entry.clipped) {
      setEditing({ originalKey: entry.key, originalValue: entry.value, key: entry.key, value: entry.value, phase: 'ready' });
      return;
    }
    setEditing({ originalKey: entry.key, originalValue: '', key: entry.key, value: '', phase: 'loading' });
    void fetchFullValue(entry.key).then((full) => {
      setEditing((prev) => {
        if (!prev || prev.originalKey !== entry.key || prev.phase !== 'loading') return prev;
        if (full?.value != null) return { ...prev, originalValue: full.value, value: full.value, phase: 'ready' };
        return { ...prev, phase: full?.tooLarge ? 'too-large' : 'fetch-failed' };
      });
    });
  };

  const commitEdit = (): void => {
    if (!editing || editing.phase !== 'ready' || !editing.key || saving) return;
    setSaving(true);
    void onCommit(editing.originalKey, editing.key, editing.value)
      .then((ok) => {
        if (ok) setEditing(null);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="dt-storage-grid" role="table" aria-label="Storage entries">
      <div className="dt-storage-grid-header" role="row">
        <StorageColumnHeaderCell label="Key" info={<DomStorageColumnInfo infoKey="key" area={area} />} />
        <StorageColumnHeaderCell label="Value" info={<DomStorageColumnInfo infoKey="value" area={area} />} />
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
            saving={saving}
            onChange={setEditing}
            onCommit={commitEdit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance
          <div
            className={`dt-storage-row${isEntryActive?.(e.key) ? ' dt-storage-row--active' : ''}`}
            role="row"
            key={e.key}
            onClick={() => onOpenEntry?.(e.key)}
            onDoubleClick={() => startEdit(e)}
          >
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
                onClick={(ev) => {
                  ev.stopPropagation();
                  startEdit(e);
                }}
              >
                <EditOutlined />
              </button>
              <button
                type="button"
                className="dt-storage-action"
                title="Delete this entry"
                aria-label={`Delete ${e.key}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  void onRemove(e.key);
                }}
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

  const savable = key.length > 0;
  const dirty = key.length > 0 || value.length > 0;
  const commit = (): void => {
    if (savable) onCommit(key, value);
  };
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') onCancel();
    if (isSaveChord(e)) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  };

  return (
    <div className="dt-storage-row dt-storage-row--editing" role="row">
      <UndoableCellInput
        inputRef={keyRef}
        placeholder="Key"
        aria-label="New entry key"
        value={key}
        onValueChange={setKey}
        onKeyDown={onKeyDown}
      />
      <UndoableCellInput
        placeholder="Value"
        aria-label="New entry value"
        value={value}
        onValueChange={setValue}
        onKeyDown={onKeyDown}
      />
      <span className="dt-storage-row-actions dt-storage-row-actions--pinned">
        <StorageDocSaveButton
          savable={savable}
          saving={false}
          dirty={dirty}
          saveHint="Write the new entry to storage"
          blockedHint="The key can't be empty"
          isActiveDocument={false}
          onSave={commit}
        />
        <button type="button" className="dt-storage-action" title="Cancel" aria-label="Cancel add" onClick={onCancel}>
          <CloseOutlined />
        </button>
      </span>
    </div>
  );
}

interface EditRowProps {
  editing: EditState;
  saving: boolean;
  onChange: (next: EditState) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function EditRow({ editing, saving, onChange, onCommit, onCancel }: EditRowProps) {
  const busy = editing.phase === 'loading';
  const blocked = editing.phase === 'too-large' || editing.phase === 'fetch-failed';
  const dirty =
    editing.phase === 'ready' && (editing.key !== editing.originalKey || editing.value !== editing.originalValue);
  const savable = dirty && editing.key.length > 0;
  const onKeyDown = (e: React.KeyboardEvent): void => {
    // Enter on a clean draft just closes the edit — there is nothing
    // to write, and re-committing the base would be a phantom write.
    if (e.key === 'Enter') {
      if (savable) onCommit();
      else if (!dirty) onCancel();
    }
    if (e.key === 'Escape') onCancel();
    if (isSaveChord(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (savable) onCommit();
    }
  };

  return (
    <div className="dt-storage-row dt-storage-row--editing" role="row">
      <UndoableCellInput
        aria-label="Entry key"
        value={editing.key}
        disabled={busy || blocked}
        onValueChange={(key) => onChange({ ...editing, key })}
        onKeyDown={onKeyDown}
      />
      {blocked ? (
        <span className="dt-storage-edit-note">
          {editing.phase === 'too-large'
            ? 'Too large to edit here — the full value exceeds the edit ceiling.'
            : 'The full value can’t be read right now.'}
        </span>
      ) : (
        // Keyed by phase so the clipped-entry input remounts once the
        // full value lands — its undo history seeds from the real base,
        // not the loading placeholder.
        <UndoableCellInput
          key={editing.phase}
          aria-label="Entry value"
          value={busy ? 'Loading full value…' : editing.value}
          disabled={busy}
          onValueChange={(value) => onChange({ ...editing, value })}
          onKeyDown={onKeyDown}
        />
      )}
      <span className="dt-storage-row-actions dt-storage-row-actions--pinned">
        <StorageDocSaveButton
          savable={savable && !saving}
          saving={saving}
          dirty={dirty}
          saveHint="Write the edited entry back to storage"
          blockedHint="The key can't be empty"
          isActiveDocument={false}
          onSave={onCommit}
        />
        <button type="button" className="dt-storage-action" title="Cancel" aria-label="Cancel edit" onClick={onCancel}>
          <CloseOutlined />
        </button>
      </span>
    </div>
  );
}

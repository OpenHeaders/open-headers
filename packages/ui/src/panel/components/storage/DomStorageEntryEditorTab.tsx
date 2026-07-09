/**
 * DomStorageEntryEditorTab — one localStorage / sessionStorage entry
 * opened as a full editor-tab document. Fetches the entry's FULL value
 * one-shot over the host seam (the grid only ever holds the clipped
 * preview) and renders it full-width: Source is the raw string in
 * Monaco, Preview a collapsible tree offered when the current text
 * parses as JSON. The breadcrumb's "Reveal in Storage" links back to
 * the originating area's grid.
 *
 * Editing covers BOTH fields: the value in Source and the key in the
 * identity row. Dirty derives from draft-vs-document equality across
 * the pair; one Save commits them together — a same-key save is a plain
 * write, a changed key rides the host's collision-guarded rename (never
 * a silent overwrite) and re-keys the tab via `onRenamed`. A value past
 * the host's edit ceiling renders read-only. Refresh while dirty arms
 * first — a confirm discards the drafts, never silently.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { hostNavigation } from '@openheaders/core/navigation';
import ConflictDiffChip from '@openheaders/ui/shared/awareness/ConflictDiffChip';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DomStorageEntryInspectorTab, domStorageAreaName } from '../../data/inspector-tab';
import { clipConflictValue, useStorageDocConflicts } from '../../data/storage/doc-conflicts';
import { notifyDomStorageWrite, subscribeDomStorageWrites } from '../../data/storage/dom-storage-write-notifier';
import type { DomStorageArea, DomStorageRenameFailure } from '../../data/storage/storage-inspector-host';
import { getStorageInspectorHost } from '../../data/storage/storage-inspector-host';
import { useDocumentSync } from '../../data/storage/use-document-sync';
import Skeleton from '../detail/Skeleton';
import { JsonTree } from '../JsonTree';
import { ArmedIconButton } from './ArmedIconButton';
import { StorageDocSaveButton } from './StorageDocSaveButton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));

interface EntryDocument {
  value: string;
  /** The canonical vanished under a dirty editor — the drafts stay
   *  visible with an honest note instead of blanking (a clean editor
   *  re-seeds to the unavailable state instead). */
  gone?: boolean;
}

type DocumentSlot = 'loading' | 'unavailable' | 'too-large' | EntryDocument;

type ViewMode = 'source' | 'preview';

/** `write` is the value-only save's unreasoned failure. */
type SaveFailure = DomStorageRenameFailure | 'write';

const SAVE_FAILURE_NOTES: Record<SaveFailure, string> = {
  collision: 'An entry with that key already exists — saving would overwrite it. Pick a different key.',
  gone: 'The entry can’t be reached — it may have been deleted. Refresh re-checks.',
  quota: 'Save failed — the storage quota was exceeded. The original entry is unchanged.',
  write: 'Save failed — the write was rejected.',
};

interface DomStorageEntryEditorTabProps {
  tab: DomStorageEntryInspectorTab;
  onRevealInStorage: (area: DomStorageArea) => void;
  /** Mirrors the derived dirty state up into the tab (pill dot, close guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** A committed rename — the parent re-keys the tab (id, label,
   *  entryKey) so re-opens and row highlights keep matching. */
  onRenamed?: (newKey: string) => void;
  /** Registers this tab's save action for the close guard's "Save
   *  changes" path; called with `null` on unmount. Resolves whether the
   *  save committed. */
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
  /** Whether this document is the focused group's active tab — gates
   *  the Save keyboard chord when a split shows two documents. */
  isActiveDocument?: boolean;
}

export function DomStorageEntryEditorTab({
  tab,
  onRevealInStorage,
  onDirtyChange,
  onRenamed,
  registerSave,
  isActiveDocument,
}: DomStorageEntryEditorTabProps) {
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [mode, setMode] = useState<ViewMode>('source');
  // Edit buffers; null ⇒ pristine (mirrors the document).
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const fetchTokenRef = useRef(0);

  const { frameId, area, entryKey } = tab;

  const doc = typeof slot === 'object' ? slot : null;
  const sourceText = valueDraft ?? doc?.value ?? '';

  // Conflict tier over the single value leaf — the entry key can't
  // conflict (a key change under the document reads as deleted-under-
  // you). Suppressed while gone; the note supersedes the chip.
  const conflictForm = useMemo(() => ({ value: sourceText }), [sourceText]);
  const conflictCanonical = useMemo(() => (doc === null ? null : { value: doc.value }), [doc]);
  const {
    conflicts,
    seed: seedConflicts,
    dismiss: dismissConflict,
  } = useStorageDocConflicts<'value'>({
    enabled: doc !== null && doc.gone !== true,
    form: doc === null ? null : conflictForm,
    canonical: conflictCanonical,
  });
  const valueConflict = conflicts.get('value') ?? null;

  const fetchDocument = useCallback(async () => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    const token = ++fetchTokenRef.current;
    if (!host || tabId === null) {
      setSlot('unavailable');
      return;
    }
    setSlot('loading');
    const full = await host.readDomStorageValue(tabId, frameId, area, entryKey);
    if (token !== fetchTokenRef.current) return;
    if (full === null || full.value === null) setSlot(full?.tooLarge ? 'too-large' : 'unavailable');
    else {
      setSlot({ value: full.value });
      seedConflicts({ value: full.value });
    }
    setKeyDraft(null);
    setValueDraft(null);
    setSaveError(null);
  }, [frameId, area, entryKey, seedConflicts]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  const keyText = keyDraft ?? entryKey;
  const dirty =
    doc !== null &&
    ((keyDraft !== null && keyDraft !== entryKey) || (valueDraft !== null && valueDraft !== doc.value));
  // A rename to an empty key can never commit — Save stays disabled.
  const savable = dirty && keyText.length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Latest-state mirrors for the silent sync path — it lands after an
  // await and must merge against the CURRENT document + drafts, not
  // the ones captured when the fetch started.
  const docRef = useRef(doc);
  docRef.current = doc;
  const keyDraftRef = useRef(keyDraft);
  keyDraftRef.current = keyDraft;
  const valueDraftRef = useRef(valueDraft);
  valueDraftRef.current = valueDraft;

  // Live canonical catch-up: on a write notify or a poll tick, re-read
  // the entry and fold the fresh value in — a pristine editor adopts
  // it, a touched value draft is kept while the canonical underneath
  // advances. Never flips the document back to loading.
  const syncDocument = useCallback(async () => {
    if (docRef.current === null) return;
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return;
    const token = ++fetchTokenRef.current;
    const full = await host.readDomStorageValue(tabId, frameId, area, entryKey);
    if (token !== fetchTokenRef.current) return;
    const current = docRef.current;
    if (current === null) return;
    const keyTouched = keyDraftRef.current !== null && keyDraftRef.current !== entryKey;
    const valueTouched = valueDraftRef.current !== null && valueDraftRef.current !== current.value;
    if (full === null || full.value === null) {
      // Deleted under the document: a clean editor re-seeds to the
      // honest empty state; drafts stay visible with a note.
      if (keyTouched || valueTouched) {
        if (current.gone !== true) setSlot({ ...current, gone: true });
      } else {
        setSlot(full?.tooLarge ? 'too-large' : 'unavailable');
      }
      return;
    }
    if (current.gone !== true && full.value === current.value) return;
    setSlot({ value: full.value });
    if (!valueTouched) setValueDraft(null);
  }, [frameId, area, entryKey]);

  const runSync = useCallback(() => {
    void syncDocument();
  }, [syncDocument]);

  useDocumentSync({
    enabled: doc !== null && !saving,
    sync: runSync,
    subscribe: subscribeDomStorageWrites,
  });

  const handleSave = useCallback(async (): Promise<boolean> => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null || doc === null || !savable) return false;
    const nextKey = keyDraft ?? entryKey;
    const nextValue = valueDraft ?? doc.value;
    setSaving(true);
    if (nextKey === entryKey) {
      const ok = await host.writeDomStorage(tabId, frameId, area, entryKey, nextValue);
      setSaving(false);
      if (!ok) {
        setSaveError('write');
        return false;
      }
      // Commit-then-refetch through the read path — the document becomes
      // the area's truth again (the grid's poll picks it up).
      notifyDomStorageWrite();
      await fetchDocument();
      return true;
    }
    const result = await host.renameDomStorage(tabId, frameId, area, entryKey, nextKey, nextValue);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.reason ?? 'write');
      return false;
    }
    notifyDomStorageWrite();
    // The entry identity moved — re-keying the tab remounts this editor
    // under the new key, which re-fetches through the read path.
    onRenamed?.(nextKey);
    return true;
  }, [doc, savable, keyDraft, valueDraft, frameId, area, entryKey, fetchDocument, onRenamed]);

  useEffect(() => {
    registerSave?.(handleSave);
    return () => registerSave?.(null);
  }, [registerSave, handleSave]);

  // Preview parses what's on screen — the draft while editing — so it
  // never shows stale content; non-JSON values just disable it.
  const previewValue = useMemo<unknown>(() => {
    if (doc === null) return undefined;
    try {
      return JSON.parse(sourceText) as unknown;
    } catch {
      return undefined;
    }
  }, [doc, sourceText]);
  const canPreview = previewValue !== undefined;
  const effectiveMode: ViewMode = mode === 'preview' && canPreview ? 'preview' : 'source';
  // Language keys off the CANONICAL value, not the draft — mid-edit
  // invalid JSON must not flip Monaco's language per keystroke.
  const language = useMemo(() => {
    if (doc === null) return 'plaintext';
    try {
      JSON.parse(doc.value);
      return 'json';
    } catch {
      return 'plaintext';
    }
  }, [doc]);

  const errorNote = saveError === null ? null : SAVE_FAILURE_NOTES[saveError];
  const crumbTitle = `${domStorageAreaName(area)} › ${entryKey}`;

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        {/* View modes live LEFT with the document identity; the action
            cluster (Save/Refresh/Reveal) stays right — different
            domains, different sides. */}
        <span className="dt-storagedoc-modes" role="tablist" aria-label="Entry view mode">
          <button
            type="button"
            className="dt-storagedoc-mode"
            role="tab"
            aria-selected={effectiveMode === 'preview'}
            data-active={effectiveMode === 'preview'}
            disabled={!canPreview}
            title={canPreview ? 'Collapsible tree over the parsed value' : 'Preview needs a JSON value'}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
          <button
            type="button"
            className="dt-storagedoc-mode"
            role="tab"
            aria-selected={effectiveMode === 'source'}
            data-active={effectiveMode === 'source'}
            title="Raw value view"
            onClick={() => setMode('source')}
          >
            Source
          </button>
        </span>
        <span className="dt-storagedoc-crumb" title={crumbTitle}>
          {domStorageAreaName(area)} › <span className="dt-storagedoc-crumb-key">{entryKey}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        {doc !== null && (
          <StorageDocSaveButton
            savable={savable}
            saving={saving}
            dirty={dirty}
            saveHint="Write the edited entry back to storage"
            blockedHint="The key can’t be empty"
            isActiveDocument={isActiveDocument}
            onSave={() => void handleSave()}
          />
        )}
        {dirty ? (
          <ArmedIconButton
            icon={<ReloadOutlined />}
            title="Re-read the entry"
            confirmTitle="Discards your edits — click again to refresh"
            ariaLabel="Refresh entry"
            onConfirm={() => void fetchDocument()}
          />
        ) : (
          <button
            type="button"
            className="dt-storage-action"
            title="Re-read the entry"
            aria-label="Refresh entry"
            onClick={() => void fetchDocument()}
          >
            <ReloadOutlined />
          </button>
        )}
        <button
          type="button"
          className="dt-storagedoc-reveal"
          title={`Open ${domStorageAreaName(area)} in the Storage tool window`}
          onClick={() => onRevealInStorage(area)}
        >
          Reveal in Storage
        </button>
      </div>
      {doc !== null && (
        <div className="dt-storagedoc-key-row">
          <span className="dt-storagedoc-key-label">Key</span>
          <input
            type="text"
            className="dt-storage-cell-input"
            aria-label="Entry key"
            value={keyText}
            onChange={(e) => {
              setKeyDraft(e.target.value);
              setSaveError(null);
            }}
          />
        </div>
      )}
      {valueConflict !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--conflict">
          The value changed in the browser while you were editing.
          <ConflictDiffChip
            theirs={clipConflictValue(valueConflict.theirs)}
            base={clipConflictValue(valueConflict.base)}
            local={clipConflictValue(sourceText)}
            onTakeTheirs={() => setValueDraft(null)}
            onKeepMine={() => dismissConflict('value')}
          />
        </div>
      )}
      {doc?.gone === true && (
        <div className="dt-storagedoc-note">
          This entry was deleted in the browser — your unsaved edits are kept. Save writes it back.
          <button
            type="button"
            className="dt-storagedoc-note-action"
            onClick={() => {
              setKeyDraft(null);
              setValueDraft(null);
              setSlot('unavailable');
            }}
          >
            Discard my edits
          </button>
        </div>
      )}
      {errorNote !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--error" role="alert">
          {errorNote}
        </div>
      )}
      {slot === 'loading' ? (
        <div className="dt-empty">Loading…</div>
      ) : slot === 'unavailable' ? (
        <div className="dt-empty-hero">
          <strong>Entry no longer available</strong>
          <span className="dt-empty-hero-sub">
            It may have been deleted, or the frame can’t be read right now — Refresh retries.
          </span>
        </div>
      ) : slot === 'too-large' ? (
        <div className="dt-empty-hero">
          <strong>Too large to open</strong>
          <span className="dt-empty-hero-sub">The value is past the editor’s ceiling and stays read-only.</span>
        </div>
      ) : effectiveMode === 'preview' ? (
        <div className="dt-storagedoc-preview" aria-label="Entry value tree">
          <JsonTree value={previewValue} defaultExpandedDepth={2} />
        </div>
      ) : (
        <div className="dt-storagedoc-source">
          <Suspense fallback={<Skeleton />}>
            <CodeViewer
              value={sourceText}
              language={language}
              readOnly={false}
              onChange={(next) => {
                setValueDraft(next);
                setSaveError(null);
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

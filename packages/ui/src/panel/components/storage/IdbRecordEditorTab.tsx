/**
 * IdbRecordEditorTab — an IndexedDB record opened as a full editor-tab
 * document. Fetches the record's serialized document one-shot over the
 * host seam (independent of the Storage tool window, which may be
 * hidden) and renders it full-width: Source is a Monaco view of the
 * exact JSON (or the read-only JSON-ish rendering for non-JSON values),
 * Preview is a collapsible tree — parsed JSON for editable documents,
 * the host-serialized preview tree for everything else. The
 * breadcrumb's "Reveal in Storage" links back to the originating store.
 *
 * Editing: exact-JSON documents (`editable: true`) edit in place in the
 * Source view. Dirty derives from draft-vs-document equality; Save puts
 * the draft back through the host seam (same-key only — the host
 * rejects a key change instead of creating a duplicate) and re-fetches
 * through the read path. Refresh while dirty arms first — a confirm
 * discards the draft, never silently.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { hostNavigation } from '@openheaders/core/navigation';
import ConflictDiffChip from '@openheaders/ui/shared/awareness/ConflictDiffChip';
import { App } from 'antd';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdbRecordInspectorTab } from '../../data/inspector-tab';
import { clipConflictValue, useStorageDocConflicts } from '../../data/storage/doc-conflicts';
import type { IdbRecordDocument, IdbRecordWriteFailure } from '../../data/storage/storage-inspector-host';
import { getStorageInspectorHost } from '../../data/storage/storage-inspector-host';
import { useDocumentSync } from '../../data/storage/use-document-sync';
import Skeleton from '../detail/Skeleton';
import { JsonTree } from '../JsonTree';
import { ArmedIconButton } from './ArmedIconButton';
import { IdbPreviewTree } from './IdbPreviewTree';
import { StorageDocSaveButton } from './StorageDocSaveButton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk. The review dialog is
// a file-path import for the same reason: the conflicts barrel pulls
// the merge editor (and Monaco) transitively.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));
const EntityConflictDialog = lazy(() => import('@openheaders/ui/shared/conflicts/EntityConflictDialog'));

/** `gone` marks a canonical that vanished (or stopped being readable
 *  as before) under a dirty editor — the draft stays visible with an
 *  honest note instead of blanking (a clean editor re-seeds to the
 *  unavailable state instead). */
type RecordDocument = IdbRecordDocument & { gone?: boolean };

type DocumentSlot = 'loading' | 'unavailable' | RecordDocument;

type ViewMode = 'source' | 'preview';

const WRITE_FAILURE_NOTES: Record<IdbRecordWriteFailure, string> = {
  parse: 'Not valid JSON — fix the syntax and save again.',
  'key-changed': 'The key changed — saving would create a new record. Restore the original key.',
  gone: 'The record can’t be reached — it may have been deleted. Refresh re-checks.',
  write: 'Save failed — the write was rejected.',
};

interface IdbRecordEditorTabProps {
  tab: IdbRecordInspectorTab;
  onRevealInStorage: (database: string, store: string) => void;
  /** Mirrors the derived dirty state up into the tab (pill dot, close guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Registers this tab's save action for the close guard's "Save
   *  changes" path; called with `null` on unmount. Resolves whether the
   *  save committed. */
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
  /** Whether this document is the focused group's active tab — gates
   *  the Save keyboard chord when a split shows two documents. */
  isActiveDocument?: boolean;
}

export function IdbRecordEditorTab({
  tab,
  onRevealInStorage,
  onDirtyChange,
  registerSave,
  isActiveDocument,
}: IdbRecordEditorTabProps) {
  const { message } = App.useApp();
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [mode, setMode] = useState<ViewMode>('source');
  // The Source edit buffer; null ⇒ pristine (mirrors the document).
  const [draftText, setDraftText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<IdbRecordWriteFailure | null>(null);
  const fetchTokenRef = useRef(0);

  const { frameId, database, store, primaryKeyWire } = tab;

  const doc = slot !== 'loading' && slot !== 'unavailable' ? slot : null;
  const sourceText = draftText ?? doc?.text ?? '';

  // Conflict tier over the single document-text leaf. Suppressed while
  // gone (deleted or turned non-editable) — the note supersedes it.
  const conflictForm = useMemo(() => ({ text: sourceText }), [sourceText]);
  const conflictCanonical = useMemo(() => (doc === null ? null : { text: doc.text }), [doc]);
  const {
    conflicts,
    seed: seedConflicts,
    dismiss: dismissConflict,
  } = useStorageDocConflicts<'text'>({
    enabled: doc !== null && doc.gone !== true && doc.editable,
    form: doc === null ? null : conflictForm,
    canonical: conflictCanonical,
  });
  const textConflict = conflicts.get('text') ?? null;
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchDocument = useCallback(async () => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    const token = ++fetchTokenRef.current;
    if (!host || tabId === null) {
      setSlot('unavailable');
      return;
    }
    setSlot('loading');
    const doc = await host.readIndexedDbRecordDocument(tabId, frameId, database, store, primaryKeyWire);
    if (token !== fetchTokenRef.current) return;
    setSlot(doc ?? 'unavailable');
    if (doc) seedConflicts({ text: doc.text });
    setDraftText(null);
    setSaveError(null);
  }, [frameId, database, store, primaryKeyWire, seedConflicts]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);
  const dirty = doc?.editable === true && draftText !== null && draftText !== doc.text;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Latest-state mirrors for the silent sync path — it lands after an
  // await and must merge against the CURRENT document + draft, not the
  // ones captured when the fetch started.
  const docRef = useRef(doc);
  docRef.current = doc;
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;

  // Live canonical catch-up: on a host invalidation push or a poll
  // tick, re-read the record and fold the fresh document in — a
  // pristine editor adopts it, a touched draft is kept while the
  // canonical underneath advances. Never flips back to loading.
  const syncDocument = useCallback(async () => {
    if (docRef.current === null) return;
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return;
    const token = ++fetchTokenRef.current;
    const next = await host.readIndexedDbRecordDocument(tabId, frameId, database, store, primaryKeyWire);
    if (token !== fetchTokenRef.current) return;
    const current = docRef.current;
    if (current === null) return;
    const touched = current.editable && draftTextRef.current !== null && draftTextRef.current !== current.text;
    if (next === null) {
      // Deleted under the document: a clean editor re-seeds to the
      // honest empty state; the draft stays visible with a note.
      if (touched) {
        if (current.gone !== true) setSlot({ ...current, gone: true });
      } else {
        setSlot('unavailable');
      }
      return;
    }
    if (touched && !next.editable) {
      // The record stopped being an editable JSON document under the
      // draft — adopting it would hide the draft and Save; keep the
      // document with the honest note instead.
      if (current.gone !== true) setSlot({ ...current, gone: true });
      return;
    }
    if (current.gone !== true && next.text === current.text && next.editable === current.editable) return;
    setSlot(next);
    if (!touched) setDraftText(null);
  }, [frameId, database, store, primaryKeyWire]);

  const runSync = useCallback(() => {
    void syncDocument();
  }, [syncDocument]);

  const subscribeInvalidations = useCallback((listener: () => void) => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return () => {};
    return host.subscribeStorageInvalidations(tabId, 'indexeddb', listener);
  }, []);

  useDocumentSync({
    enabled: doc !== null && !saving,
    sync: runSync,
    subscribe: subscribeInvalidations,
  });

  const handleSave = useCallback(async (): Promise<boolean> => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null || draftText === null) return false;
    setSaving(true);
    const result = await host.writeIndexedDbRecord(tabId, frameId, database, store, primaryKeyWire, draftText);
    setSaving(false);
    if (result.ok) {
      // Commit-then-refetch through the read path — the document becomes
      // the store's truth again (the list poll picks up the preview).
      await fetchDocument();
      return true;
    }
    setSaveError(result.reason ?? 'write');
    return false;
  }, [draftText, frameId, database, store, primaryKeyWire, fetchDocument]);

  useEffect(() => {
    registerSave?.(handleSave);
    return () => registerSave?.(null);
  }, [registerSave, handleSave]);

  // Preview parses what's on screen — the draft while editing — so it
  // never shows stale content; mid-edit invalid JSON just disables it.
  const previewValue = useMemo<unknown>(() => {
    if (!doc?.editable) return undefined;
    try {
      return JSON.parse(sourceText) as unknown;
    } catch {
      return undefined;
    }
  }, [doc, sourceText]);
  // Editable documents preview the parsed draft; read-only documents
  // preview the host-serialized bounded tree.
  const canPreview = doc !== null && (previewValue !== undefined || doc.preview !== undefined);
  const effectiveMode: ViewMode = mode === 'preview' && canPreview ? 'preview' : 'source';

  // Merge commit: the merged text becomes the draft — the editor stays
  // dirty and Save commits it to the record. Dismissing keeps the note
  // quiet until the browser diverges again.
  const handleResolveReview = useCallback(
    (text: string) => {
      setDraftText(text);
      setSaveError(null);
      dismissConflict('text');
      message.success('Merge applied to the draft — Save writes it to the record');
    },
    [dismissConflict, message],
  );

  const note =
    doc === null
      ? null
      : doc.truncated
        ? 'Truncated at the size cap — read-only.'
        : doc.editable
          ? null
          : 'Contains non-JSON types (Date, Map, binary, …) — shown as a read-only rendering.';
  const errorNote = saveError === null ? null : WRITE_FAILURE_NOTES[saveError];

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        {/* View modes live LEFT with the document identity; the action
            cluster (Save/Refresh/Reveal) stays right — different
            domains, different sides. */}
        <span className="dt-storagedoc-modes" role="tablist" aria-label="Record view mode">
          <button
            type="button"
            className="dt-storagedoc-mode"
            role="tab"
            aria-selected={effectiveMode === 'preview'}
            data-active={effectiveMode === 'preview'}
            disabled={!canPreview}
            title={canPreview ? 'Collapsible tree over the record value' : 'Preview needs a well-formed document'}
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
            title="Full-document source view"
            onClick={() => setMode('source')}
          >
            Source
          </button>
        </span>
        <span className="dt-storagedoc-crumb" title={`${database} › ${store} › ${tab.keyPreview}`}>
          {database} › {store} › <span className="dt-storagedoc-crumb-key">{tab.keyPreview}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        {doc?.editable === true && (
          <StorageDocSaveButton
            savable={dirty}
            saving={saving}
            dirty={dirty}
            saveHint="Write the edited value back to the record"
            isActiveDocument={isActiveDocument}
            onSave={() => void handleSave()}
          />
        )}
        {dirty ? (
          <ArmedIconButton
            icon={<ReloadOutlined />}
            title="Re-read the record"
            confirmTitle="Discards your edits — click again to refresh"
            ariaLabel="Refresh record"
            onConfirm={() => void fetchDocument()}
          />
        ) : (
          <button
            type="button"
            className="dt-storage-action"
            title="Re-read the record"
            aria-label="Refresh record"
            onClick={() => void fetchDocument()}
          >
            <ReloadOutlined />
          </button>
        )}
        <button
          type="button"
          className="dt-storagedoc-reveal"
          title={`Open ${database} › ${store} in the Storage tool window`}
          onClick={() => onRevealInStorage(database, store)}
        >
          Reveal in Storage
        </button>
      </div>
      {note !== null && <div className="dt-storagedoc-note">{note}</div>}
      {textConflict !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--conflict">
          The record changed in the browser while you were editing.
          <ConflictDiffChip
            theirs={clipConflictValue(textConflict.theirs)}
            base={clipConflictValue(textConflict.base)}
            local={clipConflictValue(sourceText)}
            onTakeTheirs={() => setDraftText(null)}
            onKeepMine={() => dismissConflict('text')}
          />
          <button type="button" className="dt-storagedoc-note-action" onClick={() => setReviewOpen(true)}>
            Open merge view
          </button>
        </div>
      )}
      {reviewOpen && textConflict !== null && (
        <Suspense fallback={null}>
          <EntityConflictDialog
            open
            savedText={textConflict.theirs}
            mineText={sourceText}
            baseText={textConflict.base}
            language="json"
            onResolveText={handleResolveReview}
            onClose={() => setReviewOpen(false)}
          />
        </Suspense>
      )}
      {doc?.gone === true && (
        <div className="dt-storagedoc-note">
          This record was deleted or changed shape in the browser — your unsaved edits are kept. Save writes them back.
          <button
            type="button"
            className="dt-storagedoc-note-action"
            onClick={() => {
              setDraftText(null);
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
          <strong>Record no longer available</strong>
          <span className="dt-empty-hero-sub">
            It may have been deleted, or the frame can’t be read right now — Refresh retries.
          </span>
        </div>
      ) : effectiveMode === 'preview' ? (
        <div
          className={`dt-storagedoc-preview${previewValue === undefined ? ' dt-storagedoc-preview--tree' : ''}`}
          aria-label="Record value tree"
        >
          {previewValue !== undefined ? (
            <JsonTree value={previewValue} defaultExpandedDepth={2} />
          ) : slot.preview !== undefined ? (
            <IdbPreviewTree node={slot.preview} />
          ) : null}
        </div>
      ) : (
        <div className="dt-storagedoc-source">
          <Suspense fallback={<Skeleton />}>
            <CodeViewer
              value={sourceText}
              language={slot.editable ? 'json' : 'javascript'}
              readOnly={!slot.editable}
              onChange={
                slot.editable
                  ? (next) => {
                      setDraftText(next);
                      setSaveError(null);
                    }
                  : undefined
              }
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdbRecordInspectorTab } from '../../data/inspector-tab';
import type { IdbRecordDocument, IdbRecordWriteFailure } from '../../data/storage/storage-inspector-host';
import { getStorageInspectorHost } from '../../data/storage/storage-inspector-host';
import Skeleton from '../detail/Skeleton';
import { JsonTree } from '../JsonTree';
import { ArmedIconButton } from './ArmedIconButton';
import { IdbPreviewTree } from './IdbPreviewTree';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));

type DocumentSlot = 'loading' | 'unavailable' | IdbRecordDocument;

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
}

export function IdbRecordEditorTab({ tab, onRevealInStorage, onDirtyChange, registerSave }: IdbRecordEditorTabProps) {
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [mode, setMode] = useState<ViewMode>('source');
  // The Source edit buffer; null ⇒ pristine (mirrors the document).
  const [draftText, setDraftText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<IdbRecordWriteFailure | null>(null);
  const fetchTokenRef = useRef(0);

  const { frameId, database, store, primaryKeyWire } = tab;

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
    setDraftText(null);
    setSaveError(null);
  }, [frameId, database, store, primaryKeyWire]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  const doc = slot !== 'loading' && slot !== 'unavailable' ? slot : null;
  const sourceText = draftText ?? doc?.text ?? '';
  const dirty = doc?.editable === true && draftText !== null && draftText !== doc.text;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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
    <div className="dt-idbdoc">
      <div className="dt-idbdoc-toolbar">
        <span className="dt-idbdoc-crumb" title={`${database} › ${store} › ${tab.keyPreview}`}>
          {database} › {store} › <span className="dt-idbdoc-crumb-key">{tab.keyPreview}</span>
        </span>
        <span className="dt-idbdoc-toolbar-spacer" />
        <span className="dt-idbdoc-modes" role="tablist" aria-label="Record view mode">
          <button
            type="button"
            className="dt-idbdoc-mode"
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
            className="dt-idbdoc-mode"
            role="tab"
            aria-selected={effectiveMode === 'source'}
            data-active={effectiveMode === 'source'}
            title="Full-document source view"
            onClick={() => setMode('source')}
          >
            Source
          </button>
        </span>
        {doc?.editable === true && (
          <button
            type="button"
            className="dt-idbdoc-save"
            disabled={!dirty || saving}
            title={dirty ? 'Write the edited value back to the record' : 'No changes to save'}
            onClick={() => void handleSave()}
          >
            Save
          </button>
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
          className="dt-idbdoc-reveal"
          title={`Open ${database} › ${store} in the Storage tool window`}
          onClick={() => onRevealInStorage(database, store)}
        >
          Reveal in Storage
        </button>
      </div>
      {note !== null && <div className="dt-idbdoc-note">{note}</div>}
      {errorNote !== null && (
        <div className="dt-idbdoc-note dt-idbdoc-note--error" role="alert">
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
        <div className="dt-idbdoc-preview" aria-label="Record value tree">
          {previewValue !== undefined ? (
            <JsonTree value={previewValue} defaultExpandedDepth={2} />
          ) : slot.preview !== undefined ? (
            <IdbPreviewTree node={slot.preview} />
          ) : null}
        </div>
      ) : (
        <div className="dt-idbdoc-source">
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

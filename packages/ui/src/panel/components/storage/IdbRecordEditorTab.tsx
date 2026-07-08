/**
 * IdbRecordEditorTab — an IndexedDB record opened as a full editor-tab
 * document. Fetches the record's serialized document one-shot over the
 * host seam (independent of the Storage tool window, which may be
 * hidden) and renders it full-width: Source is a Monaco view of the
 * exact JSON (or the read-only JSON-ish rendering for non-JSON values),
 * Preview is a collapsible tree over the parsed JSON. The breadcrumb's
 * "Reveal in Storage" links back to the originating store.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdbRecordInspectorTab } from '../../data/inspector-tab';
import type { IdbRecordDocument } from '../../data/storage/storage-inspector-host';
import { getStorageInspectorHost } from '../../data/storage/storage-inspector-host';
import CodeViewer from '../detail/CodeViewer';
import { JsonTree } from '../JsonTree';

type DocumentSlot = 'loading' | 'unavailable' | IdbRecordDocument;

type ViewMode = 'source' | 'preview';

interface IdbRecordEditorTabProps {
  tab: IdbRecordInspectorTab;
  onRevealInStorage: (database: string, store: string) => void;
}

export function IdbRecordEditorTab({ tab, onRevealInStorage }: IdbRecordEditorTabProps) {
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [mode, setMode] = useState<ViewMode>('source');
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
  }, [frameId, database, store, primaryKeyWire]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  const doc = slot !== 'loading' && slot !== 'unavailable' ? slot : null;

  // Preview parses the document — only exact-JSON documents qualify.
  const previewValue = useMemo<unknown>(() => {
    if (!doc?.editable) return undefined;
    try {
      return JSON.parse(doc.text) as unknown;
    } catch {
      return undefined;
    }
  }, [doc]);
  const canPreview = doc !== null && previewValue !== undefined;
  const effectiveMode: ViewMode = mode === 'preview' && canPreview ? 'preview' : 'source';

  const note =
    doc === null
      ? null
      : doc.truncated
        ? 'Truncated at the size cap — read-only.'
        : doc.editable
          ? null
          : 'Contains non-JSON types (Date, Map, binary, …) — shown as a read-only rendering.';

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
            title={canPreview ? 'Collapsible tree over the record value' : 'Preview needs an exact-JSON record value'}
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
        <button
          type="button"
          className="dt-storage-action"
          title="Re-read the record"
          aria-label="Refresh record"
          onClick={() => void fetchDocument()}
        >
          <ReloadOutlined />
        </button>
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
          <JsonTree value={previewValue} defaultExpandedDepth={2} />
        </div>
      ) : (
        <div className="dt-idbdoc-source">
          <CodeViewer value={slot.text} language={slot.editable ? 'json' : 'javascript'} />
        </div>
      )}
    </div>
  );
}

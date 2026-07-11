/**
 * CacheEntryEditorTab — a Cache Storage entry's stored response opened
 * as a full editor-tab document, read-only end to end (Cache Storage
 * has no write seam; delete is the only mutation). Fetches the document
 * one-shot over the host seam and renders the status line, the real
 * response-header pairs behind an always-on filter, and the body —
 * Monaco for textual content, an inline image for stored images, an
 * honest note for other binaries. Live-synced like the editable
 * documents, but with no draft to protect: an entry that changes
 * underneath silently adopts the fresh truth, and one that vanishes
 * falls to the unavailable state.
 */

import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { hostNavigation } from '@openheaders/core/navigation';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CacheEntryInspectorTab } from '../../data/inspector-tab';
import type { CacheEntryDocument } from '../../data/storage/storage-inspector-host';
import { getStorageInspectorHost } from '../../data/storage/storage-inspector-host';
import { useDocumentSync } from '../../data/storage/use-document-sync';
import Skeleton from '../detail/Skeleton';
import { formatSize } from '../traffic/formatters';
import { ArmedIconButton } from './ArmedIconButton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));

type DocumentSlot = 'loading' | 'unavailable' | CacheEntryDocument;

type BodyLanguage = 'json' | 'css' | 'javascript' | 'html' | 'plaintext';

/** Monaco language for a stored response's content-type (XML and SVG
 *  ride the HTML grammar — the closest highlighter CodeViewer carries). */
export function cacheBodyLanguage(contentType: string): BodyLanguage {
  if (/json/i.test(contentType)) return 'json';
  if (/javascript|ecmascript/i.test(contentType)) return 'javascript';
  if (/html|xml|svg/i.test(contentType)) return 'html';
  if (/css/i.test(contentType)) return 'css';
  return 'plaintext';
}

function documentsEqual(a: CacheEntryDocument, b: CacheEntryDocument): boolean {
  return (
    a.status === b.status &&
    a.statusText === b.statusText &&
    a.body === b.body &&
    a.bodyBase64 === b.bodyBase64 &&
    a.bodyLength === b.bodyLength &&
    a.bodyTruncated === b.bodyTruncated &&
    a.headers.length === b.headers.length &&
    a.headers.every((h, i) => h.name === b.headers[i].name && h.value === b.headers[i].value)
  );
}

interface CacheEntryEditorTabProps {
  tab: CacheEntryInspectorTab;
  onRevealInStorage: (cache: string) => void;
}

export function CacheEntryEditorTab({ tab, onRevealInStorage }: CacheEntryEditorTabProps) {
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [headerFilter, setHeaderFilter] = useState('');
  const [headersOpen, setHeadersOpen] = useState(true);
  const [bodyOpen, setBodyOpen] = useState(true);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const fetchTokenRef = useRef(0);

  const { frameId, cache, url, method } = tab;

  const doc = slot !== 'loading' && slot !== 'unavailable' ? slot : null;

  const fetchDocument = useCallback(async () => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    const token = ++fetchTokenRef.current;
    if (!host || tabId === null) {
      setSlot('unavailable');
      return;
    }
    setSlot('loading');
    const next = await host.readCacheEntryDocument(tabId, frameId, cache, url, method);
    if (token !== fetchTokenRef.current) return;
    setSlot(next ?? 'unavailable');
    setDeleteFailed(false);
  }, [frameId, cache, url, method]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  // Latest-document mirror for the silent sync path — it lands after an
  // await and must compare against the CURRENT document.
  const docRef = useRef(doc);
  docRef.current = doc;

  // Live catch-up: re-read on invalidation pushes and the poll tick.
  // Read-only means no draft to protect — a changed entry adopts the
  // fresh truth, a vanished one falls to unavailable. Never flips back
  // to loading.
  const syncDocument = useCallback(async () => {
    if (docRef.current === null) return;
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return;
    const token = ++fetchTokenRef.current;
    const next = await host.readCacheEntryDocument(tabId, frameId, cache, url, method);
    if (token !== fetchTokenRef.current) return;
    const current = docRef.current;
    if (current === null) return;
    if (next === null) {
      setSlot('unavailable');
      return;
    }
    if (!documentsEqual(current, next)) setSlot(next);
  }, [frameId, cache, url, method]);

  const runSync = useCallback(() => {
    void syncDocument();
  }, [syncDocument]);

  const subscribeInvalidations = useCallback((listener: () => void) => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return () => {};
    return host.subscribeStorageInvalidations(tabId, 'cachestorage', listener);
  }, []);

  useDocumentSync({
    enabled: doc !== null,
    sync: runSync,
    subscribe: subscribeInvalidations,
  });

  const handleDelete = useCallback(async () => {
    const host = getStorageInspectorHost();
    const tabId = hostNavigation.inspectedTabId();
    if (!host || tabId === null) return;
    const ok = await host.deleteCacheEntry(tabId, frameId, cache, url, method);
    if (ok) {
      setSlot('unavailable');
    } else {
      // A failed delete may mean the entry is already gone — re-check
      // through the read path instead of trusting the local outcome.
      setDeleteFailed(true);
      void syncDocument();
    }
  }, [frameId, cache, url, method, syncDocument]);

  const contentType = useMemo(
    () => doc?.headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? '',
    [doc],
  );

  const filteredHeaders = useMemo(() => {
    if (doc === null) return [];
    const needle = headerFilter.trim().toLowerCase();
    if (!needle) return doc.headers;
    return doc.headers.filter(
      (h) => h.name.toLowerCase().includes(needle) || h.value.toLowerCase().includes(needle),
    );
  }, [doc, headerFilter]);

  const isImage = doc?.bodyBase64 === true && /^image\//i.test(contentType) && doc.bodyTruncated !== true;

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        <span className="dt-storagedoc-crumb" title={`${cache} › ${url}`}>
          {cache} › <span className="dt-storagedoc-crumb-key">{url}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        <ArmedIconButton
          icon={<DeleteOutlined />}
          title="Delete this entry from the cache"
          confirmTitle="Deletes the stored response — click again to confirm"
          ariaLabel="Delete cache entry"
          onConfirm={() => void handleDelete()}
        />
        <button
          type="button"
          className="dt-storage-action"
          title="Re-read the stored response"
          aria-label="Refresh cache entry"
          onClick={() => void fetchDocument()}
        >
          <ReloadOutlined />
        </button>
        <button
          type="button"
          className="dt-storagedoc-reveal"
          title={`Open the ${cache} cache in the Storage tool window`}
          onClick={() => onRevealInStorage(cache)}
        >
          Reveal in Storage
        </button>
      </div>
      {deleteFailed && (
        <div className="dt-storagedoc-note dt-storagedoc-note--error" role="alert">
          Delete failed — the entry may already be gone.
        </div>
      )}
      {slot === 'loading' ? (
        <div className="dt-empty">Loading…</div>
      ) : slot === 'unavailable' ? (
        <div className="dt-empty-hero">
          <strong>Cache entry no longer available</strong>
          <span className="dt-empty-hero-sub">
            It may have been deleted, or the frame can’t be read right now — Refresh retries.
          </span>
        </div>
      ) : (
        <>
          <div className="dt-cachedoc-status">
            <span className="dt-cachedoc-status-line">
              {slot.status} {slot.statusText || ''}
            </span>
            <span className="dt-storage-meta">
              {tab.method} · {formatSize(slot.bodyLength)}
            </span>
          </div>
          {slot.bodyTruncated === true && (
            <div className="dt-storagedoc-note">
              Body truncated at the size cap — {formatSize(slot.bodyLength)} stored.
            </div>
          )}
          <details
            className="dt-section dt-cachedoc-section"
            open={headersOpen}
            onToggle={(e) => setHeadersOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>
              <span className="dt-cachedoc-summary-label">Response headers ({slot.headers.length})</span>
              <span className="dt-cachedoc-summary-controls" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  className="dt-filter-input"
                  placeholder="Filter headers"
                  value={headerFilter}
                  onChange={(e) => setHeaderFilter(e.target.value)}
                  aria-label="Filter response headers"
                />
              </span>
            </summary>
          </details>
          {headersOpen && (
            <div className="dt-cachedoc-headers-list">
              {filteredHeaders.length === 0 ? (
                <div className="dt-storage-meta">
                  {slot.headers.length === 0 ? 'No headers stored.' : 'No headers match your filter.'}
                </div>
              ) : (
                filteredHeaders.map((h, i) => (
                  <div className="dt-cachedoc-header-row" key={`${h.name}:${i}`}>
                    <span className="dt-cachedoc-header-name">{h.name}</span>
                    <span className="dt-cachedoc-header-value">{h.value}</span>
                  </div>
                ))
              )}
            </div>
          )}
          <details
            className={`dt-section dt-cachedoc-section${bodyOpen ? '' : ' dt-cachedoc-section--closed-body'}`}
            open={bodyOpen}
            onToggle={(e) => setBodyOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>
              <span className="dt-cachedoc-summary-label">Response body</span>
              <span className="dt-storage-meta">{formatSize(slot.bodyLength)}</span>
            </summary>
          </details>
          {bodyOpen &&
            (isImage ? (
              <div className="dt-cachedoc-image" aria-label="Stored image body">
                <img src={`data:${contentType};base64,${slot.body}`} alt={`Stored response body for ${url}`} />
              </div>
            ) : slot.bodyBase64 === true ? (
              <div className="dt-storagedoc-note">Binary body — {formatSize(slot.bodyLength)} stored.</div>
            ) : slot.body.length === 0 ? (
              <div className="dt-storagedoc-note">Empty body.</div>
            ) : (
              <div className="dt-storagedoc-source">
                <Suspense fallback={<Skeleton />}>
                  <CodeViewer value={slot.body} language={cacheBodyLanguage(contentType)} readOnly />
                </Suspense>
              </div>
            ))}
        </>
      )}
    </div>
  );
}

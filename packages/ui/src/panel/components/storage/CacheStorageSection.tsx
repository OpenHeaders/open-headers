/**
 * The Storage tool window's Cache Storage section. Two levels: the
 * scope's named caches, then an opened cache's paged entry grid —
 * request metadata (URL + method + a bounded request-headers preview)
 * plus the stored response's size and storage-time columns (metadata
 * only; bodies stay behind the lazy eye-preview). Either column renders
 * an em dash when the host couldn't derive it — size needs a
 * `content-length` header, time exists only on attached tabs. Deletes
 * are in scope: a whole
 * cache uses the two-step arm/confirm idiom (bulk destruction); an
 * entry is a single-click hover lane like the DOM grid's.
 *
 * `caches` is a secure-context API, so an http: scope legitimately has
 * no reach — that renders as an explanatory empty state, not an error.
 */

import { DeleteOutlined, EyeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import type { CacheEntryResponsePreview } from '../../data/storage/storage-inspector-host';
import type { CacheBrowserState } from '../../data/storage/use-cache-browser';
import { formatDateTime, formatSize } from '../traffic/formatters';
import { ArmedIconButton } from './ArmedIconButton';

interface CacheStorageSectionProps {
  cache: CacheBrowserState;
  filter: string;
  /** Open one entry's stored response as an editor-tab document. */
  onOpenEntry?: (url: string, method: string) => void;
  /** Is this entry the ACTIVE editor tab? Exactly that row highlights. */
  isEntryActive?: (url: string, method: string) => boolean;
}

export function CacheStorageSection({ cache, filter, onOpenEntry, isEntryActive }: CacheStorageSectionProps) {
  if (cache.selectedCache !== null) {
    return <EntriesView cache={cache} filter={filter} onOpenEntry={onOpenEntry} isEntryActive={isEntryActive} />;
  }
  if (cache.caches === null) {
    return cache.loading ? (
      <div className="dt-empty">Loading…</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>Cache Storage can’t be read</strong>
        <span className="dt-empty-hero-sub">
          The API only exists in secure contexts (https) — or this frame can’t be read right now.
        </span>
      </div>
    );
  }
  if (cache.caches.length === 0) {
    return <div className="dt-empty">No caches for this origin.</div>;
  }

  const needle = filter.trim().toLowerCase();
  const caches = needle ? cache.caches.filter((c) => c.name.toLowerCase().includes(needle)) : cache.caches;
  if (caches.length === 0) {
    return <div className="dt-empty">No caches match your filter.</div>;
  }

  return (
    <div className="dt-storage-cache-list">
      {caches.map((c) => (
        <div key={c.name} className="dt-storage-cache-row">
          <button
            type="button"
            className="dt-storage-cache-open"
            onClick={() => cache.selectCache(c.name)}
            title={`Open the ${c.name} cache`}
          >
            {c.name}
          </button>
          <ArmedIconButton
            icon={<DeleteOutlined />}
            title={`Delete the ${c.name} cache`}
            confirmTitle={`Deletes ${c.name} and every entry in it`}
            ariaLabel={`Delete cache ${c.name}`}
            onConfirm={() => cache.deleteCache(c.name)}
          />
        </div>
      ))}
    </div>
  );
}

type PreviewSlot = 'loading' | 'failed' | CacheEntryResponsePreview;

function EntriesView({ cache, filter, onOpenEntry, isEntryActive }: CacheStorageSectionProps) {
  // The expanded entry's stored-response preview — a lazy one-shot fetch
  // held here, keyed on the entry's url+method; never polled state. The
  // ref mirrors the key so a late fetch for a since-collapsed row drops.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSlot | null>(null);
  const expandedRef = useRef<string | null>(null);

  const name = cache.selectedCache;
  const { readEntryResponse } = cache;

  // Cache or page change → the expanded row is gone; drop the preview.
  useEffect(() => {
    expandedRef.current = null;
    setExpandedKey(null);
    setPreview(null);
  }, [name, cache.page]);

  if (name === null) return null;

  const togglePreview = (url: string, method: string) => {
    const key = `${url}\n${method}`;
    if (expandedKey === key) {
      expandedRef.current = null;
      setExpandedKey(null);
      setPreview(null);
      return;
    }
    expandedRef.current = key;
    setExpandedKey(key);
    setPreview('loading');
    void readEntryResponse(url, method).then((result) => {
      if (expandedRef.current === key) setPreview(result ?? 'failed');
    });
  };

  const pageData = cache.entriesPage;
  const needle = filter.trim().toLowerCase();
  const entries = pageData
    ? needle
      ? pageData.entries.filter(
          (e) =>
            e.url.toLowerCase().includes(needle) ||
            e.method.toLowerCase().includes(needle) ||
            (e.headersPreview?.toLowerCase().includes(needle) ?? false),
        )
      : pageData.entries
    : [];

  return (
    <>
      <div className="dt-storage-crumb">
        <button
          type="button"
          className="dt-storage-action"
          title="Back to caches"
          aria-label="Back to caches"
          onClick={cache.closeCache}
        >
          <LeftOutlined />
        </button>
        <span className="dt-storage-crumb-path" title={name}>
          {name}
        </span>
        <span className="dt-storage-pager">
          <button
            type="button"
            className="dt-storage-action"
            title="Previous page"
            aria-label="Previous page"
            disabled={cache.page === 0}
            onClick={() => cache.setPage(cache.page - 1)}
          >
            <LeftOutlined />
          </button>
          <span className="dt-storage-meta">page {cache.page + 1}</span>
          <button
            type="button"
            className="dt-storage-action"
            title="Next page"
            aria-label="Next page"
            disabled={!pageData?.truncated}
            onClick={() => cache.setPage(cache.page + 1)}
          >
            <RightOutlined />
          </button>
        </span>
      </div>
      {pageData === null ? (
        <div className="dt-empty">Loading…</div>
      ) : pageData.entries.length === 0 ? (
        <div className="dt-empty">
          No entries in {name}
          {cache.page > 0 ? ' on this page' : ''}.
        </div>
      ) : entries.length === 0 ? (
        <div className="dt-empty">No entries match your filter.</div>
      ) : (
        <div className="dt-storage-grid dt-storage-grid--caches" role="table" aria-label="Cache entries">
          <div className="dt-storage-grid-header" role="row">
            <span role="columnheader">Request</span>
            <span role="columnheader">Method</span>
            <span role="columnheader">Size</span>
            <span role="columnheader">Time</span>
          </div>
          {entries.map((e, i) => {
            const expanded = expandedKey === `${e.url}\n${e.method}`;
            return (
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance
              <div
                className={`dt-storage-row${isEntryActive?.(e.url, e.method) ? ' dt-storage-row--active' : ''}`}
                role="row"
                key={`${cache.page}:${i}:${e.url}`}
                onClick={() => onOpenEntry?.(e.url, e.method)}
              >
                <span
                  className="dt-storage-key"
                  role="cell"
                  title={e.headersPreview ? `${e.url}\n${e.headersPreview}` : e.url}
                >
                  {e.url}
                </span>
                <span className="dt-storage-value" role="cell">
                  {e.method}
                </span>
                <span className="dt-storage-value" role="cell">
                  {formatSize(e.contentLength) || '—'}
                </span>
                <span className="dt-storage-value" role="cell">
                  {formatDateTime(e.responseTimeMs) || '—'}
                </span>
                <span className="dt-storage-row-actions">
                  <button
                    type="button"
                    className="dt-storage-action"
                    title={expanded ? 'Hide the stored response' : 'Preview the stored response'}
                    aria-label={`Preview response for ${e.url}`}
                    aria-expanded={expanded}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      togglePreview(e.url, e.method);
                    }}
                  >
                    <EyeOutlined />
                  </button>
                  <button
                    type="button"
                    className="dt-storage-action"
                    title="Delete this entry"
                    aria-label={`Delete entry ${e.url}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      cache.deleteEntry(e.url, e.method);
                    }}
                  >
                    <DeleteOutlined />
                  </button>
                </span>
                {expanded && preview !== null ? <ResponsePreviewStrip preview={preview} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * The expanded entry's stored response — status line, the bounded
 * response-headers join, and the byte-capped body slice. A binary body
 * arrives base64 and renders a note instead of the encoded noise.
 */
function ResponsePreviewStrip({ preview }: { preview: PreviewSlot }) {
  // The strip lives inside the row, whose click opens the entry as a
  // document — interacting with the preview (selecting text) must not.
  const swallow = (ev: ReactMouseEvent) => ev.stopPropagation();
  if (preview === 'loading') {
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: swallows the row's open-click
    return (
      <div className="dt-storage-response-strip dt-storage-response-note" onClick={swallow}>
        Loading…
      </div>
    );
  }
  if (preview === 'failed') {
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: swallows the row's open-click
    return (
      <div className="dt-storage-response-strip dt-storage-response-note" onClick={swallow}>
        The stored response can’t be read — the entry may be gone.
      </div>
    );
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: swallows the row's open-click
    <div className="dt-storage-response-strip" onClick={swallow}>
      <div className="dt-storage-response-status">
        {preview.status} {preview.statusText || ''} · {formatSize(preview.bodyLength)}
        {preview.bodyTruncated ? ' (preview truncated)' : ''}
      </div>
      {preview.headersPreview ? <div className="dt-storage-response-headers">{preview.headersPreview}</div> : null}
      {preview.bodyBase64 ? (
        <div className="dt-storage-response-note">Binary body — {formatSize(preview.bodyLength)} stored.</div>
      ) : preview.bodyPreview.length > 0 ? (
        <pre className="dt-storage-response-body">{preview.bodyPreview}</pre>
      ) : (
        <div className="dt-storage-response-note">Empty body.</div>
      )}
    </div>
  );
}

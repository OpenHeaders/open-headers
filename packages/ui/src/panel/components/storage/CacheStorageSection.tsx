/**
 * The Storage tool window's Cache Storage section. Two levels: the
 * scope's named caches, then an opened cache's paged entry grid —
 * request metadata (URL + method + a bounded request-headers preview)
 * plus the stored response's size and storage-time columns (metadata
 * only; the body lives in the entry's editor tab, opened by the row
 * click). Either column renders an em dash when the host couldn't
 * derive it — size needs a `content-length` header, time exists only on
 * attached tabs. Deletes are in scope, all through the two-step
 * arm/confirm idiom — a stored response isn't recoverable.
 *
 * `caches` is a secure-context API, so an http: scope legitimately has
 * no reach — that renders as an explanatory empty state, not an error.
 */

import { DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { CacheBrowserState } from '../../data/storage/use-cache-browser';
import { formatDateTime, formatSize } from '../traffic/formatters';
import { ArmedIconButton } from './ArmedIconButton';
import { CacheEntryColumnInfo } from './CacheEntryColumnInfo';
import { StorageColumnHeaderCell } from './StorageColumnHeaderCell';

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

function EntriesView({ cache, filter, onOpenEntry, isEntryActive }: CacheStorageSectionProps) {
  const name = cache.selectedCache;
  if (name === null) return null;

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
            <StorageColumnHeaderCell label="Request" info={<CacheEntryColumnInfo infoKey="request" />} />
            <StorageColumnHeaderCell label="Method" info={<CacheEntryColumnInfo infoKey="method" />} />
            <StorageColumnHeaderCell label="Size" info={<CacheEntryColumnInfo infoKey="size" />} />
            <StorageColumnHeaderCell label="Time" info={<CacheEntryColumnInfo infoKey="time" />} />
          </div>
          {entries.map((e, i) => (
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
              {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: keeps the armed delete's clicks off the row's open gesture */}
              <span className="dt-storage-row-actions" onClick={(ev) => ev.stopPropagation()}>
                <ArmedIconButton
                  icon={<DeleteOutlined />}
                  title="Delete this entry"
                  confirmTitle="Deletes the stored response — click again to confirm"
                  ariaLabel={`Delete entry ${e.url}`}
                  onConfirm={() => cache.deleteEntry(e.url, e.method)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

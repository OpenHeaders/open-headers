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
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { useMemo } from 'react';
import { cacheEntryMatches, cacheMatches } from '../../data/storage/storage-filter';
import type { CacheBrowserState } from '../../data/storage/use-cache-browser';
import type { TextPredicate } from '../../data/text-match';
import { formatDateTime, formatSize } from '../traffic/formatters';
import { walkListSelection } from '../walk-list-selection';
import { ArmedIconButton } from './ArmedIconButton';
import { CacheEntryColumnInfo } from './CacheEntryColumnInfo';
import { StorageColumnHeaderCell } from './StorageColumnHeaderCell';

interface CacheStorageSectionProps {
  cache: CacheBrowserState;
  filter: TextPredicate;
  /** Open one entry's stored response as an editor-tab document. */
  onOpenEntry?: (url: string, method: string) => void;
  /** Is this entry the ACTIVE editor tab? Exactly that row highlights. */
  isEntryActive?: (url: string, method: string) => boolean;
}

// Row copy resolved once per locale — the cache/entry loops read this
// object, never `t()` (per-row law). Names and URLs ride as raw holes.
function buildCacheRowLabels(t: Translate) {
  return {
    openTitle: (name: string) => t('panel.storage.cache.openTitle', { name }),
    deleteTitle: (name: string) => t('panel.storage.cache.deleteTitle', { name }),
    deleteConfirmTitle: (name: string) => t('panel.storage.cache.deleteConfirmTitle', { name }),
    deleteAria: (name: string) => t('panel.storage.cache.deleteAria', { name }),
    deleteEntryTitle: t('panel.storage.cache.deleteEntryTitle'),
    deleteEntryConfirmTitle: t('panel.storage.cache.deleteEntryConfirmTitle'),
    deleteEntryAria: (url: string) => t('panel.storage.cache.deleteEntryAria', { url }),
  };
}

export function CacheStorageSection({ cache, filter, onOpenEntry, isEntryActive }: CacheStorageSectionProps) {
  const t = useT();
  const rowLabels = useMemo(() => buildCacheRowLabels(t), [t]);
  if (cache.selectedCache !== null) {
    return <EntriesView cache={cache} filter={filter} onOpenEntry={onOpenEntry} isEntryActive={isEntryActive} />;
  }
  if (cache.caches === null) {
    return cache.loading ? (
      <div className="dt-empty">{t('panel.storage.empty.loading')}</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>{t('panel.storage.cache.cantReadTitle')}</strong>
        <span className="dt-empty-hero-sub">{t('panel.storage.cache.cantReadSub')}</span>
      </div>
    );
  }
  if (cache.caches.length === 0) {
    return <div className="dt-empty">{t('panel.storage.cache.noCaches')}</div>;
  }

  const caches = filter.empty ? cache.caches : cache.caches.filter((c) => cacheMatches(c, filter));
  if (caches.length === 0) {
    return <div className="dt-empty">{t('panel.storage.cache.noCachesMatch')}</div>;
  }

  return (
    <div className="dt-storage-cache-list">
      {caches.map((c) => (
        <div key={c.name} className="dt-storage-cache-row">
          <button
            type="button"
            className="dt-storage-cache-open"
            onClick={() => cache.selectCache(c.name)}
            title={rowLabels.openTitle(c.name)}
          >
            {c.name}
          </button>
          <ArmedIconButton
            icon={<DeleteOutlined />}
            title={rowLabels.deleteTitle(c.name)}
            confirmTitle={rowLabels.deleteConfirmTitle(c.name)}
            ariaLabel={rowLabels.deleteAria(c.name)}
            onConfirm={() => cache.deleteCache(c.name)}
          />
        </div>
      ))}
    </div>
  );
}

function EntriesView({ cache, filter, onOpenEntry, isEntryActive }: CacheStorageSectionProps) {
  const t = useT();
  const rowLabels = useMemo(() => buildCacheRowLabels(t), [t]);
  const name = cache.selectedCache;
  if (name === null) return null;

  const pageData = cache.entriesPage;
  const entries = pageData
    ? filter.empty
      ? pageData.entries
      : pageData.entries.filter((e) => cacheEntryMatches(e, filter))
    : [];

  // Keyboard row navigation — StorageGrid's selection model on a
  // read-only, PAGINATED grid: no grid-local selection state; an arrow
  // move opens the entry document like a click (`onOpenEntry`) and the
  // highlight follows the active-editor-tab derivation
  // (`isEntryActive`). The walk is page-local by design — an active
  // document from another page reads as no selection here, so the
  // arrows restart at this page's ends; the pager buttons stay the page
  // gesture (`pageRows: null` keeps the Page keys unhandled too). Enter
  // has no gesture: the rows are read-only (no inline edit to twin) and
  // the document it could open is already open — the arrow move that
  // made the row active opened it. Stands down for presses on
  // interactive children (the armed delete lane).
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea') !== null) return;
    if (entries.length === 0) return;
    const pos = isEntryActive ? entries.findIndex((en) => isEntryActive(en.url, en.method)) : -1;
    const next = walkListSelection(entries.length, pos, e.key, null);
    if (next === null) return;
    e.preventDefault();
    if (next !== pos) onOpenEntry?.(entries[next].url, entries[next].method);
    e.currentTarget.querySelector(`.dt-storage-row[data-entry-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <>
      <div className="dt-storage-crumb">
        <button
          type="button"
          className="dt-storage-action"
          title={t('panel.storage.cache.backTitle')}
          aria-label={t('panel.storage.cache.backTitle')}
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
            title={t('panel.storage.pager.prevTitle')}
            aria-label={t('panel.storage.pager.prevTitle')}
            disabled={cache.page === 0}
            onClick={() => cache.setPage(cache.page - 1)}
          >
            <LeftOutlined />
          </button>
          <span className="dt-storage-meta">{t('panel.storage.pager.page', { page: cache.page + 1 })}</span>
          <button
            type="button"
            className="dt-storage-action"
            title={t('panel.storage.pager.nextTitle')}
            aria-label={t('panel.storage.pager.nextTitle')}
            disabled={!pageData?.truncated}
            onClick={() => cache.setPage(cache.page + 1)}
          >
            <RightOutlined />
          </button>
        </span>
      </div>
      {pageData === null ? (
        <div className="dt-empty">{t('panel.storage.empty.loading')}</div>
      ) : pageData.entries.length === 0 ? (
        <div className="dt-empty">
          {cache.page > 0
            ? t('panel.storage.cache.noEntriesPage', { name })
            : t('panel.storage.cache.noEntries', { name })}
        </div>
      ) : entries.length === 0 ? (
        <div className="dt-empty">{t('panel.storage.cache.noEntriesMatch')}</div>
      ) : (
        // role="grid" + focusable container, StorageGrid's anatomy: the
        // rows are plain divs, so a row click focuses the grid as the
        // nearest focusable ancestor; the active-row highlight is the
        // focus affordance, no ring on the box.
        <div
          className="dt-storage-grid dt-storage-grid--caches"
          role="grid"
          aria-label={t('panel.storage.cache.gridAria')}
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
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
              aria-selected={isEntryActive?.(e.url, e.method) ?? false}
              data-entry-index={i}
              key={`${cache.page}:${i}:${e.url}`}
              onClick={() => onOpenEntry?.(e.url, e.method)}
            >
              <span
                className="dt-storage-key"
                role="gridcell"
                title={e.headersPreview ? `${e.url}\n${e.headersPreview}` : e.url}
              >
                {e.url}
              </span>
              <span className="dt-storage-value" role="gridcell">
                {e.method}
              </span>
              <span className="dt-storage-value" role="gridcell">
                {formatSize(e.contentLength) || '—'}
              </span>
              <span className="dt-storage-value" role="gridcell">
                {formatDateTime(e.responseTimeMs) || '—'}
              </span>
              {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: keeps the armed delete's clicks off the row's open gesture */}
              <span className="dt-storage-row-actions" onClick={(ev) => ev.stopPropagation()}>
                <ArmedIconButton
                  icon={<DeleteOutlined />}
                  title={rowLabels.deleteEntryTitle}
                  confirmTitle={rowLabels.deleteEntryConfirmTitle}
                  ariaLabel={rowLabels.deleteEntryAria(e.url)}
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

/**
 * The Storage tool window's IndexedDB section. Two levels: the scope's
 * databases with their object stores, then a selected store's
 * cursor-paged records grid of in-page-serialized previews (StorageGrid
 * idiom). Deletes are in scope — record (rows carrying a lossless wire
 * key), store clear, whole database — record EDITING stays out of v1.
 * Bulk gestures (clear / database delete) use the two-step arm/confirm
 * idiom; a record delete is single-click like the DOM grid's.
 */

import { ClearOutlined, DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { IdbDatabase } from '../../data/storage/storage-inspector-host';
import type { IdbBrowserState } from '../../data/storage/use-idb-browser';

interface IndexedDbSectionProps {
  idb: IdbBrowserState;
  filter: string;
}

function storeMeta(store: IdbDatabase['objectStores'][number]): string {
  const key = store.keyPath ? `key: ${store.keyPath}` : store.autoIncrement ? 'auto-increment keys' : 'out-of-line keys';
  return store.indexNames.length > 0 ? `${key} · ${store.indexNames.length} ${store.indexNames.length === 1 ? 'index' : 'indexes'}` : key;
}

/** Two-step icon button — first click arms (red), second commits. */
function ArmedIconButton({
  icon,
  title,
  confirmTitle,
  ariaLabel,
  onConfirm,
}: {
  icon: React.ReactNode;
  title: string;
  confirmTitle: string;
  ariaLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`dt-storage-action${armed ? ' dt-storage-action--armed' : ''}`}
      title={armed ? confirmTitle : title}
      aria-label={armed ? `${ariaLabel} — click again to confirm` : ariaLabel}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
    >
      {icon}
    </button>
  );
}

export function IndexedDbSection({ idb, filter }: IndexedDbSectionProps) {
  if (idb.selection) {
    return <RecordsView idb={idb} filter={filter} />;
  }
  if (idb.databases === null) {
    return idb.loading ? (
      <div className="dt-empty">Loading…</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>IndexedDB can’t be read</strong>
        <span className="dt-empty-hero-sub">
          This frame doesn’t expose its databases right now — it may have navigated away.
        </span>
      </div>
    );
  }
  if (idb.databases.length === 0) {
    return <div className="dt-empty">No IndexedDB databases for this origin.</div>;
  }

  const needle = filter.trim().toLowerCase();
  return (
    <div className="dt-storage-idb-list">
      {idb.databases.map((db) => {
        const stores = needle
          ? db.objectStores.filter(
              (s) => s.name.toLowerCase().includes(needle) || db.name.toLowerCase().includes(needle),
            )
          : db.objectStores;
        if (needle && stores.length === 0) return null;
        return (
          <div key={db.name} className="dt-storage-idb-db">
            <div className="dt-storage-idb-db-header">
              <span className="dt-storage-idb-db-name" title={db.name}>
                {db.name}
              </span>
              <span className="dt-storage-idb-meta">
                v{db.version} · {db.objectStores.length} {db.objectStores.length === 1 ? 'store' : 'stores'}
              </span>
              <ArmedIconButton
                icon={<DeleteOutlined />}
                title={`Delete the ${db.name} database`}
                confirmTitle={`Deletes ${db.name} and every store in it — a page holding it open blocks the delete`}
                ariaLabel={`Delete database ${db.name}`}
                onConfirm={() => idb.deleteDatabase(db.name)}
              />
            </div>
            {stores.map((s) => (
              <div key={s.name} className="dt-storage-idb-store-row">
                <button
                  type="button"
                  className="dt-storage-idb-store"
                  onClick={() => idb.selectStore(db.name, s.name)}
                  title={`Open ${db.name} › ${s.name}`}
                >
                  {s.name}
                  <span className="dt-storage-idb-meta">{storeMeta(s)}</span>
                </button>
                <ArmedIconButton
                  icon={<ClearOutlined />}
                  title={`Clear all records in ${s.name}`}
                  confirmTitle={`Deletes every record in ${db.name} › ${s.name}`}
                  ariaLabel={`Clear store ${s.name}`}
                  onConfirm={() => idb.clearStore(db.name, s.name)}
                />
              </div>
            ))}
            {db.objectStores.length === 0 && <div className="dt-storage-idb-meta dt-storage-idb-empty">no object stores</div>}
          </div>
        );
      })}
    </div>
  );
}

function RecordsView({ idb, filter }: IndexedDbSectionProps) {
  const selection = idb.selection;
  if (!selection) return null;
  const pageData = idb.recordsPage;
  const needle = filter.trim().toLowerCase();
  const records = pageData
    ? needle
      ? pageData.records.filter(
          (r) => r.keyPreview.toLowerCase().includes(needle) || r.valuePreview.toLowerCase().includes(needle),
        )
      : pageData.records
    : [];

  return (
    <>
      <div className="dt-storage-idb-crumb">
        <button type="button" className="dt-storage-action" title="Back to databases" aria-label="Back to databases" onClick={idb.closeStore}>
          <LeftOutlined />
        </button>
        <span className="dt-storage-idb-crumb-path" title={`${selection.database} › ${selection.store}`}>
          {selection.database} › {selection.store}
        </span>
        <span className="dt-storage-idb-pager">
          <button
            type="button"
            className="dt-storage-action"
            title="Previous page"
            aria-label="Previous page"
            disabled={idb.page === 0}
            onClick={() => idb.setPage(idb.page - 1)}
          >
            <LeftOutlined />
          </button>
          <span className="dt-storage-idb-meta">page {idb.page + 1}</span>
          <button
            type="button"
            className="dt-storage-action"
            title="Next page"
            aria-label="Next page"
            disabled={!pageData?.truncated}
            onClick={() => idb.setPage(idb.page + 1)}
          >
            <RightOutlined />
          </button>
        </span>
      </div>
      {pageData === null ? (
        <div className="dt-empty">Loading…</div>
      ) : pageData.records.length === 0 ? (
        <div className="dt-empty">
          No records in {selection.store}
          {idb.page > 0 ? ' on this page' : ''}.
        </div>
      ) : records.length === 0 ? (
        <div className="dt-empty">No records match your filter.</div>
      ) : (
        <div className="dt-storage-grid" role="table" aria-label="IndexedDB records">
          <div className="dt-storage-grid-header" role="row">
            <span role="columnheader">Key</span>
            <span role="columnheader">Value</span>
          </div>
          {records.map((r, i) => {
            const wireKey = r.primaryKeyWire;
            return (
              <div className="dt-storage-row" role="row" key={`${idb.page}:${i}:${r.primaryKeyPreview}`}>
                <span className="dt-storage-key" role="cell" title={`Key: ${r.keyPreview}\nPrimary key: ${r.primaryKeyPreview}`}>
                  {r.keyPreview}
                </span>
                <span className="dt-storage-value" role="cell" title={r.valuePreview}>
                  {r.valuePreview}
                </span>
                {wireKey !== undefined && (
                  <span className="dt-storage-row-actions">
                    <button
                      type="button"
                      className="dt-storage-action"
                      title="Delete this record"
                      aria-label={`Delete record ${r.primaryKeyPreview}`}
                      onClick={() => idb.deleteRecord(wireKey)}
                    >
                      <DeleteOutlined />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

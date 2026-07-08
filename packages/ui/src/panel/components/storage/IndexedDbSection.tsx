/**
 * The Storage tool window's IndexedDB section. Two levels: the scope's
 * databases with their object stores, then a selected store's
 * cursor-paged records grid of in-page-serialized previews (StorageGrid
 * idiom), readable through the store's primary cursor or any of its
 * indexes. Clicking a record opens it as a full editor-tab document —
 * the same gesture that opens a request from the Network list; the
 * narrow grid keeps only the one-line previews. Deletes are in scope —
 * record (rows carrying a lossless wire key), store clear, whole
 * database — record EDITING stays out of v1. Bulk gestures (clear /
 * database delete) use the two-step arm/confirm idiom; a record delete
 * is single-click like the DOM grid's.
 */

import { ClearOutlined, DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { IdbDatabase, IdbRecord } from '../../data/storage/storage-inspector-host';
import type { IdbBrowserState } from '../../data/storage/use-idb-browser';
import { ArmedIconButton } from './ArmedIconButton';

/** What an editor-tab open needs from a record row (plus the scope's
 *  frame, which the panel shell adds). */
export interface OpenIdbRecordRequest {
  database: string;
  store: string;
  primaryKeyWire: string;
  keyPreview: string;
}

interface IndexedDbSectionProps {
  idb: IdbBrowserState;
  filter: string;
  onOpenRecord: (request: OpenIdbRecordRequest) => void;
}

function storeMeta(store: IdbDatabase['objectStores'][number]): string {
  const key = store.keyPath ? `key: ${store.keyPath}` : store.autoIncrement ? 'auto-increment keys' : 'out-of-line keys';
  return store.indexNames.length > 0 ? `${key} · ${store.indexNames.length} ${store.indexNames.length === 1 ? 'index' : 'indexes'}` : key;
}

export function IndexedDbSection({ idb, filter, onOpenRecord }: IndexedDbSectionProps) {
  if (idb.selection) {
    return <RecordsView idb={idb} filter={filter} onOpenRecord={onOpenRecord} />;
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
              <span className="dt-storage-meta">
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
                  <span className="dt-storage-meta">{storeMeta(s)}</span>
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
            {db.objectStores.length === 0 && <div className="dt-storage-meta dt-storage-idb-empty">no object stores</div>}
          </div>
        );
      })}
    </div>
  );
}

function RecordsView({ idb, filter, onOpenRecord }: IndexedDbSectionProps) {
  const selection = idb.selection;
  if (!selection) return null;
  const storeShape = idb.databases
    ?.find((d) => d.name === selection.database)
    ?.objectStores.find((s) => s.name === selection.store);
  const pageData = idb.recordsPage;

  const openRecord = (r: IdbRecord) => {
    if (r.primaryKeyWire === undefined) return;
    onOpenRecord({
      database: selection.database,
      store: selection.store,
      primaryKeyWire: r.primaryKeyWire,
      keyPreview: r.primaryKeyPreview,
    });
  };
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
      <div className="dt-storage-crumb">
        <button type="button" className="dt-storage-action" title="Back to databases" aria-label="Back to databases" onClick={idb.closeStore}>
          <LeftOutlined />
        </button>
        <span className="dt-storage-crumb-path" title={`${selection.database} › ${selection.store}`}>
          {selection.database} › {selection.store}
        </span>
        {storeShape !== undefined && storeShape.indexNames.length > 0 && (
          <select
            className="dt-storage-scope-select dt-storage-idb-index-select"
            value={idb.index ?? ''}
            onChange={(e) => idb.setIndex(e.target.value === '' ? null : e.target.value)}
            aria-label="Record cursor"
            title="Read the store through one of its indexes — the key column becomes the index key"
          >
            <option value="">primary key</option>
            {storeShape.indexNames.map((n) => (
              <option key={n} value={n}>
                index: {n}
              </option>
            ))}
          </select>
        )}
        <span className="dt-storage-pager">
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
          <span className="dt-storage-meta">page {idb.page + 1}</span>
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
        <div className="dt-storage-grid dt-storage-grid--idb" role="table" aria-label="IndexedDB records">
          <div className="dt-storage-grid-header" role="row">
            <span role="columnheader">Key</span>
            <span role="columnheader">Value</span>
          </div>
          {records.map((r, i) => {
            const wireKey = r.primaryKeyWire;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: row carries its own key handler
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance
              <div
                className="dt-storage-row"
                role="row"
                key={`${idb.page}:${i}:${r.primaryKeyPreview}`}
                tabIndex={wireKey !== undefined ? 0 : undefined}
                title={wireKey !== undefined ? 'Open this record in the editor' : undefined}
                onClick={() => openRecord(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openRecord(r);
                }}
              >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        idb.deleteRecord(wireKey);
                      }}
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

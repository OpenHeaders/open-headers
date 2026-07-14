/**
 * The Storage tool window's IndexedDB section. Two levels: the scope's
 * databases with their object stores, then a selected store's
 * cursor-paged records grid of in-page-serialized previews (StorageGrid
 * idiom), readable through the store's primary cursor or any of its
 * indexes. Clicking a record opens it as a full editor-tab document —
 * the same gesture that opens a request from the Network list; the
 * narrow grid keeps only the one-line previews, and the row of the
 * ACTIVE editor tab's record renders highlighted. Deletes are in scope — record
 * (rows carrying a lossless wire key), store clear, whole database.
 * Bulk gestures (clear / database delete) use the two-step arm/confirm
 * idiom; a record delete is single-click like the DOM grid's.
 */

import { ClearOutlined, DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type React from 'react';
import { idbRecordMatches, idbStoreMatches } from '../../data/storage/storage-filter';
import type { IdbDatabase, IdbRecord } from '../../data/storage/storage-inspector-host';
import type { IdbBrowserState } from '../../data/storage/use-idb-browser';
import type { TextPredicate } from '../../data/text-match';
import { walkListSelection } from '../walk-list-selection';
import { ArmedIconButton } from './ArmedIconButton';
import { IdbRecordColumnInfo } from './IdbRecordColumnInfo';
import { StorageColumnHeaderCell } from './StorageColumnHeaderCell';
import { DatabaseIcon, TableIcon } from './StorageNavIcons';

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
  filter: TextPredicate;
  onOpenRecord: (request: OpenIdbRecordRequest) => void;
  /** Whether a record is the ACTIVE editor tab's document — exactly
   *  that row renders highlighted, tracking tab switches. */
  isRecordActive?: (database: string, store: string, primaryKeyWire: string) => boolean;
}

function storeMeta(store: IdbDatabase['objectStores'][number]): string {
  const key = store.keyPath ? `key: ${store.keyPath}` : store.autoIncrement ? 'auto-increment keys' : 'out-of-line keys';
  return store.indexNames.length > 0 ? `${key} · ${store.indexNames.length} ${store.indexNames.length === 1 ? 'index' : 'indexes'}` : key;
}

export function IndexedDbSection({ idb, filter, onOpenRecord, isRecordActive }: IndexedDbSectionProps) {
  if (idb.selection) {
    return <RecordsView idb={idb} filter={filter} onOpenRecord={onOpenRecord} isRecordActive={isRecordActive} />;
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

  return (
    <div className="dt-storage-idb-list">
      {idb.databases.map((db) => {
        const stores = filter.empty ? db.objectStores : db.objectStores.filter((s) => idbStoreMatches(db, s, filter));
        if (!filter.empty && stores.length === 0) return null;
        return (
          <div key={db.name} className="dt-storage-idb-db">
            <div className="dt-storage-idb-db-header">
              <span className="dt-storage-idb-icon">
                <DatabaseIcon />
              </span>
              <span className="dt-storage-idb-db-name" title={db.name}>
                {db.name}
              </span>
              <span className="dt-storage-idb-version" title={`Database version ${db.version}`}>
                v{db.version}
              </span>
              <span className="dt-storage-meta">
                {db.objectStores.length} {db.objectStores.length === 1 ? 'store' : 'stores'}
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
                  <span className="dt-storage-idb-icon">
                    <TableIcon />
                  </span>
                  {s.name}
                  <span className="dt-storage-meta">{storeMeta(s)}</span>
                </button>
                <ArmedIconButton
                  icon={<ClearOutlined />}
                  title={`Clear all records in ${s.name}`}
                  confirmTitle={`Deletes every record in ${db.name} › ${s.name}`}
                  confirmLabel="Confirm clear?"
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

function RecordsView({ idb, filter, onOpenRecord, isRecordActive }: IndexedDbSectionProps) {
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
  const records = pageData
    ? filter.empty
      ? pageData.records
      : pageData.records.filter((r) => idbRecordMatches(r, filter))
    : [];

  const recordActive = (r: IdbRecord): boolean =>
    r.primaryKeyWire !== undefined && isRecordActive !== undefined
      ? isRecordActive(selection.database, selection.store, r.primaryKeyWire)
      : false;

  // Keyboard row navigation — StorageGrid's selection model on a
  // read-only, PAGINATED grid: no grid-local selection state; an arrow
  // move opens the record document like a click (`openRecord`) and the
  // highlight follows the active-editor-tab derivation
  // (`isRecordActive`). The walk is page-local by design — an active
  // document from another page reads as no selection here, so the
  // arrows restart at this page's ends; the pager buttons stay the page
  // gesture (`pageRows: null` keeps the Page keys unhandled too). Enter
  // has no gesture: the rows are read-only (no inline edit to twin) and
  // the document it could open is already open — the arrow move that
  // made the row active opened it. A rare row without a wire key can't
  // open a document, so an arrow move onto it is the same visual no-op
  // a click on it is. Stands down for presses on interactive children
  // (the row delete lane).
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea') !== null) return;
    if (records.length === 0) return;
    const pos = records.findIndex(recordActive);
    const next = walkListSelection(records.length, pos, e.key, null);
    if (next === null) return;
    e.preventDefault();
    if (next !== pos) openRecord(records[next]);
    e.currentTarget.querySelector(`.dt-storage-row[data-entry-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

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
        // role="grid" + focusable container, StorageGrid's anatomy: the
        // rows are plain divs (the per-row tabIndex/Enter this grid
        // predated the model with is gone), so a row click focuses the
        // grid as the nearest focusable ancestor; the active-row
        // highlight is the focus affordance, no ring on the box.
        <div
          className="dt-storage-grid dt-storage-grid--idb"
          role="grid"
          aria-label="IndexedDB records"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
          <div className="dt-storage-grid-header" role="row">
            <StorageColumnHeaderCell label="Key" info={<IdbRecordColumnInfo infoKey="key" />} />
            <StorageColumnHeaderCell label="Value" info={<IdbRecordColumnInfo infoKey="value" />} />
          </div>
          {records.map((r, i) => {
            const wireKey = r.primaryKeyWire;
            const active = recordActive(r);
            return (
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: grid row doubles as the open affordance
              <div
                className={`dt-storage-row${active ? ' dt-storage-row--active' : ''}`}
                role="row"
                aria-selected={active}
                data-entry-index={i}
                key={`${idb.page}:${i}:${r.primaryKeyPreview}`}
                title={wireKey !== undefined ? 'Open this record in the editor' : undefined}
                onClick={() => openRecord(r)}
              >
                <span className="dt-storage-key" role="gridcell" title={`Key: ${r.keyPreview}\nPrimary key: ${r.primaryKeyPreview}`}>
                  {r.keyPreview}
                </span>
                <span className="dt-storage-value" role="gridcell" title={r.valuePreview}>
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

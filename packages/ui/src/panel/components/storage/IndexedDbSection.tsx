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
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { useMemo } from 'react';
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

// Row copy resolved once per locale — the database/store/record loops
// read this object, never `t()` (per-row law). Names and key previews
// ride as raw holes.
function buildIdbRowLabels(t: Translate) {
  return {
    versionTitle: (version: string) => t('panel.storage.idb.versionTitle', { version }),
    storeCount: (count: number) => t('panel.storage.idb.storeCount', { count }),
    metaKeyPath: (path: string) => t('panel.storage.idb.metaKeyPath', { path }),
    metaAutoIncrement: t('panel.storage.idb.metaAutoIncrement'),
    metaOutOfLine: t('panel.storage.idb.metaOutOfLine'),
    indexCount: (count: number) => t('panel.storage.idb.indexCount', { count }),
    deleteDbTitle: (name: string) => t('panel.storage.idb.deleteDbTitle', { name }),
    deleteDbConfirmTitle: (name: string) => t('panel.storage.idb.deleteDbConfirmTitle', { name }),
    deleteDbAria: (name: string) => t('panel.storage.idb.deleteDbAria', { name }),
    openStoreTitle: (database: string, store: string) => t('panel.storage.idb.openStoreTitle', { database, store }),
    clearStoreTitle: (store: string) => t('panel.storage.idb.clearStoreTitle', { store }),
    clearStoreConfirmTitle: (database: string, store: string) =>
      t('panel.storage.idb.clearStoreConfirmTitle', { database, store }),
    clearStoreAria: (store: string) => t('panel.storage.idb.clearStoreAria', { store }),
    confirmClear: t('panel.storage.confirmClear'),
    noStores: t('panel.storage.idb.noStores'),
    openRecordTitle: t('panel.storage.idb.openRecordTitle'),
    keyCellTitle: (key: string, primaryKey: string) => t('panel.storage.idb.keyCellTitle', { key, primaryKey }),
    deleteRecordTitle: t('panel.storage.idb.deleteRecordTitle'),
    deleteRecordAria: (key: string) => t('panel.storage.idb.deleteRecordAria', { key }),
  };
}
type IdbRowLabels = ReturnType<typeof buildIdbRowLabels>;

function storeMeta(labels: IdbRowLabels, store: IdbDatabase['objectStores'][number]): string {
  const key = store.keyPath
    ? labels.metaKeyPath(store.keyPath)
    : store.autoIncrement
      ? labels.metaAutoIncrement
      : labels.metaOutOfLine;
  return store.indexNames.length > 0 ? `${key} · ${labels.indexCount(store.indexNames.length)}` : key;
}

export function IndexedDbSection({ idb, filter, onOpenRecord, isRecordActive }: IndexedDbSectionProps) {
  const t = useT();
  const rowLabels = useMemo(() => buildIdbRowLabels(t), [t]);
  if (idb.selection) {
    return <RecordsView idb={idb} filter={filter} onOpenRecord={onOpenRecord} isRecordActive={isRecordActive} />;
  }
  if (idb.databases === null) {
    return idb.loading ? (
      <div className="dt-empty">{t('panel.storage.empty.loading')}</div>
    ) : (
      <div className="dt-empty-hero">
        <strong>{t('panel.storage.idb.cantReadTitle')}</strong>
        <span className="dt-empty-hero-sub">{t('panel.storage.idb.cantReadSub')}</span>
      </div>
    );
  }
  if (idb.databases.length === 0) {
    return <div className="dt-empty">{t('panel.storage.idb.noDatabases')}</div>;
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
              <span className="dt-storage-idb-version" title={rowLabels.versionTitle(String(db.version))}>
                v{db.version}
              </span>
              <span className="dt-storage-meta">{rowLabels.storeCount(db.objectStores.length)}</span>
              <ArmedIconButton
                icon={<DeleteOutlined />}
                title={rowLabels.deleteDbTitle(db.name)}
                confirmTitle={rowLabels.deleteDbConfirmTitle(db.name)}
                ariaLabel={rowLabels.deleteDbAria(db.name)}
                onConfirm={() => idb.deleteDatabase(db.name)}
              />
            </div>
            {stores.map((s) => (
              <div key={s.name} className="dt-storage-idb-store-row">
                <button
                  type="button"
                  className="dt-storage-idb-store"
                  onClick={() => idb.selectStore(db.name, s.name)}
                  title={rowLabels.openStoreTitle(db.name, s.name)}
                >
                  <span className="dt-storage-idb-icon">
                    <TableIcon />
                  </span>
                  {s.name}
                  <span className="dt-storage-meta">{storeMeta(rowLabels, s)}</span>
                </button>
                <ArmedIconButton
                  icon={<ClearOutlined />}
                  title={rowLabels.clearStoreTitle(s.name)}
                  confirmTitle={rowLabels.clearStoreConfirmTitle(db.name, s.name)}
                  confirmLabel={rowLabels.confirmClear}
                  ariaLabel={rowLabels.clearStoreAria(s.name)}
                  onConfirm={() => idb.clearStore(db.name, s.name)}
                />
              </div>
            ))}
            {db.objectStores.length === 0 && (
              <div className="dt-storage-meta dt-storage-idb-empty">{rowLabels.noStores}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecordsView({ idb, filter, onOpenRecord, isRecordActive }: IndexedDbSectionProps) {
  const t = useT();
  const rowLabels = useMemo(() => buildIdbRowLabels(t), [t]);
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
        <button
          type="button"
          className="dt-storage-action"
          title={t('panel.storage.idb.backTitle')}
          aria-label={t('panel.storage.idb.backTitle')}
          onClick={idb.closeStore}
        >
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
            aria-label={t('panel.storage.idb.cursorAria')}
            title={t('panel.storage.idb.cursorTitle')}
          >
            <option value="">{t('panel.storage.idb.primaryKeyOption')}</option>
            {storeShape.indexNames.map((n) => (
              <option key={n} value={n}>
                {t('panel.storage.idb.indexOption', { name: n })}
              </option>
            ))}
          </select>
        )}
        <span className="dt-storage-pager">
          <button
            type="button"
            className="dt-storage-action"
            title={t('panel.storage.pager.prevTitle')}
            aria-label={t('panel.storage.pager.prevTitle')}
            disabled={idb.page === 0}
            onClick={() => idb.setPage(idb.page - 1)}
          >
            <LeftOutlined />
          </button>
          <span className="dt-storage-meta">{t('panel.storage.pager.page', { page: idb.page + 1 })}</span>
          <button
            type="button"
            className="dt-storage-action"
            title={t('panel.storage.pager.nextTitle')}
            aria-label={t('panel.storage.pager.nextTitle')}
            disabled={!pageData?.truncated}
            onClick={() => idb.setPage(idb.page + 1)}
          >
            <RightOutlined />
          </button>
        </span>
      </div>
      {pageData === null ? (
        <div className="dt-empty">{t('panel.storage.empty.loading')}</div>
      ) : pageData.records.length === 0 ? (
        <div className="dt-empty">
          {idb.page > 0
            ? t('panel.storage.idb.noRecordsPage', { store: selection.store })
            : t('panel.storage.idb.noRecords', { store: selection.store })}
        </div>
      ) : records.length === 0 ? (
        <div className="dt-empty">{t('panel.storage.idb.noRecordsMatch')}</div>
      ) : (
        // role="grid" + focusable container, StorageGrid's anatomy: the
        // rows are plain divs (the per-row tabIndex/Enter this grid
        // predated the model with is gone), so a row click focuses the
        // grid as the nearest focusable ancestor; the active-row
        // highlight is the focus affordance, no ring on the box.
        <div
          className="dt-storage-grid dt-storage-grid--idb"
          role="grid"
          aria-label={t('panel.storage.idb.gridAria')}
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
          <div className="dt-storage-grid-header" role="row">
            <StorageColumnHeaderCell label={t('panel.storage.idb.col.key')} info={<IdbRecordColumnInfo infoKey="key" />} />
            <StorageColumnHeaderCell
              label={t('panel.storage.idb.col.value')}
              info={<IdbRecordColumnInfo infoKey="value" />}
            />
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
                title={wireKey !== undefined ? rowLabels.openRecordTitle : undefined}
                onClick={() => openRecord(r)}
              >
                <span
                  className="dt-storage-key"
                  role="gridcell"
                  title={rowLabels.keyCellTitle(r.keyPreview, r.primaryKeyPreview)}
                >
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
                      title={rowLabels.deleteRecordTitle}
                      aria-label={rowLabels.deleteRecordAria(r.primaryKeyPreview)}
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

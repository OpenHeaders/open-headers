/**
 * The Storage tool window's IndexedDB section. Two levels: the scope's
 * databases with their object stores, then a selected store's
 * cursor-paged records grid of in-page-serialized previews (StorageGrid
 * idiom), readable through the store's primary cursor or any of its
 * indexes. A row expands into the record's bounded value tree — a lazy
 * one-shot fetch like the caches' response preview, never polled.
 * Deletes are in scope — record (rows carrying a lossless wire key),
 * store clear, whole database — record EDITING stays out of v1. Bulk
 * gestures (clear / database delete) use the two-step arm/confirm
 * idiom; a record delete is single-click like the DOM grid's.
 */

import { ClearOutlined, DeleteOutlined, DownOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import type { IdbDatabase, IdbValueNode } from '../../data/storage/storage-inspector-host';
import type { IdbBrowserState } from '../../data/storage/use-idb-browser';
import { ArmedIconButton } from './ArmedIconButton';

interface IndexedDbSectionProps {
  idb: IdbBrowserState;
  filter: string;
}

function storeMeta(store: IdbDatabase['objectStores'][number]): string {
  const key = store.keyPath ? `key: ${store.keyPath}` : store.autoIncrement ? 'auto-increment keys' : 'out-of-line keys';
  return store.indexNames.length > 0 ? `${key} · ${store.indexNames.length} ${store.indexNames.length === 1 ? 'index' : 'indexes'}` : key;
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

type ValueSlot = 'loading' | 'failed' | IdbValueNode;

function RecordsView({ idb, filter }: IndexedDbSectionProps) {
  // The expanded record's value tree — a lazy one-shot fetch held here,
  // keyed on the record's wire key; never polled state. The ref mirrors
  // the key so a late fetch for a since-collapsed row drops.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [valueSlot, setValueSlot] = useState<ValueSlot | null>(null);
  const expandedRef = useRef<string | null>(null);

  const selection = idb.selection;
  const database = selection?.database ?? null;
  const store = selection?.store ?? null;
  const { readRecordValue } = idb;

  // Store, page or cursor change → the expanded row is gone.
  useEffect(() => {
    expandedRef.current = null;
    setExpandedKey(null);
    setValueSlot(null);
  }, [database, store, idb.page, idb.index]);

  if (!selection) return null;
  const storeShape = idb.databases
    ?.find((d) => d.name === selection.database)
    ?.objectStores.find((s) => s.name === selection.store);
  const pageData = idb.recordsPage;

  const toggleValue = (wireKey: string) => {
    if (expandedKey === wireKey) {
      expandedRef.current = null;
      setExpandedKey(null);
      setValueSlot(null);
      return;
    }
    expandedRef.current = wireKey;
    setExpandedKey(wireKey);
    setValueSlot('loading');
    void readRecordValue(wireKey).then((result) => {
      if (expandedRef.current === wireKey) setValueSlot(result ?? 'failed');
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
        <div className="dt-storage-grid" role="table" aria-label="IndexedDB records">
          <div className="dt-storage-grid-header" role="row">
            <span role="columnheader">Key</span>
            <span role="columnheader">Value</span>
          </div>
          {records.map((r, i) => {
            const wireKey = r.primaryKeyWire;
            const expanded = wireKey !== undefined && expandedKey === wireKey;
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
                      title={expanded ? 'Collapse the record value' : 'Expand the record value'}
                      aria-label={`Expand value for ${r.primaryKeyPreview}`}
                      aria-expanded={expanded}
                      onClick={() => toggleValue(wireKey)}
                    >
                      {expanded ? <DownOutlined /> : <RightOutlined />}
                    </button>
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
                {expanded && valueSlot !== null ? <IdbValueStrip slot={valueSlot} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** The expanded record's value tree, or its loading/failure note. */
function IdbValueStrip({ slot }: { slot: ValueSlot }) {
  if (slot === 'loading') {
    return <div className="dt-storage-response-strip dt-storage-response-note">Loading…</div>;
  }
  if (slot === 'failed') {
    return (
      <div className="dt-storage-response-strip dt-storage-response-note">
        The record value can’t be read — the record may be gone.
      </div>
    );
  }
  return (
    <div className="dt-storage-response-strip dt-storage-idb-tree" aria-label="Record value">
      <IdbValueTreeNode node={slot} depth={0} />
    </div>
  );
}

/**
 * One tree node: disclosure toggle (containers only, root open by
 * default), the property/slot label, and the node's own preview.
 * The tree is already bounded host-side; toggles are pure UI state.
 */
function IdbValueTreeNode({ node, depth }: { node: IdbValueNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = (node.children?.length ?? 0) > 0 || (node.dropped ?? 0) > 0;
  return (
    <div className="dt-storage-idb-tree-node">
      <div className="dt-storage-idb-tree-line" style={{ paddingLeft: depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            className="dt-storage-idb-tree-toggle"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label ?? 'value'}`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <DownOutlined /> : <RightOutlined />}
          </button>
        ) : (
          <span className="dt-storage-idb-tree-toggle" aria-hidden="true" />
        )}
        {node.label !== undefined && <span className="dt-storage-idb-tree-label">{node.label}:</span>}
        <span className="dt-storage-idb-tree-preview" title={node.preview}>
          {node.preview}
        </span>
      </div>
      {open &&
        node.children?.map((child, i) => (
          <IdbValueTreeNode key={`${i}:${child.label ?? ''}`} node={child} depth={depth + 1} />
        ))}
      {open && (node.dropped ?? 0) > 0 && (
        <div className="dt-storage-idb-tree-line dt-storage-idb-tree-more" style={{ paddingLeft: (depth + 1) * 14 }}>
          … +{node.dropped} more
        </div>
      )}
    </div>
  );
}

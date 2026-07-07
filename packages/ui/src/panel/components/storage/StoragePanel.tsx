/**
 * Storage tool window — application-storage inspector for the inspected
 * tab. Origin scope picker + Local/Session storage grid over the
 * standard data plane (SW injection), refreshed by visibility-gated
 * polling; writes ride the same plane and refetch through the read path
 * (STORAGE_PANEL_PLAN.md §5, slice 2). Cookies / IndexedDB / Cache
 * Storage / quota arrive in later slices.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useEffect, useMemo, useState } from 'react';
import type { DomStorageArea, DomStorageEntry } from '../../data/storage/storage-inspector-host';
import { parseStorageKey } from '../../data/storage/storage-key';
import { type StorageInspectorState, useStorageInspector } from '../../data/storage/use-storage-inspector';
import { StorageGrid } from './StorageGrid';

interface StoragePanelProps {
  onHide: () => void;
}

const AREAS: ReadonlyArray<{ value: DomStorageArea; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'session', label: 'Session' },
];

export function StoragePanel({ onHide }: StoragePanelProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const inspector = useStorageInspector();
  const [textFilter, setTextFilter] = useState('');
  const [adding, setAdding] = useState(false);

  // Selection or area moved out from under an open add row — drop it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selection identity is the reset trigger
  useEffect(() => {
    setAdding(false);
  }, [inspector.selectedOrigin, inspector.area]);

  const entries = inspector.snapshot?.entries ?? [];
  const filtered = useMemo<ReadonlyArray<DomStorageEntry>>(() => {
    const needle = textFilter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => e.key.toLowerCase().includes(needle) || e.value.toLowerCase().includes(needle));
  }, [entries, textFilter]);

  const canWrite = inspector.available && inspector.scopes.length > 0 && inspector.snapshot !== null;

  // Partition evidence (CDP tier): the selected scope's storage key, when
  // the browser reported one and it carries partition components.
  const selectedScope = inspector.scopes.find((s) => s.origin === inspector.selectedOrigin) ?? null;
  const partition = selectedScope?.storageKey ? parseStorageKey(selectedScope.storageKey) : null;

  return (
    <div className="dt-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <div className="dt-header-filter-row">
            <input
              type="text"
              className="dt-filter-input dt-filter-input--grow"
              placeholder="Filter"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
            <div className="dt-filter-separator" />
            <div className="dt-filter-pills">
              {AREAS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className="dt-filter-pill"
                  data-active={inspector.area === a.value}
                  onClick={() => inspector.setArea(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="dt-filter-separator" />
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={() => setAdding(true)}
              disabled={!canWrite}
              title="Add entry"
              aria-label="Add storage entry"
            >
              <PlusOutlined />
            </button>
            <button
              type="button"
              className="dt-toolbar-icon"
              onClick={inspector.refresh}
              title="Refresh"
              aria-label="Refresh storage"
            >
              <ReloadOutlined />
            </button>
          </div>
        }
      />

      {inspector.scopes.length > 0 && (
        <div className="dt-storage-scope-bar">
          <select
            className="dt-storage-scope-select"
            value={inspector.selectedOrigin ?? ''}
            onChange={(e) => inspector.selectOrigin(e.target.value)}
            aria-label="Storage origin"
          >
            {inspector.scopes.map((s) => (
              <option key={s.origin} value={s.origin}>
                {s.origin}
                {s.isMainFrame ? '' : ' (iframe)'}
              </option>
            ))}
          </select>
          {partition?.partitioned && (
            <span
              className="dt-storage-partition-chip"
              title={`Partitioned storage — this origin's data here is keyed under ${partition.topLevelSite ?? 'a partition'}.\nStorage key: ${partition.raw}`}
            >
              partitioned{partition.topLevelSite ? ` · ${partition.topLevelSite}` : ''}
            </span>
          )}
          <span className="dt-storage-scope-note">
            {inspector.snapshot ? `${filtered.length} of ${entries.length} items` : ''}
            {inspector.snapshot?.truncated ? ' · list truncated' : ''}
            {inspector.readFailed ? ' · read failed — showing last data' : ''}
            {inspector.writeFailed ? ' · write failed' : ''}
          </span>
          {canWrite && entries.length > 0 && <ClearAllButton area={inspector.area} onClear={inspector.clearArea} />}
        </div>
      )}

      <div className="dt-storage-body">
        <StorageBody
          inspector={inspector}
          entries={filtered}
          totalCount={entries.length}
          adding={adding}
          onCloseAdd={() => setAdding(false)}
        />
      </div>
    </div>
  );
}

/** Two-step inline confirm — first click arms, second commits. */
function ClearAllButton({ area, onClear }: { area: DomStorageArea; onClear: () => Promise<boolean> }) {
  const [armed, setArmed] = useState(false);
  const areaName = area === 'local' ? 'localStorage' : 'sessionStorage';
  return (
    <button
      type="button"
      className={`dt-storage-clear${armed ? ' dt-storage-clear--armed' : ''}`}
      title={armed ? `Deletes every ${areaName} entry for this origin` : `Clear all ${areaName} entries`}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void onClear();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Confirm clear?' : 'Clear all'}
    </button>
  );
}

interface StorageBodyProps {
  inspector: StorageInspectorState;
  entries: ReadonlyArray<DomStorageEntry>;
  totalCount: number;
  adding: boolean;
  onCloseAdd: () => void;
}

function StorageBody({ inspector, entries, totalCount, adding, onCloseAdd }: StorageBodyProps) {
  const { available, loading, area, selectedOrigin: origin } = inspector;
  const hasScopes = inspector.scopes.length > 0;
  const hasSnapshot = inspector.snapshot !== null;

  if (!available) {
    return (
      <div className="dt-empty-hero">
        <strong>Storage inspection isn’t available here</strong>
        <span className="dt-empty-hero-sub">This host doesn’t expose the inspected tab’s application storage.</span>
      </div>
    );
  }
  if (!hasScopes) {
    return (
      <div className="dt-empty-hero">
        <strong>No inspectable origins</strong>
        <span className="dt-empty-hero-sub">
          This tab has no http(s) frames with DOM storage — browser-internal pages can’t be inspected.
        </span>
      </div>
    );
  }
  if (loading && !hasSnapshot) {
    return <div className="dt-empty">Loading…</div>;
  }
  if (!hasSnapshot) {
    return (
      <div className="dt-empty-hero">
        <strong>Storage unavailable</strong>
        <span className="dt-empty-hero-sub">
          The frame for {origin ?? 'this origin'} can’t be read right now — it may have navigated away.
        </span>
      </div>
    );
  }
  if (totalCount === 0 && !adding) {
    return (
      <div className="dt-empty">
        No items in {area === 'local' ? 'localStorage' : 'sessionStorage'} for {origin}.
      </div>
    );
  }
  if (entries.length === 0 && !adding) {
    return <div className="dt-empty">No items match your filter.</div>;
  }
  return (
    <StorageGrid
      entries={entries}
      adding={adding}
      onCloseAdd={onCloseAdd}
      onCommit={inspector.applyEdit}
      onRemove={inspector.removeEntry}
      fetchFullValue={inspector.fetchFullValue}
    />
  );
}

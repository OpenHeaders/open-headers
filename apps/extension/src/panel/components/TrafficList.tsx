import { useEffect, useMemo, useRef, useState } from 'react';
import type { FilterConfig, FilterToken } from '../data/filter-engine';
import { matchesUrlFilter } from '../data/filter-engine';
import type { InspectorRequest } from '../data/types';
import {
  extractName,
  formatDuration,
  formatInitiator,
  formatSize,
  formatTimestamp,
  statusClass,
} from './traffic/formatters';
import ResourceIcon from './traffic/ResourceIcon';
import { isBlockedRequest } from './traffic/request-status';
import { matchesResourceType, normalizeResourceType, RESOURCE_LABEL } from './traffic/resource-types';

interface TrafficListProps {
  entries: readonly InspectorRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: ReadonlySet<string>;
  filterTokens: FilterToken[];
  filterConfig: FilterConfig;
  recording: boolean;
  onStartRecording: () => void;
  onReloadPage: () => void;
}

type SortKey = 'name' | 'status' | 'type' | 'initiator' | 'size' | 'time' | 'timestamp';
type SortDir = 'asc' | 'desc';

function getSortValue(entry: InspectorRequest, key: SortKey): string | number {
  switch (key) {
    case 'timestamp':
      return entry.timestamp;
    case 'name':
      return entry.url.toLowerCase();
    case 'status':
      return entry.statusCode ?? -1;
    case 'type':
      return RESOURCE_LABEL[normalizeResourceType(entry.resourceType)] ?? 'other';
    case 'initiator':
      return formatInitiator(entry.harEntry?._initiator).toLowerCase();
    case 'size':
      return entry.responseSize ?? -1;
    case 'time':
      return entry.duration ?? -1;
  }
}

function sortIndicator(col: SortKey, sortKey: SortKey, sortDir: SortDir): string {
  if (col !== sortKey) return '';
  return sortDir === 'asc' ? ' \u25b4' : ' \u25be';
}

const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'size', label: 'Size', className: 'dt-col-right' },
  { key: 'time', label: 'Time', className: 'dt-col-right' },
];

export function TrafficList({
  entries,
  selectedId,
  onSelect,
  filter,
  filterTokens,
  filterConfig,
  recording,
  onStartRecording,
  onReloadPage,
}: TrafficListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const tableRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!matchesResourceType(e.resourceType, filter)) return false;
      if (filterTokens.length > 0 && !matchesUrlFilter(e, filterTokens, filterConfig)) return false;
      return true;
    });
  }, [entries, filter, filterTokens, filterConfig]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    const el = tableRef.current;
    if (!el || sorted.length <= prevCountRef.current) {
      prevCountRef.current = sorted.length;
      return;
    }
    prevCountRef.current = sorted.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sorted.length]);

  if (filtered.length === 0) {
    if (entries.length === 0) {
      return (
        <div className="dt-empty-hero">
          <strong>{recording ? 'Recording network activity\u2026' : 'No network activity recorded'}</strong>
          <span className="dt-empty-hero-sub">
            {recording ? 'Perform a request or reload the page.' : 'Record network log to display network activity.'}
          </span>
          <button type="button" className="dt-btn dt-btn-primary" onClick={recording ? onReloadPage : onStartRecording}>
            {recording ? 'Reload page' : 'Start recording'}
          </button>
        </div>
      );
    }
    return <div className="dt-empty">No matching requests.</div>;
  }

  return (
    <>
      <div className="dt-table-header dt-cols">
        <span>#</span>
        <span />
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            className={`dt-col-sort ${col.className ?? ''}`}
            onClick={() => handleSort(col.key)}
          >
            {col.label}
            {sortIndicator(col.key, sortKey, sortDir)}
          </button>
        ))}
      </div>
      <div className="dt-table" ref={tableRef}>
        {sorted.map((entry) => {
          const rawType = normalizeResourceType(entry.resourceType);
          const rt = RESOURCE_LABEL[rawType] ?? 'other';
          const { name, detail } = extractName(entry.url);
          const initiator = formatInitiator(entry.harEntry?._initiator);
          const blocked = isBlockedRequest(entry);
          return (
            <button
              key={entry.id}
              type="button"
              className={`dt-row dt-cols ${blocked ? 'dt-row--blocked' : ''}`}
              data-selected={entry.id === selectedId}
              onClick={() => onSelect(entry.id)}
              title={entry.url}
            >
              <span className="dt-col-muted" style={{ textAlign: 'right' }}>
                {entry.displayId}
              </span>
              <span className="dt-col-dot">
                {entry.fires.length > 0 && (
                  <span
                    className={`dt-fire-dot ${entry.fires.some((f) => f.authoritative) ? 'dt-fire-dot--auth' : 'dt-fire-dot--inferred'}`}
                  />
                )}
              </span>
              <span className="dt-col-muted">{formatTimestamp(entry.timestamp)}</span>
              <span className="dt-col-name">
                <ResourceIcon type={rawType} />
                <span className="dt-col-name-text">{name}</span>
              </span>
              <span className={statusClass(entry.statusCode)}>
                {blocked ? `(${entry.statusText || 'blocked'})` : (entry.statusCode ?? '')}
              </span>
              <span>{rt}</span>
              <span className="dt-col-muted">{initiator}</span>
              <span className="dt-col-right">{formatSize(entry.responseSize)}</span>
              <span className="dt-col-right">{formatDuration(entry.duration)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

import { useMemo, useState } from 'react';
import type { FilterConfig, FilterToken } from '../data/filter-engine';
import { matchesUrlFilter } from '../data/filter-engine';
import type { InspectorRequest } from '../data/types';

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

const RESOURCE_LABEL: Record<string, string> = {
  main_frame: 'document',
  sub_frame: 'document',
  document: 'document',
  xmlhttprequest: 'xhr',
  xhr: 'xhr',
  fetch: 'fetch',
  script: 'script',
  stylesheet: 'stylesheet',
  image: 'image',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  ping: 'ping',
  other: 'other',
};

type SortKey = 'name' | 'status' | 'type' | 'initiator' | 'size' | 'time' | 'timestamp';
type SortDir = 'asc' | 'desc';

function normalizeResourceType(raw: string | undefined): string {
  if (!raw) return 'other';
  return raw.toLowerCase();
}

const KNOWN_TYPES = new Set([
  'main_frame',
  'sub_frame',
  'document',
  'xmlhttprequest',
  'xhr',
  'fetch',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'manifest',
  'wasm',
]);

function matchesCategory(rt: string, category: string): boolean {
  if (category === 'xhr') return rt === 'xmlhttprequest' || rt === 'xhr' || rt === 'fetch';
  if (category === 'doc') return rt === 'main_frame' || rt === 'sub_frame' || rt === 'document';
  if (category === 'js') return rt === 'script';
  if (category === 'css') return rt === 'stylesheet';
  if (category === 'img') return rt === 'image';
  if (category === 'media') return rt === 'media';
  if (category === 'font') return rt === 'font';
  if (category === 'ws') return rt === 'websocket';
  if (category === 'manifest') return rt === 'manifest';
  if (category === 'wasm') return rt === 'wasm';
  if (category === 'other') return !KNOWN_TYPES.has(rt);
  return false;
}

function matchesResourceType(entry: InspectorRequest, filter: ReadonlySet<string>): boolean {
  if (filter.size === 0) return true;
  const rt = normalizeResourceType(entry.resourceType);
  for (const cat of filter) {
    if (matchesCategory(rt, cat)) return true;
  }
  return false;
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | undefined): string {
  if (ms == null || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mmm = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

function statusClass(code: number | undefined): string {
  if (code == null) return '';
  if (code >= 500) return 'dt-col-status--5xx';
  if (code >= 400) return 'dt-col-status--4xx';
  if (code >= 300) return 'dt-col-status--3xx';
  if (code >= 200 && code < 300) return 'dt-col-status--2xx';
  return '';
}

function extractName(url: string): { hostname: string; path: string } {
  try {
    const parsed = new URL(url);
    return { hostname: parsed.hostname, path: parsed.pathname + parsed.search };
  } catch {
    return { hostname: url, path: '' };
  }
}

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
    case 'initiator': {
      const obj = entry.harEntry?._initiator as Record<string, unknown> | undefined;
      return ((obj?.type as string) ?? '').toLowerCase();
    }
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
      if (!matchesResourceType(e, filter)) return false;
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
      <div className="dt-table">
        {sorted.map((entry) => {
          const rt = RESOURCE_LABEL[normalizeResourceType(entry.resourceType)] ?? 'other';
          const { hostname, path } = extractName(entry.url);
          const initiatorObj = entry.harEntry?._initiator as Record<string, unknown> | undefined;
          const initiator = (initiatorObj?.type as string) ?? '';
          return (
            <button
              key={entry.id}
              type="button"
              className="dt-row dt-cols"
              data-selected={entry.id === selectedId}
              onClick={() => onSelect(entry.id)}
              title={entry.url}
            >
              <span className="dt-col-dot">
                {entry.fires.length > 0 && (
                  <span
                    className={`dt-fire-dot ${entry.fires.some((f) => f.authoritative) ? 'dt-fire-dot--auth' : 'dt-fire-dot--inferred'}`}
                  />
                )}
              </span>
              <span className="dt-col-muted">{formatTimestamp(entry.timestamp)}</span>
              <span className="dt-col-name">
                <span className="dt-col-name-text">
                  {hostname}
                  <span className="dt-col-muted">{path}</span>
                </span>
              </span>
              <span className={statusClass(entry.statusCode)}>{entry.statusCode ?? ''}</span>
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

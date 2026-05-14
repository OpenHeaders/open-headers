/**
 * Column registry for the traffic table.
 *
 * Each ColumnDef declares:
 *   - `key` — stable identifier (used for sort, visibility, persistence)
 *   - `label` — human name (column header + right-click menu label)
 *   - `defaultWidth` — initial width in pixels. User resizing overrides
 *     this per session via TrafficList's column-width state; the
 *     default is restored when the user resets columns or
 *     double-clicks the grip.
 *   - `minWidth` — absolute floor for the column (defaults to 40px)
 *   - `stretch` — when true, the column is allowed to absorb remaining
 *     horizontal space via `1fr` (Name + Waterfall today). Resizing a
 *     stretchy column converts it to a fixed-width column for the
 *     duration of the session.
 *   - `align` — `'left' | 'right'` for right-justified numeric columns
 *   - `getSortValue` — value the sort comparator reads when this
 *     column is the sort key (nullish / missing normalises to `-1`)
 *   - `extract` — derivation from an `InspectorRequest` to the cell's
 *     string/number content; `null` when the cell should render nothing
 *
 * This indirection is what makes column visibility, reordering, and
 * sorting a pure data concern the TrafficList can consume without
 * growing N special cases per column.
 */

import { formatHttpVersion } from '../../data/http-version';
import type { InspectorRequest } from '../../data/types';
import { formatDuration, formatInitiator, formatSize, formatTimestamp } from './formatters';
import { normalizeResourceType, RESOURCE_LABEL } from './resource-types';

export type ColumnKey =
  | 'name'
  | 'method'
  | 'path'
  | 'url'
  | 'status'
  | 'protocol'
  | 'scheme'
  | 'domain'
  | 'remoteAddress'
  | 'type'
  | 'initiator'
  | 'cookies'
  | 'setCookies'
  | 'size'
  | 'time'
  | 'priority'
  | 'timestamp'
  | 'waterfall';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** Initial width in px. Pre-resize grid starts with this. */
  defaultWidth: number;
  /** Hard floor for user resizing. Defaults to 40 when omitted. */
  minWidth?: number;
  /** When true, the column absorbs remaining space via `1fr`. */
  stretch?: boolean;
  align?: 'left' | 'right';
  /** Whether this column participates in sorting. */
  sortable: boolean;
  extract: (entry: InspectorRequest) => string | number | null;
  getSortValue: (entry: InspectorRequest) => string | number;
}

export const DEFAULT_COLUMN_MIN_WIDTH = 40;

/**
 * Resolve the CSS grid-track expression for a column given an
 * optional user-override width. Stretchy columns without an override
 * use `minmax(<default>, 1fr)` so they absorb remaining space;
 * everything else is a fixed pixel track that the user can drag.
 */
export function columnTrack(col: ColumnDef, override: number | undefined): string {
  if (override != null) return `${Math.max(override, col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH)}px`;
  if (col.stretch) return `minmax(${col.defaultWidth}px, 1fr)`;
  return `${col.defaultWidth}px`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function safeScheme(url: string): string {
  try {
    return new URL(url).protocol.replace(/:$/, '');
  } catch {
    return '';
  }
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ?? '');
  } catch {
    return url;
  }
}

function countSetCookies(entry: InspectorRequest): number {
  const headers = entry.harEntry.response?.headers ?? [];
  let n = 0;
  for (const h of headers) if (h.name.toLowerCase() === 'set-cookie') n++;
  return n;
}

function countRequestCookies(entry: InspectorRequest): number {
  return entry.harEntry.request?.cookies?.length ?? 0;
}

function priority(entry: InspectorRequest): string {
  const p = entry.harEntry._priority;
  return typeof p === 'string' ? p : '';
}

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  name: {
    key: 'name',
    label: 'Name',
    defaultWidth: 220,
    minWidth: 100,
    stretch: true,
    sortable: true,
    extract: (e) => e.url,
    getSortValue: (e) => e.url.toLowerCase(),
  },
  method: {
    // Default wide enough to fit "POST + Preflight" (the CORS label
    // the Method cell shows when this row has a matching preflight).
    key: 'method',
    label: 'Method',
    defaultWidth: 120,
    minWidth: 52,
    sortable: true,
    extract: (e) => e.method,
    getSortValue: (e) => e.method,
  },
  path: {
    key: 'path',
    label: 'Path',
    defaultWidth: 200,
    minWidth: 80,
    sortable: true,
    extract: (e) => safePath(e.url),
    getSortValue: (e) => safePath(e.url),
  },
  url: {
    key: 'url',
    label: 'URL',
    defaultWidth: 260,
    minWidth: 120,
    sortable: true,
    extract: (e) => e.url,
    getSortValue: (e) => e.url.toLowerCase(),
  },
  status: {
    // Default wide enough to fit the common blocked statuses —
    // "(blocked)", "(canceled)", "(net::ERR_BLOCKED_BY_CLIENT)" —
    // following the same "size for worst common content" rule as the
    // Method column. Longer strings still truncate with a tooltip
    // rather than widening further.
    key: 'status',
    label: 'Status',
    defaultWidth: 120,
    minWidth: 48,
    sortable: true,
    extract: (e) => e.statusCode ?? null,
    getSortValue: (e) => e.statusCode ?? -1,
  },
  protocol: {
    key: 'protocol',
    label: 'Protocol',
    // Wide enough for the longest friendly label (`HTTP/1.1`).
    defaultWidth: 80,
    minWidth: 52,
    sortable: true,
    // Humanise `h2`/`h3`/QUIC at extraction time so the cell, the
    // context-menu labels, and any future consumers (e.g. column
    // filters) see the same string. Raw value is preserved for sort
    // so Chrome's ALPN-order (h2 < h3) stays stable.
    extract: (e) => formatHttpVersion(e.harEntry.response?.httpVersion ?? e.harEntry.request?.httpVersion ?? ''),
    getSortValue: (e) => e.harEntry.response?.httpVersion ?? '',
  },
  scheme: {
    key: 'scheme',
    label: 'Scheme',
    defaultWidth: 72,
    minWidth: 48,
    sortable: true,
    extract: (e) => safeScheme(e.url),
    getSortValue: (e) => safeScheme(e.url),
  },
  domain: {
    key: 'domain',
    label: 'Domain',
    defaultWidth: 160,
    minWidth: 80,
    sortable: true,
    extract: (e) => safeHost(e.url),
    getSortValue: (e) => safeHost(e.url),
  },
  remoteAddress: {
    key: 'remoteAddress',
    label: 'Remote address',
    defaultWidth: 140,
    minWidth: 100,
    sortable: true,
    extract: (e) => e.harEntry.serverIPAddress ?? '',
    getSortValue: (e) => e.harEntry.serverIPAddress ?? '',
  },
  type: {
    key: 'type',
    label: 'Type',
    defaultWidth: 80,
    minWidth: 56,
    sortable: true,
    extract: (e) => RESOURCE_LABEL[normalizeResourceType(e.resourceType)] ?? 'other',
    getSortValue: (e) => RESOURCE_LABEL[normalizeResourceType(e.resourceType)] ?? 'other',
  },
  initiator: {
    key: 'initiator',
    label: 'Initiator',
    defaultWidth: 140,
    minWidth: 72,
    sortable: true,
    extract: (e) => formatInitiator(e.harEntry._initiator),
    getSortValue: (e) => formatInitiator(e.harEntry._initiator).toLowerCase(),
  },
  cookies: {
    key: 'cookies',
    label: 'Cookies',
    defaultWidth: 72,
    minWidth: 56,
    align: 'right',
    sortable: true,
    extract: (e) => {
      const n = countRequestCookies(e);
      return n > 0 ? n : null;
    },
    getSortValue: (e) => countRequestCookies(e),
  },
  setCookies: {
    key: 'setCookies',
    label: 'Set Cookies',
    defaultWidth: 84,
    minWidth: 64,
    align: 'right',
    sortable: true,
    extract: (e) => {
      const n = countSetCookies(e);
      return n > 0 ? n : null;
    },
    getSortValue: (e) => countSetCookies(e),
  },
  size: {
    key: 'size',
    label: 'Size',
    // Two-number form `13 kB / 42 kB` (transferred / resource) eats a
    // bit more horizontal space than a single number — default wide
    // enough to read both without truncation on typical bundles.
    defaultWidth: 110,
    minWidth: 72,
    align: 'right',
    sortable: true,
    // `extract` is a string fallback used when the rich renderer in
    // TrafficList doesn't override. The live path drives off
    // `getSizeInfo(entry, state)` so pending / cached / two-number
    // display is handled in the cell renderer.
    extract: (e) => formatSize(e.responseSize) || null,
    // Sort by wire-bytes (what the user paid for); -1 for pending /
    // cached rows so they sort to the bottom.
    getSortValue: (e) => (typeof e.responseSize === 'number' ? e.responseSize : -1),
  },
  time: {
    key: 'time',
    label: 'Time',
    defaultWidth: 72,
    minWidth: 56,
    align: 'right',
    sortable: true,
    extract: (e) => formatDuration(e.duration) || null,
    getSortValue: (e) => e.duration ?? -1,
  },
  priority: {
    key: 'priority',
    label: 'Priority',
    defaultWidth: 92,
    minWidth: 64,
    sortable: true,
    extract: (e) => priority(e) || null,
    getSortValue: (e) => priority(e),
  },
  timestamp: {
    key: 'timestamp',
    label: 'Timestamp',
    defaultWidth: 108,
    minWidth: 80,
    sortable: true,
    extract: (e) => formatTimestamp(e.timestamp),
    getSortValue: (e) => e.timestamp,
  },
  waterfall: {
    key: 'waterfall',
    label: 'Waterfall',
    defaultWidth: 220,
    minWidth: 120,
    stretch: true,
    sortable: false,
    // Waterfall is rendered by a dedicated component — extract/sort
    // are unused but present for registry uniformity.
    extract: () => null,
    getSortValue: (e) => e.timestamp,
  },
};

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'timestamp',
  'method',
  'name',
  'status',
  'type',
  'initiator',
  'size',
  'time',
];

export const ALL_COLUMN_KEYS: ColumnKey[] = Object.keys(COLUMN_DEFS) as ColumnKey[];

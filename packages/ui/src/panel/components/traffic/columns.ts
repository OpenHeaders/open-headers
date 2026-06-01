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
 *   - `extract` — derivation from an `InspectorRowWithFires` to the
 *     cell's string/number content; `null` when the cell should render
 *     nothing
 *
 * Sort values are owned by `data/network-columns.ts` so the comparator
 * chain doesn't need to import the React-side registry; `getSortValue`
 * here delegates 1:1 to that pure module.
 */

import { formatHttpVersion } from '../../data/http-version';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleTransferredBytes,
} from '../../data/inspector-row-projection';
import { getColumnSortValue, type SortableColumnKey } from '../../data/network-columns';
import { formatBytesToKb } from '../../data/size-info';
import { formatDuration, formatInitiator, formatTimestamp } from './formatters';
import { normalizeResourceType, RESOURCE_LABEL } from './resource-types';

export type ColumnKey = SortableColumnKey;

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** Initial width in px. Pre-resize grid starts with this. */
  defaultWidth: number;
  /** Hard floor for user resizing. Defaults to 40 when omitted. */
  minWidth?: number;
  /** When true, the column absorbs remaining space up to `maxWidth`. */
  stretch?: boolean;
  /** Upper bound for stretchy columns. Ignored for non-stretchy
   * columns. Defaults to `defaultWidth * 3` when omitted. */
  maxWidth?: number;
  align?: 'left' | 'right';
  /** Whether this column participates in sorting. */
  sortable: boolean;
  extract: (row: InspectorRowWithFires) => string | number | null;
  getSortValue: (row: InspectorRowWithFires) => string | number;
}

export const DEFAULT_COLUMN_MIN_WIDTH = 40;

/**
 * Resolve the CSS grid-track expression for a column given an
 * optional user-override width. Stretchy columns without an override
 * use `minmax(<default>, 1fr)` so they absorb remaining space;
 * everything else is a fixed pixel track that the user can drag.
 */
export function columnTrack(col: ColumnDef, override: number | undefined, compact: boolean = false): string {
  if (override != null) return `${Math.max(override, col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH)}px`;
  if (col.stretch) {
    if (compact) return `minmax(${col.minWidth ?? col.defaultWidth}px, 1fr)`;
    const max = col.maxWidth ?? col.defaultWidth * 3;
    return `minmax(${col.defaultWidth}px, ${max}px)`;
  }
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

function countSetCookies(row: InspectorRowWithFires): number {
  const headers = currentHarEntry(row.lifecycle)?.response?.headers ?? [];
  let n = 0;
  for (const h of headers) if (h.name.toLowerCase() === 'set-cookie') n++;
  return n;
}

function countRequestCookies(row: InspectorRowWithFires): number {
  return currentHarEntry(row.lifecycle)?.request?.cookies?.length ?? 0;
}

function priority(row: InspectorRowWithFires): string {
  const p = currentHarEntry(row.lifecycle)?._priority;
  return typeof p === 'string' ? p : '';
}

const delegateSort = (key: ColumnKey) => (row: InspectorRowWithFires) => getColumnSortValue(key, row);

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  name: {
    key: 'name',
    label: 'Name',
    defaultWidth: 110,
    minWidth: 100,
    stretch: true,
    maxWidth: 320,
    sortable: true,
    extract: (r) => r.lifecycle.url,
    getSortValue: delegateSort('name'),
  },
  method: {
    key: 'method',
    label: 'Method',
    defaultWidth: 120,
    minWidth: 52,
    sortable: true,
    extract: (r) => r.lifecycle.method,
    getSortValue: delegateSort('method'),
  },
  path: {
    key: 'path',
    label: 'Path',
    defaultWidth: 200,
    minWidth: 80,
    sortable: true,
    extract: (r) => safePath(r.lifecycle.url),
    getSortValue: delegateSort('path'),
  },
  url: {
    key: 'url',
    label: 'URL',
    defaultWidth: 260,
    minWidth: 120,
    sortable: true,
    extract: (r) => r.lifecycle.url,
    getSortValue: delegateSort('url'),
  },
  status: {
    key: 'status',
    label: 'Status',
    defaultWidth: 120,
    minWidth: 48,
    sortable: true,
    extract: (r) => r.lifecycle.statusCode ?? null,
    getSortValue: delegateSort('status'),
  },
  protocol: {
    key: 'protocol',
    label: 'Protocol',
    defaultWidth: 80,
    minWidth: 52,
    sortable: true,
    extract: (r) => {
      const har = currentHarEntry(r.lifecycle);
      return formatHttpVersion(har?.response?.httpVersion ?? har?.request?.httpVersion ?? '');
    },
    getSortValue: delegateSort('protocol'),
  },
  scheme: {
    key: 'scheme',
    label: 'Scheme',
    defaultWidth: 72,
    minWidth: 48,
    sortable: true,
    extract: (r) => safeScheme(r.lifecycle.url),
    getSortValue: delegateSort('scheme'),
  },
  domain: {
    key: 'domain',
    label: 'Domain',
    defaultWidth: 160,
    minWidth: 80,
    sortable: true,
    extract: (r) => safeHost(r.lifecycle.url),
    getSortValue: delegateSort('domain'),
  },
  remoteAddress: {
    key: 'remoteAddress',
    label: 'Remote address',
    defaultWidth: 140,
    minWidth: 100,
    sortable: true,
    extract: (r) => currentHarEntry(r.lifecycle)?.serverIPAddress ?? '',
    getSortValue: delegateSort('remoteAddress'),
  },
  type: {
    key: 'type',
    label: 'Type',
    defaultWidth: 80,
    minWidth: 56,
    sortable: true,
    extract: (r) => RESOURCE_LABEL[normalizeResourceType(r.lifecycle.resourceType)] ?? 'other',
    getSortValue: delegateSort('type'),
  },
  initiator: {
    key: 'initiator',
    label: 'Initiator',
    defaultWidth: 140,
    minWidth: 72,
    sortable: true,
    extract: (r) => formatInitiator(currentHarEntry(r.lifecycle)?._initiator),
    getSortValue: delegateSort('initiator'),
  },
  cookies: {
    key: 'cookies',
    label: 'Cookies',
    defaultWidth: 72,
    minWidth: 56,
    align: 'right',
    sortable: true,
    extract: (r) => {
      const n = countRequestCookies(r);
      return n > 0 ? n : null;
    },
    getSortValue: delegateSort('cookies'),
  },
  setCookies: {
    key: 'setCookies',
    label: 'Set Cookies',
    defaultWidth: 84,
    minWidth: 64,
    align: 'right',
    sortable: true,
    extract: (r) => {
      const n = countSetCookies(r);
      return n > 0 ? n : null;
    },
    getSortValue: delegateSort('setCookies'),
  },
  size: {
    key: 'size',
    label: 'Size',
    defaultWidth: 110,
    minWidth: 72,
    align: 'right',
    sortable: true,
    extract: (r) => {
      const bs = lifecycleTransferredBytes(r.lifecycle);
      return bs == null ? null : formatBytesToKb(bs);
    },
    getSortValue: delegateSort('size'),
  },
  time: {
    key: 'time',
    label: 'Time',
    defaultWidth: 72,
    minWidth: 56,
    align: 'right',
    sortable: true,
    extract: (r) => {
      const har = currentHarEntry(r.lifecycle);
      const harTime = har?.time;
      if (typeof harTime === 'number' && harTime > 0) return formatDuration(harTime) || null;
      const lc = r.lifecycle;
      if (lc.completedAtMs != null) {
        const d = lc.completedAtMs - lc.startedAtMs;
        if (d > 0) return formatDuration(d) || null;
      }
      return null;
    },
    getSortValue: delegateSort('time'),
  },
  priority: {
    key: 'priority',
    label: 'Priority',
    defaultWidth: 92,
    minWidth: 64,
    sortable: true,
    extract: (r) => priority(r) || null,
    getSortValue: delegateSort('priority'),
  },
  timestamp: {
    key: 'timestamp',
    label: 'Timestamp',
    defaultWidth: 108,
    minWidth: 80,
    sortable: true,
    extract: (r) => formatTimestamp(r.lifecycle.startedAtMs),
    getSortValue: delegateSort('timestamp'),
  },
  waterfall: {
    key: 'waterfall',
    label: 'Waterfall',
    defaultWidth: 120,
    minWidth: 120,
    stretch: true,
    maxWidth: 280,
    sortable: false,
    extract: () => null,
    getSortValue: delegateSort('waterfall'),
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

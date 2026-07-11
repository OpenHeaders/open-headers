/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * Cache Storage entries grid — the network table's `NetworkColumnInfo`
 * idiom: every popover leads with the same canonical stored entry, the
 * column's own slice highlighted.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type CacheEntryColumnKey = 'request' | 'method' | 'size' | 'time';

/** The single stored entry every column popover illustrates. */
const EX = {
  method: 'GET',
  request: 'https://openheaders.io/assets/app.js',
  size: '1.2 kB',
  time: 'Jan 4, 2027, 18:00:00',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({ column }: { column: CacheEntryColumnKey }) {
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example entry</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('method', EX.method, 'dt-col-eg-method')} {tok('request', EX.request)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {tok('size', EX.size)}
          {' · stored '}
          {tok('time', EX.time)}
        </div>
      </div>
    </div>
  );
}

const CACHE_ENTRY_COLUMN_INFO: Record<CacheEntryColumnKey, InfoPopoverContent> = {
  request: {
    title: 'Request',
    kicker: 'Cache Storage',
    summary: "The stored request's URL — the key the cache matches fetches against.",
    description:
      'Hovering a row adds a bounded preview of the stored request headers. Click a row to open the stored response as an editor tab; the grid keeps metadata only.',
    diagram: <ExampleCard column="request" />,
  },
  method: {
    title: 'Method',
    kicker: 'Cache Storage',
    summary: 'The stored request\'s HTTP method — part of the cache key alongside the URL.',
    description: 'Almost always GET: the Cache API rejects put / add for other methods.',
    diagram: <ExampleCard column="method" />,
  },
  size: {
    title: 'Size',
    kicker: 'Cache Storage',
    summary: "The stored response's size, read from its content-length header.",
    description:
      'An em dash means the stored response carries no content-length — the body is still there, in the entry\'s editor tab.',
    diagram: <ExampleCard column="size" />,
  },
  time: {
    title: 'Time',
    kicker: 'Cache Storage',
    summary: 'When the response was stored in the cache.',
    description: 'Only derivable on attached tabs — an em dash means the host couldn\'t read it for this scope.',
    diagram: <ExampleCard column="time" />,
  },
};

export function CacheEntryColumnInfo({ infoKey }: { infoKey: CacheEntryColumnKey }) {
  return (
    <InfoTrigger
      content={CACHE_ENTRY_COLUMN_INFO[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

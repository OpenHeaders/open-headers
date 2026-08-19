/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * Cache Storage entries grid — the network table's `NetworkColumnInfo`
 * idiom: every popover leads with the same canonical stored entry, the
 * column's own slice highlighted. Titles stay the raw column nouns;
 * the example payload rides raw.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type CacheEntryColumnKey = 'request' | 'method' | 'size' | 'time';

/** The single stored entry every column popover illustrates. */
const EX = {
  method: 'GET',
  request: 'https://openheaders.com/assets/app.js',
  size: '1.2 kB',
  time: 'Jan 4, 2027, 18:00:00',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({ column, caption }: { column: CacheEntryColumnKey; caption: string }) {
  const t = useT();
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{caption}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('method', EX.method, 'dt-col-eg-method')} {tok('request', EX.request)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {tok('size', EX.size)} {t('panel.storage.cacheCol.exampleStored')} {tok('time', EX.time)}
        </div>
      </div>
    </div>
  );
}

function cacheEntryColumnInfo(t: Translate): Record<CacheEntryColumnKey, InfoPopoverContent> {
  const kicker = t('panel.storage.nav.cachestorage');
  const caption = t('panel.storage.cacheCol.exampleCaption');
  return {
    request: {
      title: 'Request',
      kicker,
      summary: t('panel.storage.cacheCol.request.summary'),
      description: t('panel.storage.cacheCol.request.description'),
      diagram: <ExampleCard column="request" caption={caption} />,
    },
    method: {
      title: 'Method',
      kicker,
      summary: t('panel.storage.cacheCol.method.summary'),
      description: t('panel.storage.cacheCol.method.description'),
      diagram: <ExampleCard column="method" caption={caption} />,
    },
    size: {
      title: 'Size',
      kicker,
      summary: t('panel.storage.cacheCol.size.summary'),
      description: t('panel.storage.cacheCol.size.description'),
      diagram: <ExampleCard column="size" caption={caption} />,
    },
    time: {
      title: 'Time',
      kicker,
      summary: t('panel.storage.cacheCol.time.summary'),
      description: t('panel.storage.cacheCol.time.description'),
      diagram: <ExampleCard column="time" caption={caption} />,
    },
  };
}

export function CacheEntryColumnInfo({ infoKey }: { infoKey: CacheEntryColumnKey }) {
  const t = useT();
  return (
    <InfoTrigger
      content={cacheEntryColumnInfo(t)[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

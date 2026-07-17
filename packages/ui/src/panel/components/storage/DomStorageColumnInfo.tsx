/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * DOM storage grid (Local / Session storage) — the network table's
 * `NetworkColumnInfo` idiom: a hover-revealed glyph in the column
 * header that opens an `<InfoPopover>`, every popover leading with the
 * same canonical example rendered as a compact card. The column's own
 * slice of that example is the highlighted token, so reading across
 * the popovers builds one coherent picture of a single entry. Titles
 * stay the raw column nouns; the localStorage / sessionStorage globals
 * ride raw inside the keyed copy.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { DomStorageArea } from '../../data/storage/storage-inspector-host';

export type DomStorageColumnKey = 'key' | 'value';

/** The single write every column popover illustrates. */
const EX = {
  key: "'oh:session'",
  value: '\'{"user":"ada","theme":"dark"}\'',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({
  column,
  area,
  caption,
}: {
  column: DomStorageColumnKey;
  area: DomStorageArea;
  caption: string;
}) {
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{caption}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {area === 'session' ? 'sessionStorage' : 'localStorage'}
          <span className="dt-col-eg-sep">.setItem(</span>
        </div>
        <div className="dt-col-eg-line">
          {'  '}
          {tok('key', EX.key)}
          <span className="dt-col-eg-sep">, </span>
          {tok('value', EX.value)}
        </div>
        <div className="dt-col-eg-line">
          <span className="dt-col-eg-sep">)</span>
        </div>
      </div>
    </div>
  );
}

function domStorageColumnInfo(t: Translate, area: DomStorageArea): Record<DomStorageColumnKey, InfoPopoverContent> {
  const areaName = area === 'session' ? 'sessionStorage' : 'localStorage';
  const kicker = t(area === 'session' ? 'panel.storage.nav.session' : 'panel.storage.nav.local');
  const caption = t('panel.storage.domCol.exampleCaption');
  return {
    key: {
      title: 'Key',
      kicker,
      summary: t('panel.storage.domCol.key.summary', { area: areaName }),
      description: t('panel.storage.domCol.key.description'),
      diagram: <ExampleCard column="key" area={area} caption={caption} />,
    },
    value: {
      title: 'Value',
      kicker,
      summary: t('panel.storage.domCol.value.summary'),
      description: t('panel.storage.domCol.value.description'),
      diagram: <ExampleCard column="value" area={area} caption={caption} />,
    },
  };
}

export function DomStorageColumnInfo({ infoKey, area }: { infoKey: DomStorageColumnKey; area: DomStorageArea }) {
  const t = useT();
  return (
    <InfoTrigger
      content={domStorageColumnInfo(t, area)[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

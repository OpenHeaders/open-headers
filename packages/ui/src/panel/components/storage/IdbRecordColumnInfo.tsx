/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * IndexedDB records grid — the network table's `NetworkColumnInfo`
 * idiom: every popover leads with the same canonical example record,
 * the column's own slice highlighted. Titles stay the raw column
 * nouns; the example payload rides raw.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type IdbRecordColumnKey = 'key' | 'value';

/** The single record every column popover illustrates. */
const EX = {
  scope: 'app › users',
  key: '41',
  value: '{id: 41, user: "ada", roles: Array(2)}',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({ column, caption }: { column: IdbRecordColumnKey; caption: string }) {
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{caption}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line dt-col-eg-meta">{EX.scope}</div>
        <div className="dt-col-eg-line">
          {tok('key', EX.key)}
          <span className="dt-col-eg-sep"> → </span>
          {tok('value', EX.value)}
        </div>
      </div>
    </div>
  );
}

function idbRecordColumnInfo(t: Translate): Record<IdbRecordColumnKey, InfoPopoverContent> {
  const kicker = t('panel.storage.nav.indexeddb');
  const caption = t('panel.storage.idbCol.exampleCaption');
  return {
    key: {
      title: 'Key',
      kicker,
      summary: t('panel.storage.idbCol.key.summary'),
      description: t('panel.storage.idbCol.key.description'),
      diagram: <ExampleCard column="key" caption={caption} />,
    },
    value: {
      title: 'Value',
      kicker,
      summary: t('panel.storage.idbCol.value.summary'),
      description: t('panel.storage.idbCol.value.description'),
      diagram: <ExampleCard column="value" caption={caption} />,
    },
  };
}

export function IdbRecordColumnInfo({ infoKey }: { infoKey: IdbRecordColumnKey }) {
  const t = useT();
  return (
    <InfoTrigger
      content={idbRecordColumnInfo(t)[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

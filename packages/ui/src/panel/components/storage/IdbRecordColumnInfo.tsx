/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * IndexedDB records grid — the network table's `NetworkColumnInfo`
 * idiom: every popover leads with the same canonical example record,
 * the column's own slice highlighted.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

export type IdbRecordColumnKey = 'key' | 'value';

/** The single record every column popover illustrates. */
const EX = {
  key: '41',
  value: '{id: 41, user: "ada", roles: Array(2)}',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({ column }: { column: IdbRecordColumnKey }) {
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example record</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line dt-col-eg-meta">app › users</div>
        <div className="dt-col-eg-line">
          {tok('key', EX.key)}
          <span className="dt-col-eg-sep"> → </span>
          {tok('value', EX.value)}
        </div>
      </div>
    </div>
  );
}

const IDB_RECORD_COLUMN_INFO: Record<IdbRecordColumnKey, InfoPopoverContent> = {
  key: {
    title: 'Key',
    kicker: 'IndexedDB',
    summary:
      "The record's key under the current cursor — the store's primary key by default; picking an index in the breadcrumb reads through it, and this column becomes the index key.",
    description:
      'Hovering a row shows both keys (cursor key and primary key). Keys can be numbers, strings, dates, or arrays of those.',
    diagram: <ExampleCard column="key" />,
  },
  value: {
    title: 'Value',
    kicker: 'IndexedDB',
    summary: "A one-line preview of the record's structured-clone value, serialized in the page.",
    description:
      'Click a row to open the full record as an editor tab with the expandable tree; the grid keeps only the preview.',
    diagram: <ExampleCard column="value" />,
  },
};

export function IdbRecordColumnInfo({ infoKey }: { infoKey: IdbRecordColumnKey }) {
  return (
    <InfoTrigger
      content={IDB_RECORD_COLUMN_INFO[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

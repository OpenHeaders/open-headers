/**
 * Per-column `(i)` info-popover content for the Storage tool window's
 * DOM storage grid (Local / Session storage) — the network table's
 * `NetworkColumnInfo` idiom: a hover-revealed glyph in the column
 * header that opens an `<InfoPopover>`, every popover leading with the
 * same canonical example rendered as a compact card. The column's own
 * slice of that example is the highlighted token, so reading across
 * the popovers builds one coherent picture of a single entry.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { DomStorageArea } from '../../data/storage/storage-inspector-host';

export type DomStorageColumnKey = 'key' | 'value';

/** The single write every column popover illustrates. */
const EX = {
  key: "'oh:session'",
  value: '\'{"user":"ada","theme":"dark"}\'',
} as const;

type TokenId = keyof typeof EX;

function ExampleCard({ column, area }: { column: DomStorageColumnKey; area: DomStorageArea }) {
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example write</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {area === 'session' ? 'sessionStorage' : 'localStorage'}
          <span className="dt-col-eg-sep">.setItem(</span>
        </div>
        <div className="dt-col-eg-line">
          {'  '}
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

function domStorageColumnInfo(area: DomStorageArea): Record<DomStorageColumnKey, InfoPopoverContent> {
  const areaName = area === 'session' ? 'sessionStorage' : 'localStorage';
  return {
    key: {
      title: 'Key',
      kicker: area === 'session' ? 'Session storage' : 'Local storage',
      summary: `The entry's name — a case-sensitive string, unique within this origin's ${areaName}. Writing an existing key overwrites its value.`,
      description:
        'Renaming an entry here writes the new key first, then removes the old one — a failed write never loses the original.',
      diagram: <ExampleCard column="key" area={area} />,
    },
    value: {
      title: 'Value',
      kicker: area === 'session' ? 'Session storage' : 'Local storage',
      summary:
        'The stored payload — always a string; pages keep structured data serialized, usually as JSON.',
      description:
        'The grid shows a one-line preview and clips very long values — opening or editing an entry fetches the full text. Click a row to open it as an editor tab; double-click (or the pencil) edits inline.',
      diagram: <ExampleCard column="value" area={area} />,
    },
  };
}

export function DomStorageColumnInfo({ infoKey, area }: { infoKey: DomStorageColumnKey; area: DomStorageArea }) {
  return (
    <InfoTrigger
      content={domStorageColumnInfo(area)[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

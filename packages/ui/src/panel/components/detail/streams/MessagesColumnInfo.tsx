/**
 * Per-column `(i)` info-popover content for the Messages frame grid —
 * the same idiom as the network table's `NetworkColumnInfo`: a
 * hover-revealed glyph in the column header that opens an
 * `<InfoPopover>`, every popover leading with the same canonical
 * example frame rendered as a compact card. The column's own slice of
 * that frame is the highlighted token, so reading across the popovers
 * builds one coherent picture of a single frame seen column by column.
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';
import type { WsColumnKey } from './ws-grid';

/** The single frame every column popover illustrates. */
const EX = {
  dir: '⬆',
  data: '{"type":"ping","seq":4}',
  length: '23',
  time: '12:15:37.144',
} as const;

type TokenId = 'dir' | 'data' | 'length' | 'time';

/** Which token of the example each header lights up. The direction rail
 * shares the card via `WS_DIRECTION_INFO` below. */
const HIGHLIGHT: Record<WsColumnKey | 'dir', TokenId> = {
  dir: 'dir',
  data: 'data',
  length: 'length',
  time: 'time',
};

function ExampleCard({ column }: { column: WsColumnKey | 'dir' }) {
  const t = useT();
  const lit = HIGHLIGHT[column];
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${lit === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('panel.inspector.messages.columnInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('dir', EX.dir, 'dt-col-eg-method')} {tok('data', EX.data)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {tok('length', EX.length)}
          {' chars · '}
          {tok('time', EX.time)}
        </div>
      </div>
    </div>
  );
}

function messagesColumnInfo(t: Translate, key: WsColumnKey): InfoPopoverContent {
  const kicker = t('panel.inspector.sections.messages');
  switch (key) {
    case 'data':
      return {
        title: 'Data',
        kicker,
        summary: t('panel.inspector.messages.columnInfo.data.summary'),
        description: t('panel.inspector.messages.columnInfo.data.description'),
        diagram: <ExampleCard column="data" />,
        sections: [
          {
            heading: t('panel.inspector.messages.columnInfo.data.insteadHeading'),
            items: [
              { label: 'Binary Message', desc: t('panel.inspector.messages.columnInfo.data.binaryDesc') },
              { label: 'Ping / Pong Message', desc: t('panel.inspector.messages.columnInfo.data.pingPongDesc') },
              { label: 'Connection Close Message', desc: t('panel.inspector.messages.columnInfo.data.closeDesc') },
            ],
          },
        ],
      };
    case 'length':
      return {
        title: 'Length',
        kicker,
        summary: t('panel.inspector.messages.columnInfo.length.summary'),
        diagram: <ExampleCard column="length" />,
      };
    case 'time':
      return {
        title: 'Time',
        kicker,
        summary: t('panel.inspector.messages.columnInfo.time.summary'),
        description: t('panel.inspector.messages.columnInfo.time.description'),
        diagram: <ExampleCard column="time" />,
      };
  }
}

/** The direction rail's whole-cell hover popover (no room for an (i) at 20px). */
export function wsDirectionInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.messages.directionInfo.title'),
    kicker: t('panel.inspector.sections.messages'),
    summary: t('panel.inspector.messages.directionInfo.summary'),
    diagram: <ExampleCard column="dir" />,
    sections: [
      {
        heading: t('panel.inspector.messages.directionInfo.arrowsHeading'),
        items: [
          {
            label: '⬆',
            desc: t('panel.inspector.messages.directionInfo.sentDesc'),
            labelClassName: 'dt-ws-eg-dir--send',
          },
          {
            label: '⬇',
            desc: t('panel.inspector.messages.directionInfo.receivedDesc'),
            labelClassName: 'dt-ws-eg-dir--recv',
          },
          {
            label: '⚠',
            desc: t('panel.inspector.messages.directionInfo.errorDesc'),
            labelClassName: 'dt-ws-eg-dir--error',
          },
        ],
      },
    ],
  };
}

/** The fire rail's whole-cell hover popover — honest about inference:
 * frames carry no rule attribution, so the dot is derived from the
 * request's rule fires × each rule's frame selector. The kicker is the
 * raw brand mark. */
export function wsFireRailInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.streams.fireRail.title'),
    kicker: 'OpenHeaders',
    summary: t('panel.inspector.messages.fireRail.summary'),
    sections: [
      {
        heading: t('panel.inspector.streams.fireRail.dotColorsHeading'),
        items: [
          {
            label: '●',
            labelClassName: 'dt-fire-eg--auth',
            desc: t('panel.inspector.messages.fireRail.appliedDesc'),
          },
          {
            label: '●',
            labelClassName: 'dt-fire-eg--inferred',
            desc: t('panel.inspector.messages.fireRail.inferredDesc'),
          },
        ],
      },
    ],
    description: t('panel.inspector.messages.fireRail.description'),
  };
}

export function MessagesColumnInfo({ infoKey }: { infoKey: WsColumnKey }) {
  const t = useT();
  const content = useMemo(() => messagesColumnInfo(t, infoKey), [t, infoKey]);
  return <InfoTrigger content={content} className="dt-header-info-trigger dt-col-info-trigger" />;
}

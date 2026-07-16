/**
 * Per-column `(i)` info-popover content for the EventStream grid — the
 * Messages grid's idiom (`MessagesColumnInfo`) applied to server-sent
 * events: every popover leads with the same canonical example event
 * rendered as a compact card, the column's own slice highlighted.
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';
import type { SseColumnKey } from './sse-grid';

/** The single event every column popover illustrates. */
const EX = {
  id: '42',
  type: 'price',
  data: '{"symbol":"OH","usd":7}',
  time: '12:15:37.144',
} as const;

type TokenId = SseColumnKey;

function ExampleCard({ column }: { column: SseColumnKey }) {
  const t = useT();
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">{t('panel.inspector.sse.columnInfo.exampleCaption')}</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('type', EX.type)} {tok('data', EX.data)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {'id '}
          {tok('id', EX.id)}
          {' · '}
          {tok('time', EX.time)}
        </div>
      </div>
    </div>
  );
}

function sseColumnInfo(t: Translate, key: SseColumnKey): InfoPopoverContent {
  const kicker = t('panel.inspector.sections.eventStream');
  switch (key) {
    case 'id':
      return {
        title: 'Id',
        kicker,
        summary: t('panel.inspector.sse.columnInfo.id.summary'),
        description: t('panel.inspector.sse.columnInfo.id.description'),
        diagram: <ExampleCard column="id" />,
      };
    case 'type':
      return {
        title: 'Type',
        kicker,
        summary: t('panel.inspector.sse.columnInfo.type.summary'),
        description: t('panel.inspector.sse.columnInfo.type.description'),
        diagram: <ExampleCard column="type" />,
      };
    case 'data':
      return {
        title: 'Data',
        kicker,
        summary: t('panel.inspector.sse.columnInfo.data.summary'),
        description: t('panel.inspector.sse.columnInfo.data.description'),
        diagram: <ExampleCard column="data" />,
      };
    case 'time':
      return {
        title: 'Time',
        kicker,
        summary: t('panel.inspector.sse.columnInfo.time.summary'),
        description: t('panel.inspector.sse.columnInfo.time.description'),
        diagram: <ExampleCard column="time" />,
      };
  }
}

/** The fire rail's whole-cell hover popover — honest about inference:
 * events carry no rule attribution, so a capture-less dot is derived
 * from the request's rule fires × each rule's event selector. The
 * kicker is the raw brand mark. */
export function sseFireRailInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.streams.fireRail.title'),
    kicker: 'OpenHeaders',
    summary: t('panel.inspector.sse.fireRail.summary'),
    sections: [
      {
        heading: t('panel.inspector.streams.fireRail.dotColorsHeading'),
        items: [
          { label: '●', labelClassName: 'dt-fire-eg--auth', desc: t('panel.inspector.sse.fireRail.appliedDesc') },
          {
            label: '●',
            labelClassName: 'dt-fire-eg--inferred',
            desc: t('panel.inspector.sse.fireRail.inferredDesc'),
          },
        ],
      },
    ],
    description: t('panel.inspector.sse.fireRail.description'),
  };
}

export function SseColumnInfo({ infoKey }: { infoKey: SseColumnKey }) {
  const t = useT();
  const content = useMemo(() => sseColumnInfo(t, infoKey), [t, infoKey]);
  return <InfoTrigger content={content} className="dt-header-info-trigger dt-col-info-trigger" />;
}

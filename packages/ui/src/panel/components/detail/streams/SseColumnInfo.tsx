/**
 * Per-column `(i)` info-popover content for the EventStream grid — the
 * Messages grid's idiom (`MessagesColumnInfo`) applied to server-sent
 * events: every popover leads with the same canonical example event
 * rendered as a compact card, the column's own slice highlighted.
 */

import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
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
  const tok = (id: TokenId, text: string) => (
    <span className={`dt-col-eg-tok${column === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example event</div>
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

const SSE_COLUMN_INFO: Record<SseColumnKey, InfoPopoverContent> = {
  id: {
    title: 'Id',
    kicker: 'EventStream',
    summary: "The event's `id:` field — the reconnection cursor the server hands out.",
    description:
      'Empty when the server sends no id. On reconnect the browser echoes the last id back as ' +
      '`Last-Event-ID`, so the server can resume the stream where it left off.',
    diagram: <ExampleCard column="id" />,
  },
  type: {
    title: 'Type',
    kicker: 'EventStream',
    summary: "The event's `event:` field — `message` for default events.",
    description:
      'Page code subscribes per type: `onmessage` only sees default events; named events need ' +
      'an `addEventListener` for that exact type.',
    diagram: <ExampleCard column="type" />,
  },
  data: {
    title: 'Data',
    kicker: 'EventStream',
    summary: 'The event payload — always text; multi-line `data:` fields arrive joined.',
    description: 'Select a row to open the payload viewer: a JSON tree when the text parses, verbatim otherwise.',
    diagram: <ExampleCard column="data" />,
  },
  time: {
    title: 'Time',
    kicker: 'EventStream',
    summary: 'The wall-clock moment the event arrived.',
    description:
      'Sortable, ascending by default. Events parsed out of a finished response body carry no time — the SSE ' +
      'wire format has none — so their cells stay empty.',
    diagram: <ExampleCard column="time" />,
  },
};

/** The fire rail's whole-cell hover popover — honest about inference:
 * events carry no rule attribution, so a capture-less dot is derived
 * from the request's rule fires × each rule's event selector. */
export const SSE_FIRE_RAIL_INFO: InfoPopoverContent = {
  title: 'Rule fires',
  kicker: 'OpenHeaders',
  summary:
    'A dot marks each event an SSE message rule acted on. A wrapper-recorded capture is proof; without one the ' +
    "dot is derived: this request's fired SSE rules, each rule's event selector re-run against the event.",
  sections: [
    {
      heading: 'Dot colors',
      items: [
        {
          label: '●',
          labelClassName: 'dt-fire-eg--auth',
          desc: 'Applied — the wrapper recorded acting on this exact event, or an injected payload matches.',
        },
        {
          label: '●',
          labelClassName: 'dt-fire-eg--inferred',
          desc:
            "Inferred — the rule's event name and data filter select this event, but application is not " +
            'verifiable from the wire alone.',
        },
      ],
    },
  ],
  description:
    'Server-sent events only travel server → page, and the wire records them before the rule acts: a dropped ' +
    'event keeps its row, marked "Dropped — never delivered to the page"; an injected event never crosses the ' +
    'wire and shows as a synthetic row.',
};

export function SseColumnInfo({ infoKey }: { infoKey: SseColumnKey }) {
  return <InfoTrigger content={SSE_COLUMN_INFO[infoKey]} className="dt-header-info-trigger dt-col-info-trigger" />;
}

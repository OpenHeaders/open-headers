/**
 * Per-column `(i)` info-popover content for the Messages frame grid —
 * the same idiom as the network table's `NetworkColumnInfo`: a
 * hover-revealed glyph in the column header that opens an
 * `<InfoPopover>`, every popover leading with the same canonical
 * example frame rendered as a compact card. The column's own slice of
 * that frame is the highlighted token, so reading across the popovers
 * builds one coherent picture of a single frame seen column by column.
 */

import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
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
  const lit = HIGHLIGHT[column];
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${lit === id ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example frame</div>
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

const MESSAGES_COLUMN_INFO: Record<WsColumnKey, InfoPopoverContent> = {
  data: {
    title: 'Data',
    kicker: 'Messages',
    summary: 'The frame payload — text frames show their content verbatim.',
    description:
      'Select a row to open the payload viewer: a JSON tree when the text parses, a Base64 / Hex / UTF-8 viewer for binary frames.',
    diagram: <ExampleCard column="data" />,
    sections: [
      {
        heading: 'Instead of the payload',
        items: [
          { label: 'Binary Message', desc: 'A binary frame — the bytes live in the payload viewer, not the cell.' },
          { label: 'Ping / Pong Message', desc: 'Keepalive control frames exchanged by the endpoints.' },
          { label: 'Connection Close Message', desc: 'The closing handshake that ends the socket.' },
        ],
      },
    ],
  },
  length: {
    title: 'Length',
    kicker: 'Messages',
    summary: 'The payload size — a bare character count for text frames, formatted bytes (e.g. `4 B`) for binary frames.',
    diagram: <ExampleCard column="length" />,
  },
  time: {
    title: 'Time',
    kicker: 'Messages',
    summary: 'The wall-clock moment the frame crossed the wire.',
    description:
      'The one sortable column. Ascending is wire order; frames on the same millisecond keep their arrival order either way.',
    diagram: <ExampleCard column="time" />,
  },
};

/** The direction rail's whole-cell hover popover (no room for an (i) at 20px). */
export const WS_DIRECTION_INFO: InfoPopoverContent = {
  title: 'Direction',
  kicker: 'Messages',
  summary: 'Which way the frame traveled.',
  diagram: <ExampleCard column="dir" />,
  sections: [
    {
      heading: 'Arrows',
      items: [
        { label: '⬆', desc: 'Sent — the page pushed this frame to the server.', labelClassName: 'dt-ws-eg-dir--send' },
        {
          label: '⬇',
          desc: 'Received — the server pushed this frame to the page.',
          labelClassName: 'dt-ws-eg-dir--recv',
        },
        {
          label: '⚠',
          desc: 'Error — a transport failure ended the stream; the row reads red.',
          labelClassName: 'dt-ws-eg-dir--error',
        },
      ],
    },
  ],
};

/** The fire rail's whole-cell hover popover — honest about inference:
 * frames carry no rule attribution, so the dot is derived from the
 * request's rule fires × each rule's frame selector. */
export const WS_FIRE_RAIL_INFO: InfoPopoverContent = {
  title: 'Rule fires',
  kicker: 'OpenHeaders',
  summary:
    'A dot marks each frame a WebSocket message rule acted on. Frames carry no rule attribution, so the dot is ' +
    "derived: this request's fired message rules, each rule's frame selector re-run against the frame.",
  sections: [
    {
      heading: 'Dot colors',
      items: [
        {
          label: '●',
          labelClassName: 'dt-fire-eg--auth',
          desc: "Applied — the frame's payload equals the rule's replacement or injected payload.",
        },
        {
          label: '●',
          labelClassName: 'dt-fire-eg--inferred',
          desc:
            "Inferred — the rule's direction and message filter select this frame, but application is not " +
            'verifiable (a modified frame no longer holds the payload the filter matched).',
        },
      ],
    },
  ],
  description: 'Dropped frames never reach the capture plane, so drop rules leave no dots.',
};

export function MessagesColumnInfo({ infoKey }: { infoKey: WsColumnKey }) {
  return <InfoTrigger content={MESSAGES_COLUMN_INFO[infoKey]} className="dt-header-info-trigger dt-col-info-trigger" />;
}

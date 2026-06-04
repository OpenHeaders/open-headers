/**
 * Per-column `(i)` info-popover content for the network table. Same
 * pattern as the Cookies tab's `CookieColumnInfo` and the Headers tab's
 * `GeneralRow` — a hover-revealed glyph that opens an `<InfoPopover>`.
 *
 * Every popover leads with the same canonical example request rendered
 * as a compact card; the column's own slice of that request is the
 * highlighted token, so reading across all the popovers builds one
 * coherent picture of a single request seen column by column.
 */

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { ColumnKey } from './columns';

/** The single request every column popover illustrates. Holding one
 * example fixed across all popovers lets the user map each column onto
 * the same concrete row. */
const EX = {
  num: '7',
  method: 'GET',
  scheme: 'https',
  domain: 'api.openheaders.io',
  pathDir: '/v1/',
  name: 'users?page=2',
  status: '200',
  protocol: 'h2',
  type: 'fetch',
  remote: '203.0.113.42',
  initiator: 'app.js:128',
  size: '1.2 kB',
  time: '45 ms',
  priority: 'High',
  cookies: '3 cookies',
  setCookies: '1 set-cookie',
} as const;

type TokenId =
  | 'num'
  | 'method'
  | 'scheme'
  | 'domain'
  | 'pathDir'
  | 'name'
  | 'status'
  | 'protocol'
  | 'type'
  | 'remote'
  | 'initiator'
  | 'size'
  | 'time'
  | 'priority'
  | 'cookies'
  | 'setCookies';

/** Which token(s) of the example each column lights up. Path/URL/name
 * overlap inside the URL, so they highlight a group. Waterfall plots
 * timing, so it lights the Time token. */
const HIGHLIGHT: Record<ColumnKey, readonly TokenId[]> = {
  name: ['name'],
  path: ['pathDir', 'name'],
  url: ['scheme', 'domain', 'pathDir', 'name'],
  requestNumber: ['num'],
  method: ['method'],
  status: ['status'],
  protocol: ['protocol'],
  scheme: ['scheme'],
  domain: ['domain'],
  remoteAddress: ['remote'],
  type: ['type'],
  initiator: ['initiator'],
  cookies: ['cookies'],
  setCookies: ['setCookies'],
  size: ['size'],
  time: ['time'],
  priority: ['priority'],
  waterfall: ['time'],
};

function ExampleCard({ column }: { column: ColumnKey }) {
  const lit = new Set<TokenId>(HIGHLIGHT[column]);
  const tok = (id: TokenId, text: string, extra = '') => (
    <span className={`dt-col-eg-tok${extra ? ` ${extra}` : ''}${lit.has(id) ? ' dt-col-eg-hl' : ''}`}>{text}</span>
  );
  return (
    <div className="dt-col-eg">
      <div className="dt-col-eg-cap">Example request</div>
      <div className="dt-col-eg-card">
        <div className="dt-col-eg-line">
          {tok('num', `#${EX.num}`)}
          {' · '}
          {tok('method', EX.method, 'dt-col-eg-method')}
          {' · '}
          {tok('status', EX.status, 'dt-col-eg-status')}
        </div>
        <div className="dt-col-eg-line dt-col-eg-url">
          {tok('scheme', EX.scheme)}
          <span className="dt-col-eg-sep">://</span>
          {tok('domain', EX.domain)}
          {tok('pathDir', EX.pathDir)}
          {tok('name', EX.name)}
        </div>
        <div className="dt-col-eg-line dt-col-eg-meta">
          {tok('protocol', EX.protocol)}
          {' · '}
          {tok('type', EX.type)}
          {' · '}
          {tok('remote', EX.remote)}
          {' · '}
          {tok('initiator', EX.initiator)}
          {' · '}
          {tok('size', EX.size)}
          {' · '}
          {tok('time', EX.time)}
          {' · '}
          {tok('priority', EX.priority)}
          {' · '}
          {tok('cookies', EX.cookies)}
          {' · '}
          {tok('setCookies', EX.setCookies)}
        </div>
      </div>
    </div>
  );
}

const NETWORK_COLUMN_INFO: Record<ColumnKey, InfoPopoverContent> = {
  name: {
    title: 'Name',
    kicker: 'Network',
    summary: 'The resource\'s file name or last path segment — the quickest way to recognise a row.',
    description: 'The leading icon encodes the resource type; the row tooltip and the detail view carry the full URL, headers, payload, and timing.',
    diagram: <ExampleCard column="name" />,
  },
  path: {
    title: 'Path',
    kicker: 'Network',
    summary: 'Everything after the host — the URL path plus its query string.',
    diagram: <ExampleCard column="path" />,
  },
  url: {
    title: 'URL',
    kicker: 'Network',
    summary: 'The complete request URL: scheme, host, path, and query, end to end.',
    diagram: <ExampleCard column="url" />,
  },
  requestNumber: {
    title: 'Request #',
    kicker: 'Network',
    summary: 'A stable index assigned in the order requests were discovered while recording, starting at 1.',
    description: 'It never changes when you re-sort, so it doubles as a reference back to the original capture order.',
    diagram: <ExampleCard column="requestNumber" />,
  },
  method: {
    title: 'Method',
    kicker: 'Network',
    summary: 'The HTTP verb the request used.',
    diagram: <ExampleCard column="method" />,
    sections: [
      {
        heading: 'Common verbs',
        items: [
          { label: 'GET', desc: 'Read a resource — no body, safe to repeat.' },
          { label: 'POST', desc: 'Create or submit — carries a request body.' },
          { label: 'PUT / PATCH', desc: 'Replace or partially update a resource.' },
          { label: 'DELETE', desc: 'Remove a resource.' },
        ],
      },
    ],
  },
  status: {
    title: 'Status',
    kicker: 'Network',
    summary: 'The response status code. Its colour in the table tracks the range at a glance.',
    diagram: <ExampleCard column="status" />,
    sections: [
      {
        heading: 'Ranges (and row colour)',
        items: [
          { label: '2xx', desc: 'Success — shown green.' },
          { label: '3xx', desc: 'Redirection — shown amber; follow the Location header.' },
          { label: '4xx', desc: 'Client error — shown red; request was malformed or unauthorized.' },
          { label: '5xx', desc: 'Server error — shown red; the server failed a valid request.' },
        ],
      },
    ],
  },
  protocol: {
    title: 'Protocol',
    kicker: 'Network',
    summary: 'The HTTP version the connection negotiated, picked at handshake time.',
    diagram: <ExampleCard column="protocol" />,
    sections: [
      {
        heading: 'Values',
        items: [
          { label: 'http/1.1', desc: 'Text-based, one request in flight per connection.' },
          { label: 'h2', desc: 'HTTP/2 — binary and multiplexed over a single connection.' },
          { label: 'h3', desc: 'HTTP/3 — runs on QUIC over UDP for faster handshakes.' },
        ],
      },
    ],
  },
  scheme: {
    title: 'Scheme',
    kicker: 'Network',
    summary: 'The URL scheme — `https`, `http`, `ws`, or `wss`.',
    diagram: <ExampleCard column="scheme" />,
  },
  domain: {
    title: 'Domain',
    kicker: 'Network',
    summary: 'The host name the request was addressed to.',
    diagram: <ExampleCard column="domain" />,
  },
  remoteAddress: {
    title: 'Remote address',
    kicker: 'Network',
    summary: 'The IP address and port the connection actually reached.',
    description: 'Differs from the domain when DNS returns several IPs, a CDN routes by anycast, or a local proxy intercepts the connection.',
    diagram: <ExampleCard column="remoteAddress" />,
  },
  type: {
    title: 'Type',
    kicker: 'Network',
    summary: 'The resource type the browser assigned — it drives the row icon and the filter chips above the table.',
    diagram: <ExampleCard column="type" />,
    sections: [
      {
        heading: 'Examples',
        items: [
          { label: 'document', desc: 'A top-level or framed HTML navigation.' },
          { label: 'fetch / xhr', desc: 'A data request made from JavaScript.' },
          { label: 'script / css', desc: 'Page resources loaded by the parser.' },
          { label: 'img / font / media', desc: 'Static assets.' },
        ],
      },
    ],
  },
  initiator: {
    title: 'Initiator',
    kicker: 'Network',
    summary: 'What caused the request to be sent.',
    diagram: <ExampleCard column="initiator" />,
    sections: [
      {
        heading: 'Kinds',
        items: [
          { label: 'script', desc: 'Fired from JavaScript — the cell links to the call site.' },
          { label: 'parser', desc: 'The HTML parser found the resource (a `<script>`, `<img>`, `<link>`…).' },
          { label: 'redirect', desc: 'A `3xx` response sent the browser here.' },
          { label: 'other', desc: 'A navigation, a preload, or an unattributed source.' },
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookies',
    kicker: 'Network',
    summary: 'How many cookies the browser attached to the request in its `Cookie` header. Blank when none.',
    diagram: <ExampleCard column="cookies" />,
  },
  setCookies: {
    title: 'Set Cookies',
    kicker: 'Network',
    summary: 'How many `Set-Cookie` headers the response returned. Blank when none.',
    description: 'Open the request\'s Cookies tab to see whether the browser accepted or dropped each one.',
    diagram: <ExampleCard column="setCookies" />,
  },
  size: {
    title: 'Size',
    kicker: 'Network',
    summary: 'Bytes that crossed the wire, response headers and compression overhead included.',
    diagram: <ExampleCard column="size" />,
    sections: [
      {
        heading: 'Instead of a number',
        items: [
          { label: '(disk cache)', desc: 'Served from the on-disk cache — nothing hit the network.' },
          { label: '(memory cache)', desc: 'Served from the in-memory cache for the current page.' },
          { label: 'Pending', desc: 'The request has not finished yet.' },
        ],
      },
    ],
  },
  time: {
    title: 'Time',
    kicker: 'Network',
    summary: 'Active duration from request sent to the last response byte — time spent queued is excluded.',
    description: 'Reads `0 ms` for an instant response; stays blank while a request is still in flight.',
    diagram: <ExampleCard column="time" />,
  },
  priority: {
    title: 'Priority',
    kicker: 'Network',
    summary: 'The fetch priority the browser assigned, from `Highest` down to `Lowest`.',
    description: 'Higher-priority resources are requested sooner and given more of the connection. A page can nudge it with the `fetchpriority` attribute.',
    diagram: <ExampleCard column="priority" />,
  },
  waterfall: {
    title: 'Waterfall',
    kicker: 'Network',
    summary: 'A timeline bar per request. The header menu picks the metric, shown as a short tag like `Waterfall (ST)`.',
    diagram: <ExampleCard column="waterfall" />,
    sections: [
      {
        heading: 'Metric tags',
        items: [
          { label: 'ST', desc: 'Start time — bars sit on a shared timeline by when each request began.' },
          { label: 'RT', desc: 'Response time — placed by when the first response byte arrived.' },
          { label: 'ET', desc: 'End time — placed by when each request finished.' },
          { label: 'TD', desc: 'Total duration — zero-aligned bars sized by full request duration.' },
          { label: 'L', desc: 'Latency — zero-aligned bars split where the response started.' },
        ],
      },
    ],
  },
};

export function NetworkColumnInfo({ infoKey }: { infoKey: ColumnKey }) {
  return (
    <InfoTrigger
      content={NETWORK_COLUMN_INFO[infoKey]}
      className="dt-header-info-trigger dt-col-info-trigger"
    />
  );
}

import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

type GeneralInfoKey =
  | 'request-url'
  | 'request-method'
  | 'status-code'
  | 'remote-address'
  | 'http-version'
  | 'compression'
  | 'transferred'
  | 'referrer-policy';

const GENERAL_INFO: Record<GeneralInfoKey, InfoPopoverContent> = {
  'request-url': {
    title: 'Request URL',
    kicker: 'General',
    summary: 'The full URL the browser issued the request against — scheme, host, path, and query string.',
  },
  'request-method': {
    title: 'Request Method',
    kicker: 'General',
    summary: 'The HTTP method used (`GET`, `POST`, `PUT`, `DELETE`, …).',
  },
  'status-code': {
    title: 'Status Code',
    kicker: 'General',
    summary: 'The numeric response code returned by the server.',
    sections: [
      {
        heading: 'Ranges',
        items: [
          { label: '1xx', desc: 'Informational (rare — `100 Continue`, `103 Early Hints`).' },
          { label: '2xx', desc: 'Success.' },
          { label: '3xx', desc: 'Redirection (look at the `Location` header).' },
          { label: '4xx', desc: 'Client error — request was malformed or unauthorized.' },
          { label: '5xx', desc: 'Server error — the server failed to fulfill a valid request.' },
        ],
      },
    ],
  },
  'remote-address': {
    title: 'Remote Address',
    kicker: 'General',
    summary: 'The IP address and port the request was actually sent to.',
    description: 'Different from the URL host when DNS resolves to multiple IPs, a CDN routes via anycast, or a local proxy intercepts the connection.',
  },
  'http-version': {
    title: 'HTTP Version',
    kicker: 'General',
    summary: 'The HTTP protocol version the connection negotiated.',
    description: 'Picked at TLS time via ALPN. The actual on-the-wire value (e.g. `h2`, `h3`) is shown in the tooltip when it differs from the friendly label.',
    sections: [
      {
        heading: 'Common values',
        items: [
          { label: 'HTTP/1.1', desc: 'Text-based, one request per connection by default.' },
          { label: 'HTTP/2', desc: 'Binary, multiplexed over a single TCP connection.' },
          { label: 'HTTP/3', desc: 'Built on QUIC over UDP — faster handshakes, better loss recovery.' },
        ],
      },
    ],
  },
  compression: {
    title: 'Compression',
    kicker: 'General',
    summary: 'The encoding the server applied to the response body — the browser decodes before exposing it to JavaScript.',
    sections: [
      {
        heading: 'Common values',
        items: [
          { label: 'gzip', desc: 'Universally supported, modest compression ratio.' },
          { label: 'br', desc: 'Brotli — better ratio than gzip, supported by all modern browsers.' },
          { label: 'zstd', desc: 'Newer high-ratio compression; growing browser support.' },
          { label: 'deflate', desc: 'Legacy, rarely used today.' },
        ],
      },
    ],
  },
  transferred: {
    title: 'Transferred',
    kicker: 'General',
    summary: 'Bytes that actually crossed the wire, including compression overhead.',
    description: 'The decoded size shown in parentheses is what JavaScript sees after the browser decompresses the body. A big gap between the two is the compression win.',
  },
  'referrer-policy': {
    title: 'Referrer Policy',
    kicker: 'General',
    summary: 'How much of the URL the browser sends in `Referer` on outgoing navigations and requests from this page.',
    description: 'Set via the `Referrer-Policy` response header, the `<meta name="referrer">` tag, or per-request via the `referrerpolicy` attribute.',
  },
};

export function GeneralRow({
  label,
  infoKey,
  children,
}: {
  label: string;
  infoKey: GeneralInfoKey;
  children: React.ReactNode;
}) {
  return (
    <div className="dt-kv">
      <span className="dt-kv-key">
        <InfoTrigger content={GENERAL_INFO[infoKey]} className="dt-header-info-trigger" />
        {label}:
      </span>
      {children}
    </div>
  );
}

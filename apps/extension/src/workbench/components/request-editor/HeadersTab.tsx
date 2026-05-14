/**
 * HeadersTab — user-defined request headers + an auto-generated
 * section the user can reveal with a Show/Hide toggle. The auto
 * rows surface the headers the browser tends to set on the outgoing
 * wire (Host, User-Agent, Accept, etc.) plus a cache-busting
 * Cache-Control default, plus — when the request carries a body —
 * the `Content-Type` + `Content-Length` entries that the executor
 * computes from the body itself.
 *
 * Auto rows are read-only text but carry a live checkbox the user
 * can un-check. The checkbox state is local — the browser decides
 * what actually goes on the wire for these regardless — so the
 * toggle's job is informational / "don't rely on this" signalling
 * until we move to a custom fetch pipeline that can honour
 * suppression end-to-end.
 */

import { EyeInvisibleOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { RequestBody } from '@openheaders/core/types';
import { Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import KeyValueTable, {
  type KeyValueRow,
  type KeyValueRowConflictBridge,
  makeKvRow,
  type SuggestionRow,
} from './KeyValueTable';

function headerRowsToText(rows: KeyValueRow[]): string {
  return rows
    .filter((r) => r.key.trim() || r.value.trim() || r.description?.trim())
    .map((r) => {
      const prefix = r.enabled ? '' : '//';
      const note = r.description ? ` # ${r.description}` : '';
      return `${prefix}${r.key}: ${r.value}${note}`;
    })
    .join('\n');
}

function headerTextToRows(text: string): KeyValueRow[] {
  const out: KeyValueRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line) continue;
    const enabled = !line.startsWith('//');
    const payload = enabled ? line : line.replace(/^\/\/\s*/, '');
    const hashIdx = payload.indexOf(' # ');
    const noteless = hashIdx >= 0 ? payload.slice(0, hashIdx) : payload;
    const description = hashIdx >= 0 ? payload.slice(hashIdx + 3).trim() : '';
    const colonIdx = noteless.indexOf(':');
    const key = colonIdx >= 0 ? noteless.slice(0, colonIdx) : noteless;
    const value = colonIdx >= 0 ? noteless.slice(colonIdx + 1).trim() : '';
    out.push(makeKvRow({ key: key.trim(), value, description, enabled }));
  }
  return out;
}

const { Text } = Typography;

interface AutoHeaderDef {
  key: string;
  value: string;
  hint: string;
  /** When true, only include this row when the request has a body. */
  bodyOnly?: boolean;
}

// Base rows are listed in the order they typically appear on the wire
// — we render in-order so the visual matches what a proxy / HAR view
// would show.
const BASE_AUTO_HEADERS: AutoHeaderDef[] = [
  {
    key: 'Cache-Control',
    value: 'no-cache',
    hint: '"Cache-Control: no-cache" is added as a precautionary measure to prevent the server from returning stale responses when you make repeated requests. You can remove this header in the request settings or enter a new one with a different value.',
  },
  {
    key: 'Content-Type',
    value: '<calculated when request is sent>',
    hint: 'The runtime computes Content-Type from the body encoding (form-data → multipart/form-data with a boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; raw JSON → application/json; etc.). Set your own header to override.',
    bodyOnly: true,
  },
  {
    key: 'Content-Length',
    value: '<calculated when request is sent>',
    hint: 'Content-Length is computed from the serialized body byte size before the request is sent. The browser refuses to honour a user-set Content-Length that does not match the actual body length.',
    bodyOnly: true,
  },
  {
    key: 'Host',
    value: '<calculated when request is sent>',
    hint: 'The browser derives Host from the target URL and refuses to let userland code override it.',
  },
  {
    key: 'User-Agent',
    value: 'OpenHeadersRuntime/5',
    hint: 'The User-Agent identifies the client. The browser supplies one by default; you can add your own User-Agent row below to override.',
  },
  {
    key: 'Accept',
    value: '*/*',
    hint: 'Accept tells the server which media types the client can parse. `*/*` lets the server pick; override with a narrower set (e.g. `application/json`) to constrain responses.',
  },
  {
    key: 'Accept-Encoding',
    value: 'gzip, deflate, br',
    hint: 'Compression algorithms the browser supports. Set by the browser and negotiated per-connection; not overridable from userland.',
  },
  {
    key: 'Connection',
    value: 'keep-alive',
    hint: 'HTTP/1.1 connection reuse. The browser manages the connection pool and does not let userland code override this header.',
  },
];

interface HeadersTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  /** Needed so `Content-Type` / `Content-Length` only show when a body exists. */
  body: RequestBody;
  /** Inline conflict chips for header cells + set-remove rows. */
  conflictBridge?: KeyValueRowConflictBridge;
}

const HeadersTab: React.FC<HeadersTabProps> = ({ rows, onChange, body, conflictBridge }) => {
  const { token } = theme.useToken();
  const [showAuto, setShowAuto] = useState(false);
  const [disabledAutoKeys, setDisabledAutoKeys] = useState<Set<string>>(new Set());

  const autoHeaders = useMemo(() => {
    const hasBody = body.type !== 'none';
    return BASE_AUTO_HEADERS.filter((h) => !h.bodyOnly || hasBody);
  }, [body.type]);

  const toggleAutoKey = (key: string, next: boolean) => {
    setDisabledAutoKeys((prev) => {
      const copy = new Set(prev);
      if (next) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  };

  const suggestions: SuggestionRow[] = autoHeaders.map((h) => ({
    key: h.key,
    value: h.value,
    hint: h.hint,
    enabled: !disabledAutoKeys.has(h.key),
    onToggle: (next) => toggleAutoKey(h.key, next),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text strong style={{ fontSize: 13 }}>
            Headers
          </Text>
          <Button
            size="small"
            type="text"
            icon={showAuto ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowAuto((s) => !s)}
            style={{ color: token.colorTextSecondary, fontSize: 12 }}
          >
            {showAuto ? 'Hide auto-generated headers' : `${autoHeaders.length} hidden`}
          </Button>
          {showAuto && (
            <Tooltip title="These headers will be automatically added and sent with the request. Click the info icon on a row for per-header detail.">
              <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 12, cursor: 'help' }} />
            </Tooltip>
          )}
        </div>
      </div>
      <KeyValueTable
        rows={rows}
        onChange={onChange}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        suggestionRows={showAuto ? suggestions : []}
        bulkEdit={{
          serialize: headerRowsToText,
          parse: headerTextToRows,
          placeholder: 'Content-Type: application/json\nAuthorization: Bearer {{token}} # auth\n//X-Disabled: value',
        }}
        rowPath={(uid, leaf) => REQUEST_PATHS.header(uid, leaf)}
        conflictBridge={conflictBridge}
      />
    </div>
  );
};

export default HeadersTab;

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
import type { AuthConfig, RequestBody } from '@openheaders/core/types';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { REQUEST_PATHS } from '@openheaders/ui/shared/awareness';
import { previewAuthContributions } from './auth-preview';
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

interface AutoHeaderDef {
  key: string;
  value: string;
  hint: string;
  /** When true, only include this row when the request has a body. */
  bodyOnly?: boolean;
  /** A user row with the same key actually replaces this value on the
   *  wire — the generated row renders struck through when that happens.
   *  Absent for browser-managed headers the user can't override. */
  overridable?: boolean;
  /** Editor tab that owns the generated value — renders the
   *  hover-revealed "Go to …" jump link on the row. */
  goTo?: 'body' | 'settings';
}

// Base rows are listed in the order they typically appear on the wire
// — we render in-order so the visual matches what a proxy / HAR view
// would show.
const BASE_AUTO_HEADERS: AutoHeaderDef[] = [
  {
    key: 'Cache-Control',
    value: 'no-cache',
    hint: '"Cache-Control: no-cache" is added as a precautionary measure to prevent the server from returning stale responses when you make repeated requests. You can remove this header in the request settings or enter a new one with a different value.',
    overridable: true,
    goTo: 'settings',
  },
  {
    key: 'Content-Type',
    value: '<calculated when request is sent>',
    hint: 'The runtime computes Content-Type from the body encoding (form-data → multipart/form-data with a boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; raw JSON → application/json; etc.). Set your own header to override.',
    bodyOnly: true,
    overridable: true,
    goTo: 'body',
  },
  {
    key: 'Content-Length',
    value: '<calculated when request is sent>',
    hint: 'Content-Length is computed from the serialized body byte size before the request is sent. The browser refuses to honour a user-set Content-Length that does not match the actual body length.',
    bodyOnly: true,
    goTo: 'body',
  },
  {
    key: 'Host',
    value: '<calculated when request is sent>',
    hint: 'The browser derives Host from the target URL and refuses to let userland code override it.',
  },
  {
    key: 'User-Agent',
    value: typeof navigator !== 'undefined' ? navigator.userAgent : '<browser user agent>',
    hint: 'The User-Agent identifies the client. Requests go out with the browser’s own User-Agent; add your own User-Agent row below to override it.',
    overridable: true,
  },
  {
    key: 'Accept',
    value: '*/*',
    hint: 'Accept tells the server which media types the client can parse. `*/*` lets the server pick; override with a narrower set (e.g. `application/json`) to constrain responses.',
    overridable: true,
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
  /** Drives the auth-derived `Authorization` preview row. */
  auth: AuthConfig;
  /** Writes back auth edits made from this table — the auth row's
   *  checkbox (suspend/resume via `auth.disabled`) and, for bearer /
   *  header-borne API keys, inline edits of the credential value. */
  onAuthChange: (auth: AuthConfig) => void;
  /** Jump to the editor tab that owns a generated row's value —
   *  drives the hover-revealed "Go to …" links. */
  onNavigateTab?: (tab: 'authorization' | 'body' | 'settings') => void;
  /** Inline conflict chips for header cells + set-remove rows. */
  conflictBridge?: KeyValueRowConflictBridge;
}

const HeadersTab: React.FC<HeadersTabProps> = ({
  rows,
  onChange,
  body,
  auth,
  onAuthChange,
  onNavigateTab,
  conflictBridge,
}) => {
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

  // Auth-derived rows are always visible so the user sees the
  // synthesized `Authorization` header the moment they pick an auth
  // type. Live, not locked: the checkbox suspends/resumes the auth
  // contribution (`auth.disabled`, honored by the executor), and for
  // scalar credentials (bearer token, header-borne API key) the value
  // is editable inline, two-way bound to the auth config — the same
  // token the Authorization tab edits. Composed (Basic base64) and
  // runtime (OAuth 2.0) values stay read-only placeholders; their
  // hint points at the Authorization tab. The browser-managed
  // auto-headers stay behind the Show/Hide toggle since they're
  // environment noise the user rarely cares about.
  const authHeaders = useMemo(() => previewAuthContributions(auth).headers, [auth]);
  const authRowToggle = (next: boolean) => onAuthChange({ ...auth, disabled: next ? undefined : true });

  // Keys of the user's own enabled rows — a generated row with the same
  // key renders struck through (the user's row wins on the wire).
  const userRowKeys = useMemo(() => {
    const out = new Set<string>();
    for (const r of rows) {
      if (r.enabled && r.key.trim()) out.add(r.key.trim().toLowerCase());
    }
    return out;
  }, [rows]);
  const overrideBy = (key: string): string | undefined => (userRowKeys.has(key.toLowerCase()) ? key : undefined);

  const authSuggestions: SuggestionRow[] = authHeaders.map((h) => {
    const row: SuggestionRow = {
      key: h.key,
      value: h.value,
      hint: h.hint,
      enabled: !auth.disabled,
      onToggle: authRowToggle,
      overriddenBy: overrideBy(h.key),
      action: onNavigateTab ? { label: 'Go to authorization', onClick: () => onNavigateTab('authorization') } : undefined,
    };
    if (auth.type === 'bearer') {
      row.value = `Bearer ${auth.token}`;
      row.editableValue = {
        secret: true,
        onChange: (next) => onAuthChange({ ...auth, token: next.replace(/^Bearer\s+/i, '') }),
      };
    } else if (auth.type === 'api-key' && auth.in === 'header') {
      row.value = auth.value;
      row.editableValue = {
        secret: true,
        onChange: (next) => onAuthChange({ ...auth, value: next }),
      };
    }
    return row;
  });
  const browserSuggestions: SuggestionRow[] = autoHeaders.map((h) => ({
    key: h.key,
    value: h.value,
    hint: h.hint,
    enabled: !disabledAutoKeys.has(h.key),
    onToggle: (next: boolean) => toggleAutoKey(h.key, next),
    overriddenBy: h.overridable ? overrideBy(h.key) : undefined,
    action:
      h.goTo && onNavigateTab
        ? { label: `Go to ${h.goTo}`, onClick: () => onNavigateTab(h.goTo as 'body' | 'settings') }
        : undefined,
  }));
  const suggestions: SuggestionRow[] = showAuto
    ? [...authSuggestions, ...browserSuggestions]
    : authSuggestions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            size="small"
            type="text"
            icon={showAuto ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowAuto((s) => !s)}
            style={{ color: token.colorTextSecondary, fontSize: 12 }}
          >
            {showAuto ? 'Hide auto-generated headers' : `${browserSuggestions.length} hidden`}
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
        suggestionRows={suggestions}
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

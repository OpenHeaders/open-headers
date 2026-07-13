/**
 * ResponseCookiesView — columnar grid over the raw `Set-Cookie` lines
 * the snapshot carries (the browser wire capture, or the header rows
 * themselves on node runtimes): one attribute per column (Domain /
 * Path / Expires / HttpOnly / Secure / SameSite), derived at consume
 * from the wire line with RFC defaults filled in explicitly (host-only
 * Domain, `/` Path, `Session` expiry). Attribute docs (shared
 * cookie-attributes corpus) ride the column headers as hover-revealed
 * (i); each row hover-copies its wire line verbatim. A persistence
 * note above the grid says honestly what the runtime did with the
 * cookies — the browser under this send's credentials mode, or the
 * workspace cookie jar per the snapshot's own attribution.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getCookieAttributeInfoContent } from '@openheaders/ui/shared/info-popover/data/cookie-attributes';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import {
  type CookieGridRow,
  hostOfUrl,
  parseSetCookieLines,
  persistenceNoteFor,
  setCookieLinesOf,
  toCookieGridRow,
} from './response-cookies';
import './response-headers.css';

const { Text } = Typography;

const GRID_TEMPLATE =
  'minmax(80px, 1fr) minmax(100px, 1.4fr) minmax(90px, 1fr) minmax(68px, 0.6fr) minmax(96px, 1fr) 96px 86px 102px 32px';

const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** Copy-to-clipboard with the house check-swap feedback. */
function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return [copied, copy];
}

function Cell({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        ...cellFont,
        padding: '6px 10px',
        color: first ? undefined : token.colorTextSecondary,
        fontWeight: first ? 600 : undefined,
        borderLeft: first ? undefined : `1px solid ${token.colorBorderSecondary}`,
        wordBreak: 'break-all',
        minWidth: 0,
      }}
    >
      {children}
    </span>
  );
}

function CookieRow({ row }: { row: CookieGridRow }) {
  const { token } = theme.useToken();
  const [copied, copy] = useCopied();
  return (
    <div
      className="oh-resp-hdr-row"
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_TEMPLATE,
        alignItems: 'start',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Cell first>{row.name}</Cell>
      <Cell>{row.value}</Cell>
      <Cell>{row.domain}</Cell>
      <Cell>{row.path}</Cell>
      <Cell>{row.expires}</Cell>
      <Cell>{String(row.httpOnly)}</Cell>
      <Cell>{String(row.secure)}</Cell>
      <Cell>{row.sameSite}</Cell>
      <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
        <Button
          className="oh-resp-hdr-copy"
          size="small"
          type="text"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          aria-label={copied ? 'Copied' : `Copy Set-Cookie for ${row.name}`}
          title={copied ? 'Copied' : 'Copy Set-Cookie line'}
          onClick={() => copy(row.raw)}
        />
      </span>
    </div>
  );
}

/** Header cell — attribute columns carry the doc (i) for their
 *  attribute, revealed on header-row hover. */
function HeaderCell({ label, attrKey, first = false }: { label: string; attrKey?: string; first?: boolean }) {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        padding: '6px 10px',
        borderLeft: first ? undefined : `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'baseline',
        gap: 2,
        minWidth: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {attrKey && <InfoTrigger content={getCookieAttributeInfoContent(attrKey)} className="oh-resp-hdr-info" />}
    </span>
  );
}

const ResponseCookiesView: React.FC<{ response: ExecutedRequestSnapshot }> = ({ response }) => {
  const { token } = theme.useToken();
  const requestHost = hostOfUrl(response.url);
  const rows = parseSetCookieLines(setCookieLinesOf(response)).map((c) => toCookieGridRow(c, requestHost));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      <div style={{ padding: '6px 0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {persistenceNoteFor(
            response,
            rows.map((r) => r.name),
          )}
        </Text>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto', overscrollBehavior: 'none',
          minHeight: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 4,
        }}
      >
        <div
          className="oh-resp-hdr-row"
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_TEMPLATE,
            alignItems: 'center',
            background: `linear-gradient(${token.colorFillAlter}, ${token.colorFillAlter}), ${token.colorBgContainer}`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            fontSize: 12,
            fontWeight: 500,
            color: token.colorTextSecondary,
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <HeaderCell label="Name" first />
          <HeaderCell label="Value" />
          <HeaderCell label="Domain" attrKey="Domain" />
          <HeaderCell label="Path" attrKey="Path" />
          <HeaderCell label="Expires" attrKey="Expires" />
          <HeaderCell label="HttpOnly" attrKey="HttpOnly" />
          <HeaderCell label="Secure" attrKey="Secure" />
          <HeaderCell label="SameSite" attrKey="SameSite" />
          <span />
        </div>
        {rows.map((row, i) => (
          <CookieRow key={`${row.raw}:${i}`} row={row} />
        ))}
      </div>
    </div>
  );
};

export default ResponseCookiesView;

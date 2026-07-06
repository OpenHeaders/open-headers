/**
 * ResponseCookiesView — grid over the raw `Set-Cookie` lines the wire
 * capture observed for this response, in the headers-grid visual
 * language. Each attribute carries a hover-revealed (i) doc popover
 * (shared cookie-attributes corpus); each row hover-copies its wire
 * line verbatim. A persistence note above the grid says honestly what
 * the browser did with the cookies under this send's credentials mode.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { ExecutedWireCapture } from '@openheaders/core/types';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getCookieAttributeInfoContent } from '@openheaders/ui/shared/info-popover/data/cookie-attributes';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { cookiePersistenceNote, type ParsedSetCookie, parseSetCookieLines } from './response-cookies';
import './response-headers.css';

const { Text } = Typography;

const GRID_TEMPLATE = 'minmax(120px, 20%) minmax(140px, 1fr) minmax(180px, 38%) 32px';

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

function CookieGridRow({ cookie }: { cookie: ParsedSetCookie }) {
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
      <span style={{ ...cellFont, padding: '6px 10px', fontWeight: 600, wordBreak: 'break-all', minWidth: 0 }}>
        {cookie.name}
      </span>
      <span
        style={{
          ...cellFont,
          padding: '6px 10px',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextSecondary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          minWidth: 0,
        }}
      >
        {cookie.value}
      </span>
      <span
        style={{
          ...cellFont,
          padding: '6px 10px',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextSecondary,
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 10,
          rowGap: 2,
          minWidth: 0,
        }}
      >
        {cookie.attributes.map((attr, i) => (
          <span
            key={`${attr.key}:${i}`}
            style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}
          >
            <InfoTrigger content={getCookieAttributeInfoContent(attr.key)} className="oh-resp-hdr-info" />
            <span style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
              {attr.value !== undefined ? `${attr.key}=${attr.value}` : attr.key}
            </span>
          </span>
        ))}
      </span>
      <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
        <Button
          className="oh-resp-hdr-copy"
          size="small"
          type="text"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          aria-label={copied ? 'Copied' : `Copy Set-Cookie for ${cookie.name}`}
          title={copied ? 'Copied' : 'Copy Set-Cookie line'}
          onClick={() => copy(cookie.raw)}
        />
      </span>
    </div>
  );
}

const ResponseCookiesView: React.FC<{ wire: ExecutedWireCapture }> = ({ wire }) => {
  const { token } = theme.useToken();
  const cookies = parseSetCookieLines(wire.setCookieHeaders ?? []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      <div style={{ padding: '6px 0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {cookiePersistenceNote(wire.credentialsMode)}
        </Text>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 4,
        }}
      >
        <div
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
          <span style={{ padding: '6px 10px' }}>Name</span>
          <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Value</span>
          <span style={{ padding: '6px 10px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>Attributes</span>
          <span />
        </div>
        {cookies.map((cookie, i) => (
          <CookieGridRow key={`${cookie.raw}:${i}`} cookie={cookie} />
        ))}
      </div>
    </div>
  );
};

export default ResponseCookiesView;

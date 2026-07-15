/**
 * ResponseHeadersView — aligned name/value grid over the response
 * headers, matching the request-editor tab grids. Each row carries a
 * hover-revealed (i) doc popover (shared http-headers corpus — every
 * name gets content, unknown ones an honest fallback) and a hover
 * copy of its `name: value` line; a filter box is always offered. The
 * tab label keeps the unfiltered count — filtering narrows the view,
 * not the response.
 */

import { CheckOutlined, CopyOutlined, FilterOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getHeaderInfoContentForRow } from '@openheaders/ui/shared/info-popover/data/http-headers';
import {
  categorizeHeader,
  HEADER_CATEGORY_LABEL,
} from '@openheaders/ui/shared/info-popover/data/http-headers/header-category';
import { Button, Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { filterHeaderRows, type ResponseHeaderRow, serializeHeaderLines } from './response-headers';
import './response-headers.css';

const { Text } = Typography;

const GRID_TEMPLATE = 'minmax(180px, 1fr) 1fr 32px';

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

function HeaderGridRow({ row }: { row: ResponseHeaderRow }) {
  const { token } = theme.useToken();
  const t = useT();
  const [copied, copy] = useCopied();
  const content = getHeaderInfoContentForRow(t, row.key, 'response', HEADER_CATEGORY_LABEL[categorizeHeader(row.key)]);
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
      <span style={{ ...cellFont, padding: '3px 8px', display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span style={{ fontWeight: 600, wordBreak: 'break-all', minWidth: 0 }}>{row.key}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
          <InfoTrigger content={content} className="oh-resp-hdr-info" />
        </span>
      </span>
      <span
        style={{
          ...cellFont,
          padding: '3px 8px',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextSecondary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          minWidth: 0,
        }}
      >
        {row.value}
      </span>
      <span style={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          className="oh-resp-hdr-copy"
          size="small"
          type="text"
          style={{ height: 22 }}
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          aria-label={
            copied
              ? t('workbench.editors.request.response.copied')
              : t('workbench.editors.request.response.headers.copyAria', { name: row.key })
          }
          title={
            copied
              ? t('workbench.editors.request.response.copied')
              : t('workbench.editors.request.response.headers.copyTitle')
          }
          onClick={() => copy(`${row.key}: ${row.value}`)}
        />
      </span>
    </div>
  );
}

const ResponseHeadersView: React.FC<{
  headers: ExecutedRequestSnapshot['headers'];
  /** HTTP trailer fields, when the executing host captured any —
   *  rendered under a "Trailers" divider after the header rows. */
  trailers?: ExecutedRequestSnapshot['headers'];
}> = ({ headers, trailers }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [query, setQuery] = useState('');
  const [allCopied, copyAll] = useCopied();

  // Each new response starts unfiltered — a filter typed against the
  // previous send must not silently hide the next one's headers.
  useEffect(() => {
    setQuery('');
  }, [headers]);

  const visible = filterHeaderRows(headers, query);
  const visibleTrailers = filterHeaderRows(trailers ?? [], query);

  if (headers.length === 0 && (trailers === undefined || trailers.length === 0)) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.headers.empty')}
        </Text>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <Input
          size="small"
          allowClear
          prefix={<FilterOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('workbench.editors.request.response.headers.filterPlaceholder')}
          aria-label={t('workbench.editors.request.response.headers.filterPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 220 }}
        />

        <Tooltip
          title={
            allCopied
              ? t('workbench.editors.request.response.copied')
              : t('workbench.editors.request.response.headers.copyAll')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={allCopied ? <CheckOutlined /> : <CopyOutlined />}
            aria-label={t('workbench.editors.request.response.headers.copyAll')}
            onClick={() => copyAll(serializeHeaderLines([...headers, ...(trailers ?? [])]))}
            style={{ marginLeft: 'auto' }}
          />
        </Tooltip>
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
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_TEMPLATE,
            alignItems: 'center',
            // Opaque sticky header — same composite as the editable
            // grids, so scrolled rows can't bleed through the tint.
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
          <span style={{ padding: '4px 8px' }}>{t('workbench.editors.request.response.headers.name')}</span>
          <span style={{ padding: '4px 8px', borderLeft: `1px solid ${token.colorBorderSecondary}` }}>
            {t('workbench.editors.request.response.headers.value')}
          </span>
          <span />
        </div>
        {visible.map((h, i) => (
          <HeaderGridRow key={`${h.key}:${h.value}:${i}`} row={h} />
        ))}
        {visibleTrailers.length > 0 && (
          <>
            {/* Trailer fields arrived AFTER the body (gRPC status lives
                here) — kept apart from the headers so the distinction
                stays visible. */}
            <div
              data-testid="oh-response-trailers-divider"
              style={{
                padding: '4px 8px',
                background: `linear-gradient(${token.colorFillAlter}, ${token.colorFillAlter}), ${token.colorBgContainer}`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                fontSize: 12,
                fontWeight: 500,
                color: token.colorTextSecondary,
              }}
            >
              {t('workbench.editors.request.response.headers.trailers')}
            </div>
            {visibleTrailers.map((h, i) => (
              <HeaderGridRow key={`trailer:${h.key}:${h.value}:${i}`} row={h} />
            ))}
          </>
        )}
        {visible.length === 0 && visibleTrailers.length === 0 && (
          <div style={{ padding: '10px 12px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.editors.request.response.headers.noMatch', { query: query.trim() })}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseHeadersView;

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * API Requests Catalog deep-dive — unpacks the "API Requests Catalog"
 * row of the paradigm-shift comparison. Stylized request-editor mockup
 * (method + URL + tabs + body) on top, feature-coverage strip below.
 *
 * Argument: every capability you'd expect from a desktop API client
 * — protocol breadth, auth methods, scripts, file uploads, variables,
 * collections — lives inside the browser extension.
 */
export const ParadigmApiCatalogDiagram: React.FC = () => {
  const t = useT();
  const W = 480;
  const H = 360;
  const OUTER_PAD = 10;

  // Mockup geometry
  const MOCK_X = OUTER_PAD;
  const MOCK_Y = 60;
  const MOCK_W = W - OUTER_PAD * 2;
  const MOCK_H = 168;

  // Bottom feature strip
  const STRIP_Y = MOCK_Y + MOCK_H + 14;
  const STRIP_H = 84;

  const PROTOCOLS = ['HTTP', 'WS', 'GraphQL'];

  const FEATURES: { label: string; sub: string }[] = [
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featAuth'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub'),
    },
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featScripts'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub'),
    },
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featVariables'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub'),
    },
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featFiles'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub'),
    },
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featCollections'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub'),
    },
    {
      label: t('workbench.docs.diagrams.openHeaders.apiCatalog.featCookies'),
      sub: t('workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub'),
    },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.apiCatalog.aria')}
    >
      {/* Title — chips sit on the SAME row, right-aligned. Subtitle
       *  gets its own row below at full width so it can't overflow into
       *  the chip area. */}
      <text x={OUTER_PAD} y={24} fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.openHeaders.apiCatalog.title')}
      </text>
      {(() => {
        const chipH = 20;
        const gap = 6;
        const charW = 6.5;
        const padX = 12;
        const widths = PROTOCOLS.map((p) => Math.max(44, Math.round(p.length * charW + padX * 2)));
        const totalW = widths.reduce((s, w) => s + w, 0) + (PROTOCOLS.length - 1) * gap;
        let cursor = W - OUTER_PAD - totalW;
        return PROTOCOLS.map((p, i) => {
          const chipW = widths[i];
          const x = cursor;
          cursor += chipW + gap;
          return (
            <g key={p}>
              <rect x={x} y={10} width={chipW} height={chipH} rx={chipH / 2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
              <text x={x + chipW / 2} y={24} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
                {p}
              </text>
            </g>
          );
        });
      })()}
      <text x={OUTER_PAD} y={46} fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.openHeaders.apiCatalog.subtitle')}
      </text>

      {/* Request-editor mockup */}
      <rect
        x={MOCK_X}
        y={MOCK_Y}
        width={MOCK_W}
        height={MOCK_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />

      {/* Method + URL bar */}
      <rect
        x={MOCK_X + 8}
        y={MOCK_Y + 8}
        width={56}
        height={22}
        rx={3}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text
        x={MOCK_X + 36}
        y={MOCK_Y + 22}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fontFamily="monospace"
        fill={TEXT}
      >
        POST
      </text>
      <rect
        x={MOCK_X + 70}
        y={MOCK_Y + 8}
        width={MOCK_W - 158}
        height={22}
        rx={3}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text x={MOCK_X + 78} y={MOCK_Y + 22} fontSize={10} fontFamily="monospace" fill={TEXT}>
        https://api.openheaders.com/v2/items
      </text>
      <rect x={MOCK_X + MOCK_W - 80} y={MOCK_Y + 8} width={72} height={22} rx={3} fill={OH_GREEN} stroke={OH_GREEN} />
      <text
        x={MOCK_X + MOCK_W - 44}
        y={MOCK_Y + 22}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="var(--ant-color-bg-container)"
      >
        {t('workbench.docs.diagrams.openHeaders.apiCatalog.send')}
      </text>

      {/* Tab strip */}
      {[
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabParams'),
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth'),
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders'),
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabBody'),
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts'),
        t('workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings'),
      ].map((tab, i) => {
        const tabW = (MOCK_W - 16) / 6;
        const x = MOCK_X + 8 + i * tabW;
        const isActive = i === 3;
        return (
          <g key={tab}>
            <line x1={x} y1={MOCK_Y + 48} x2={x + tabW} y2={MOCK_Y + 48} stroke="var(--ant-color-border)" />
            {isActive && (
              <line
                x1={x + 8}
                y1={MOCK_Y + 48}
                x2={x + tabW - 8}
                y2={MOCK_Y + 48}
                stroke={STROKE_BLUE}
                strokeWidth={2.5}
              />
            )}
            <text
              x={x + tabW / 2}
              y={MOCK_Y + 44}
              textAnchor="middle"
              fontSize={10}
              fontWeight={isActive ? 700 : 500}
              fill={isActive ? TEXT : TEXT_DIM}
            >
              {tab}
            </text>
          </g>
        );
      })}

      {/* Body preview (JSON-ish) */}
      <rect
        x={MOCK_X + 8}
        y={MOCK_Y + 56}
        width={MOCK_W - 16}
        height={MOCK_H - 64}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
      />
      {[
        { line: '{', indent: 0 },
        { line: '"name": "{{env.PRODUCT_NAME}}",', indent: 2 },
        { line: '"region": "{{workspace.REGION}}",', indent: 2 },
        { line: '"token": "{{vault.API_TOKEN}}",', indent: 2 },
        { line: '"attachments": ["{{file.invoice}}"],', indent: 2 },
        { line: '"createdAt": 1715000000', indent: 2 },
        { line: '}', indent: 0 },
      ].map((row, i) => (
        <text
          key={i}
          x={MOCK_X + 16 + row.indent * 6}
          y={MOCK_Y + 74 + i * 14}
          fontFamily="monospace"
          fontSize={10}
          fill={TEXT}
        >
          {row.line}
        </text>
      ))}

      {/* Feature strip frame */}
      <rect
        x={OUTER_PAD}
        y={STRIP_Y}
        width={MOCK_W}
        height={STRIP_H}
        rx={6}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeOpacity={0.5}
      />
      <text x={OUTER_PAD + 10} y={STRIP_Y + 14} fontSize={9} fontWeight={700} fill={OH_GREEN} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.openHeaders.apiCatalog.kicker')}
      </text>

      {/* Feature pills — 3 cols × 2 rows */}
      {FEATURES.map((f, i) => {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellW = (MOCK_W - 20) / cols;
        const cellH = 26;
        const x = OUTER_PAD + 10 + col * cellW;
        const y = STRIP_Y + 22 + row * (cellH + 4);
        return (
          <g key={f.label}>
            <rect
              x={x}
              y={y}
              width={cellW - 6}
              height={cellH}
              rx={4}
              fill="var(--ant-color-bg-container)"
              stroke={OH_GREEN}
              strokeOpacity={0.4}
            />
            <text x={x + 8} y={y + 11} fontSize={10} fontWeight={700} fill={TEXT}>
              {f.label}
            </text>
            <text x={x + 8} y={y + 22} fontSize={8} fill={TEXT_DIM} fontStyle="italic">
              {f.sub}
            </text>
          </g>
        );
      })}

      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.openHeaders.apiCatalog.footer')}
      </text>
    </svg>
  );
};

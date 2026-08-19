/**
 * Direct vs Indirect matches — comparison diagram.
 *
 * Same rule ("Request Domains: openheaders.com"), two different page
 * contexts. Left scene: page IS on openheaders.com — page itself
 * matches (direct), and same-host sub-resources also count as direct
 * hits. Right scene: page is on app.example.com but loads a sub-
 * resource from openheaders.com — only that sub-resource matches
 * (indirect); the page URL itself is excluded.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_GREEN, STROKE, STROKE_GREEN, TEXT, TEXT_DIM } from './_shared';

export const DirectVsIndirectDiagram: React.FC = () => {
  const t = useT();
  const ID = 'di-msg';
  const matchFill = FILL_GREEN;
  const matchStroke = STROKE_GREEN;
  const dimStroke = STROKE;
  return (
    <svg
      viewBox="0 0 320 230"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.directVsIndirect.aria')}
    >
      <ArrowDefs id={ID} />
      {/* Rule banner at top */}
      <rect
        x={40}
        y={6}
        width={240}
        height={22}
        rx={3}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={160} y={16} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.ruleLabel')}
      </text>
      <text x={160} y={26} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.ruleBanner')}
      </text>

      {/* Vertical separator between scenes */}
      <line x1={160} y1={40} x2={160} y2={210} stroke="var(--ant-color-border-secondary)" strokeDasharray="2 4" />

      {/* ── LEFT: DIRECT ────────────────────────────────────────── */}
      <text x={80} y={48} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.directTitle')}
      </text>
      <text x={80} y={60} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.directSub')}
      </text>

      {/* Page (matches) */}
      <rect x={20} y={68} width={120} height={28} rx={3} fill={matchFill} stroke={matchStroke} />
      <text x={80} y={80} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.pageLabel')}
      </text>
      <text x={80} y={92} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={600} fill={TEXT}>
        openheaders.com/dash
      </text>
      {/* Tree connectors */}
      <line x1={80} y1={96} x2={80} y2={108} stroke={dimStroke} />
      <line x1={45} y1={108} x2={115} y2={108} stroke={dimStroke} />
      <line x1={45} y1={108} x2={45} y2={120} stroke={dimStroke} />
      <line x1={115} y1={108} x2={115} y2={120} stroke={dimStroke} />
      {/* Sub-resource 1 (matches — same host) */}
      <rect x={12} y={120} width={66} height={22} rx={2} fill={matchFill} stroke={matchStroke} />
      <text x={45} y={134} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        /api/users
      </text>
      {/* Sub-resource 2 (no match — different host) */}
      <rect
        x={84}
        y={120}
        width={66}
        height={22}
        rx={2}
        fill="var(--ant-color-fill-quaternary)"
        stroke={dimStroke}
        strokeDasharray="2 2"
      />
      <text x={117} y={134} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        cdn.x.com
      </text>
      {/* Caption */}
      <text x={80} y={166} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.directCaption1')}
      </text>
      <text x={80} y={177} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.directCaption2')}
      </text>
      <text x={80} y={195} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.badgePrefix')}{' '}
        <tspan fontWeight={600} fill={TEXT}>
          {t('workbench.docs.diagrams.directVsIndirect.badgeDirect')}
        </tspan>
      </text>

      {/* ── RIGHT: INDIRECT ─────────────────────────────────────── */}
      <text x={240} y={48} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.indirectTitle')}
      </text>
      <text x={240} y={60} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.indirectSub')}
      </text>

      {/* Page (no match) */}
      <rect
        x={180}
        y={68}
        width={120}
        height={28}
        rx={3}
        fill="var(--ant-color-fill-quaternary)"
        stroke={dimStroke}
        strokeDasharray="2 2"
      />
      <text x={240} y={80} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.pageLabel')}
      </text>
      <text x={240} y={92} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={600} fill={TEXT_DIM}>
        app.example.com
      </text>
      {/* Tree connectors */}
      <line x1={240} y1={96} x2={240} y2={108} stroke={dimStroke} />
      <line x1={205} y1={108} x2={275} y2={108} stroke={dimStroke} />
      <line x1={205} y1={108} x2={205} y2={120} stroke={dimStroke} />
      <line x1={275} y1={108} x2={275} y2={120} stroke={dimStroke} />
      {/* Sub-resource 1 (matches — openheaders.com domain) */}
      <rect x={172} y={120} width={66} height={22} rx={2} fill={matchFill} stroke={matchStroke} />
      <text x={205} y={134} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        api.oh.io
      </text>
      {/* Sub-resource 2 (no match) */}
      <rect
        x={244}
        y={120}
        width={66}
        height={22}
        rx={2}
        fill="var(--ant-color-fill-quaternary)"
        stroke={dimStroke}
        strokeDasharray="2 2"
      />
      <text x={277} y={134} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        cdn.example
      </text>
      <text x={240} y={166} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.indirectCaption1')}
      </text>
      <text x={240} y={177} textAnchor="middle" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.directVsIndirect.indirectCaption2')}
      </text>
      <text x={240} y={195} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.badgePrefix')}{' '}
        <tspan fontWeight={600} fill={TEXT}>
          {t('workbench.docs.diagrams.directVsIndirect.badgeIndirect')}
        </tspan>
      </text>

      {/* Legend at bottom */}
      <rect x={20} y={216} width={10} height={10} fill={matchFill} stroke={matchStroke} />
      <text x={36} y={225} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.legendMatches')}
      </text>
      <rect
        x={120}
        y={216}
        width={10}
        height={10}
        fill="var(--ant-color-fill-quaternary)"
        stroke={dimStroke}
        strokeDasharray="2 2"
      />
      <text x={136} y={225} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.directVsIndirect.legendNoMatch')}
      </text>
    </svg>
  );
};

/**
 * Response Body + Status (Mock) — diagrams.
 *
 *   • MockFlowDiagram         — static-vs-dynamic pipeline overview
 *   • MockStaticDiagram       — fixed synthetic response (network skipped)
 *   • MockDynamicDiagram      — real call + transform pipeline
 *   • MockWontApplyDiagram    — only JS-initiated fetch/XHR
 *   • MockUseCasesDiagram     — common patterns at a glance
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  Box,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

export const MockFlowDiagram: React.FC = () => {
  const t = useT();
  return (
    <svg
      viewBox="0 0 300 240"
      width="100%"
      style={{ maxWidth: 320 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.mock.flowAria')}
    >
      <ArrowDefs id="mk-arrow" />
      <text x="75" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
        {t('workbench.docs.diagrams.mock.flowStatic')}
      </text>
      <text x="225" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
        {t('workbench.docs.diagrams.mock.flowDynamic')}
      </text>
      <Box x={20} y={22} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="fetch('/api')" />
      <Box x={170} y={22} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="fetch('/api')" />
      <line x1="75" y1="48" x2="75" y2="62" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <line x1="225" y1="48" x2="225" y2="62" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <Box
        x={20}
        y={64}
        w={110}
        h={26}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        label={t('workbench.docs.diagrams.mock.flowIntercept')}
      />
      <Box
        x={170}
        y={64}
        w={110}
        h={26}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        label={t('workbench.docs.diagrams.mock.flowIntercept')}
      />
      <line x1="75" y1="90" x2="75" y2="108" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <text x="75" y="125" textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.mock.flowNeverHit1')}
      </text>
      <text x="75" y="136" textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.mock.flowNeverHit2')}
      </text>
      <line x1="225" y1="90" x2="225" y2="108" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <Box
        x={170}
        y={110}
        w={110}
        h={26}
        fill={FILL_ORANGE}
        stroke={STROKE_ORANGE}
        label={t('workbench.docs.diagrams.mock.flowRealNetwork')}
        sub={t('workbench.docs.diagrams.mock.flowRealNetworkSub')}
      />
      <line x1="225" y1="146" x2="225" y2="160" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <Box
        x={20}
        y={148}
        w={110}
        h={26}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
        label={t('workbench.docs.diagrams.mock.flowSynthetic')}
      />
      <line x1="75" y1="174" x2="75" y2="188" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <Box
        x={170}
        y={162}
        w={110}
        h={26}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
        label={t('workbench.docs.diagrams.mock.flowFnResponse')}
      />
      <line x1="225" y1="188" x2="225" y2="202" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
      <Box
        x={20}
        y={190}
        w={110}
        h={26}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label={t('workbench.docs.diagrams.mock.flowPageReceives')}
      />
      <Box
        x={170}
        y={204}
        w={110}
        h={26}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label={t('workbench.docs.diagrams.mock.flowPageReceives')}
      />
    </svg>
  );
};

const STATE_X = 30;
const STATE_W = 260;
const ROW_H = 56;
const RULE_Y = 22;
const BEFORE_Y = 70;
const ARROW_S = BEFORE_Y + ROW_H + 4;
const ARROW_E = ARROW_S + 22;
const AFTER_Y = ARROW_E + 4;
const STAMP_Y = AFTER_Y + ROW_H + 22;

const MockCard: React.FC<{
  idSuffix: string;
  rule: string;
  beforeTitle: string;
  beforeLines: React.ReactNode[];
  afterTitle: string;
  afterLines: React.ReactNode[];
  arrowLabel: string;
  stamp: string;
}> = ({ idSuffix, rule, beforeTitle, beforeLines, afterTitle, afterLines, arrowLabel, stamp }) => {
  const t = useT();
  const ID = `mk-${idSuffix}`;
  return (
    <svg viewBox="0 0 320 240" width="100%" style={{ maxWidth: 360 }} role="img">
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.ruleKicker')}
      </text>
      <rect x={20} y={RULE_Y} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text
        x={160}
        y={RULE_Y + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        {rule}
      </text>

      <rect
        x={STATE_X}
        y={BEFORE_Y}
        width={STATE_W}
        height={ROW_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={STATE_X + 8} y={BEFORE_Y + 13} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {beforeTitle}
      </text>
      {beforeLines.map((line, i) => (
        <text
          key={`b-${i}`}
          x={STATE_X + 10}
          y={BEFORE_Y + 30 + i * 14}
          fontFamily="monospace"
          fontSize={9}
          fill={TEXT}
        >
          {line}
        </text>
      ))}

      <line
        x1={STATE_X + STATE_W / 2}
        y1={ARROW_S}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_E}
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_S + ARROW_E) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_PURPLE}
      >
        {arrowLabel}
      </text>

      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={ROW_H} rx={5} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_PURPLE} letterSpacing={0.5}>
        {afterTitle}
      </text>
      {afterLines.map((line, i) => (
        <text key={`a-${i}`} x={STATE_X + 10} y={AFTER_Y + 30 + i * 14} fontFamily="monospace" fontSize={9} fill={TEXT}>
          {line}
        </text>
      ))}

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {stamp}
      </text>
    </svg>
  );
};

export const MockStaticDiagram: React.FC = () => {
  const t = useT();
  return (
    <MockCard
      idSuffix="st"
      rule={t('workbench.docs.diagrams.mock.staticRule')}
      beforeTitle={t('workbench.docs.diagrams.mock.staticBeforeKicker')}
      beforeLines={[
        <tspan key="b" fontStyle="italic" fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.mock.staticNever1')}
        </tspan>,
        <tspan key="b2" fontStyle="italic" fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.mock.staticNever2')}
        </tspan>,
      ]}
      afterTitle={t('workbench.docs.diagrams.mock.pageReceivesKicker')}
      afterLines={[
        <tspan key="a">{t('workbench.docs.diagrams.mock.staticAfterLine1')}</tspan>,
        <tspan key="a2" fontWeight={700} fill={STROKE_PURPLE}>
          {t('workbench.docs.diagrams.mock.staticAfterBody')}
        </tspan>,
      ]}
      arrowLabel={t('workbench.docs.diagrams.mock.staticArrow')}
      stamp={t('workbench.docs.diagrams.mock.staticStamp')}
    />
  );
};

export const MockDynamicDiagram: React.FC = () => {
  const t = useT();
  return (
    <MockCard
      idSuffix="dyn"
      rule={t('workbench.docs.diagrams.mock.dynamicRule')}
      beforeTitle={t('workbench.docs.diagrams.mock.dynamicBeforeKicker')}
      beforeLines={[
        <tspan key="b">{t('workbench.docs.diagrams.mock.dynBodyOpen')}</tspan>,
        <tspan key="b2">{t('workbench.docs.diagrams.mock.dynBodyEmail')}</tspan>,
      ]}
      afterTitle={t('workbench.docs.diagrams.mock.pageReceivesKicker')}
      afterLines={[
        <tspan key="a">{t('workbench.docs.diagrams.mock.dynBodyOpen')}</tspan>,
        <tspan key="a2">
          {t('workbench.docs.diagrams.mock.dynAfterPrefix')}
          <tspan fontWeight={700} fill={STROKE_PURPLE}>
            {t('workbench.docs.diagrams.mock.dynRedacted')}
          </tspan>
          {' } }'}
        </tspan>,
      ]}
      arrowLabel={t('workbench.docs.diagrams.mock.dynamicArrow')}
      stamp={t('workbench.docs.diagrams.mock.dynamicStamp')}
    />
  );
};

export const MockWontApplyDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.mock.wontAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.wontFireKicker')}
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={116}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.mock.wontStatic')}
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.mock.wontStaticSub')}
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.mock.wontNav')}
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.mock.wontNavSub')}
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.shared.suggestion')}
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.mock.suggestionText')}
      </text>
    </svg>
  );
};

export const MockUseCasesDiagram: React.FC = () => {
  const t = useT();
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    {
      title: t('workbench.docs.diagrams.mock.caseOffline'),
      example: t('workbench.docs.diagrams.mock.caseOfflineEx'),
    },
    {
      title: t('workbench.docs.diagrams.mock.caseError'),
      example: t('workbench.docs.diagrams.mock.caseErrorEx'),
    },
    {
      title: t('workbench.docs.diagrams.mock.casePii'),
      example: t('workbench.docs.diagrams.mock.casePiiEx'),
    },
    {
      title: t('workbench.docs.diagrams.mock.caseEdge'),
      example: t('workbench.docs.diagrams.mock.caseEdgeEx'),
    },
  ];

  const CARD_W = 142;
  const CARD_H = 60;
  const CARD_X = [14, 164] as const;
  const CARD_Y_START = 36;
  const CARD_GAP = 12;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.mock.useCasesAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.useCasesKicker')}
      </text>

      {CARDS.map((card, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = CARD_X[col];
        const y = CARD_Y_START + row * (CARD_H + CARD_GAP);
        return (
          <g key={card.title}>
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            <rect x={x} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_PURPLE} />
            <circle cx={x + 16} cy={y + 16} r={8} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
            <text x={x + 16} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_PURPLE}>
              {i + 1}
            </text>
            <text x={x + 30} y={y + 19} fontSize={10} fontWeight={700} fill={TEXT}>
              {card.title}
            </text>
            <text x={x + 12} y={y + 40} fontSize={9} fill={TEXT}>
              {card.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={188} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.mock.useCasesFooter')}
      </text>
    </svg>
  );
};

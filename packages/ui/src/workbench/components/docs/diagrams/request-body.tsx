/**
 * Request Body — diagrams.
 *
 *   • RequestBodyInterceptDiagram   — pipeline overview (page.js → intercept
 *                                      → 3 transform shapes → network)
 *   • RequestBodyStaticDiagram      — fixed-string replacement
 *   • RequestBodyDynamicDiagram     — function(orig) → modified body
 *   • RequestBodyGraphqlDiagram     — JSON-field filter gating the rule
 *   • RequestBodyWontApplyDiagram   — GET/HEAD + static-resource gotchas
 *   • RequestBodyUseCasesDiagram    — common patterns at a glance
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  Box,
  FILL_BLUE,
  FILL_GREEN,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

export const RequestBodyInterceptDiagram: React.FC = () => {
  const t = useT();
  return (
    <svg
      viewBox="0 0 300 220"
      width="100%"
      style={{ maxWidth: 320 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.requestBody.interceptAria')}
    >
      <ArrowDefs id="bd-arrow" />
      <Box
        x={105}
        y={10}
        w={90}
        h={32}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        label="page.js"
        sub={t('workbench.docs.diagrams.requestBody.pageSub')}
      />
      <line x1="150" y1="42" x2="150" y2="58" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
      <Box
        x={75}
        y={60}
        w={150}
        h={36}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        label={t('workbench.docs.diagrams.requestBody.intercept')}
        sub={t('workbench.docs.diagrams.requestBody.interceptSub')}
      />
      <line x1="150" y1="96" x2="150" y2="112" stroke={STROKE} strokeWidth="1.5" />
      <line x1="60" y1="112" x2="240" y2="112" stroke={STROKE} strokeWidth="1.5" />
      <line x1="60" y1="112" x2="60" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
      <line x1="150" y1="112" x2="150" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
      <line x1="240" y1="112" x2="240" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
      <text x="60" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.branchStatic')}
      </text>
      <text x="60" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchStaticSub1')}
      </text>
      <text x="60" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchStaticSub2')}
      </text>
      <text x="150" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.branchDynamic')}
      </text>
      <text x="150" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchDynamicSub1')}
      </text>
      <text x="150" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchDynamicSub2')}
      </text>
      <text x="240" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
        GraphQL
      </text>
      <text x="240" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchGraphqlSub1')}
      </text>
      <text x="240" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.branchGraphqlSub2')}
      </text>
      <line x1="60" y1="170" x2="60" y2="180" stroke={STROKE} strokeWidth="1.5" />
      <line x1="150" y1="170" x2="150" y2="180" stroke={STROKE} strokeWidth="1.5" />
      <line x1="240" y1="170" x2="240" y2="180" stroke={STROKE} strokeWidth="1.5" />
      <line x1="60" y1="180" x2="240" y2="180" stroke={STROKE} strokeWidth="1.5" />
      <line x1="150" y1="180" x2="150" y2="192" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
      <Box
        x={105}
        y={194}
        w={90}
        h={22}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
        label={t('workbench.docs.diagrams.requestBody.realNetwork')}
      />
    </svg>
  );
};

// ─── Shared before/after card helper for body anchors ────────────

const STATE_X = 30;
const STATE_W = 260;
const BEFORE_Y = 70;
const ROW_H = 56;
const ARROW_Y_S = BEFORE_Y + ROW_H + 4;
const ARROW_Y_E = ARROW_Y_S + 22;
const AFTER_Y = ARROW_Y_E + 4;
const STAMP_Y = AFTER_Y + ROW_H + 22;

const RequestBodyCard: React.FC<{
  idSuffix: string;
  rule: string;
  beforeLines: React.ReactNode[];
  afterLines: React.ReactNode[];
  arrowLabel: string;
  stamp: string;
}> = ({ idSuffix, rule, beforeLines, afterLines, arrowLabel, stamp }) => {
  const t = useT();
  const ID = `bd-${idSuffix}`;
  return (
    <svg viewBox="0 0 320 240" width="100%" style={{ maxWidth: 360 }} role="img">
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.ruleKicker')}
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
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
        {t('workbench.docs.diagrams.requestBody.originalBodyKicker')}
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
        y1={ARROW_Y_S}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_Y_E}
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_Y_S + ARROW_Y_E) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_PURPLE}
      >
        {arrowLabel}
      </text>

      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={ROW_H} rx={5} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_PURPLE} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.requestBody.bodySentKicker')}
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

export const RequestBodyStaticDiagram: React.FC = () => {
  const t = useT();
  return (
    <RequestBodyCard
      idSuffix="st"
      rule={t('workbench.docs.diagrams.requestBody.ruleStatic')}
      beforeLines={[<tspan key="b">{'POST /api/save  body:'}</tspan>, <tspan key="b2">{'{ "userId": "abc" }'}</tspan>]}
      afterLines={[
        <tspan key="a">{'POST /api/save  body:'}</tspan>,
        <tspan key="a2" fontWeight={700} fill={STROKE_PURPLE}>
          {'{ "userId": "test-1" }'}
        </tspan>,
      ]}
      arrowLabel={t('workbench.docs.diagrams.requestBody.staticArrow')}
      stamp={t('workbench.docs.diagrams.requestBody.staticStamp')}
    />
  );
};

export const RequestBodyDynamicDiagram: React.FC = () => {
  const t = useT();
  return (
    <RequestBodyCard
      idSuffix="dyn"
      rule={t('workbench.docs.diagrams.requestBody.ruleDynamic')}
      beforeLines={[
        <tspan key="b">{'{ "userId": "abc" }'}</tspan>,
        <tspan key="b2" fontStyle="italic" fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.requestBody.fnReads')}
        </tspan>,
      ]}
      afterLines={[
        <tspan key="a">
          {'{ "userId": "abc", '}
          <tspan fontWeight={700} fill={STROKE_PURPLE}>
            {'"debug": true'}
          </tspan>
          {' }'}
        </tspan>,
      ]}
      arrowLabel={t('workbench.docs.diagrams.requestBody.dynamicArrow')}
      stamp={t('workbench.docs.diagrams.requestBody.dynamicStamp')}
    />
  );
};

export const RequestBodyGraphqlDiagram: React.FC = () => {
  const t = useT();
  const ID = 'bd-gql';
  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.requestBody.graphqlAria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.shared.ruleKicker')}
      </text>
      <rect x={20} y={22} width={280} height={36} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.ruleGraphql')}
      </text>
      <text x={160} y={51} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.ruleGraphqlAction')}
      </text>

      {/* Two scenarios side by side */}
      <text x={86} y={80} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_PURPLE}>
        {t('workbench.docs.diagrams.requestBody.match')}
      </text>
      <text x={86} y={94} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        operationName = GetUser
      </text>
      <rect
        x={14}
        y={104}
        width={144}
        height={50}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={20} y={120} fontFamily="monospace" fontSize={8} fill={TEXT}>
        {'{'}
      </text>
      <text x={28} y={132} fontFamily="monospace" fontSize={8} fill={TEXT}>
        {'"operationName":'}
      </text>
      <text x={28} y={144} fontFamily="monospace" fontSize={8} fontWeight={700} fill={STROKE_PURPLE}>
        {'  "GetUser", ...'}
      </text>
      <line x1={86} y1={158} x2={86} y2={178} stroke={STROKE_PURPLE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <rect x={14} y={180} width={144} height={32} rx={5} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={86} y={200} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.ruleFires')}
      </text>

      <text x={234} y={80} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.noMatch')}
      </text>
      <text x={234} y={94} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.noMatchSub')}
      </text>
      <rect
        x={162}
        y={104}
        width={144}
        height={50}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={168} y={120} fontFamily="monospace" fontSize={8} fill={TEXT}>
        {'{'}
      </text>
      <text x={176} y={132} fontFamily="monospace" fontSize={8} fill={TEXT}>
        {'"operationName":'}
      </text>
      <text x={176} y={144} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {'  "ListPosts", ...'}
      </text>
      <line
        x1={234}
        y1={158}
        x2={234}
        y2={178}
        stroke="var(--ant-color-border-secondary)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <rect
        x={162}
        y={180}
        width={144}
        height={32}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />
      <text x={234} y={200} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.passesThrough')}
      </text>

      <line x1={160} y1={74} x2={160} y2={216} stroke="var(--ant-color-border-secondary)" strokeDasharray="2 4" />

      <text x={160} y={234} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.graphqlStamp')}
      </text>
      <text x={160} y={248} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.graphqlStampSub')}
      </text>
    </svg>
  );
};

export const RequestBodyWontApplyDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.requestBody.wontApplyAria')}
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
        {t('workbench.docs.diagrams.requestBody.getHead')}
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.getHeadSub')}
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.staticResources')}
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestBody.staticResourcesSub')}
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.shared.suggestion')}
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.requestBody.suggestionText')}
      </text>
    </svg>
  );
};

export const RequestBodyUseCasesDiagram: React.FC = () => {
  const t = useT();
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    {
      title: t('workbench.docs.diagrams.requestBody.card1Title'),
      example: t('workbench.docs.diagrams.requestBody.card1Example'),
    },
    {
      title: t('workbench.docs.diagrams.requestBody.card2Title'),
      example: t('workbench.docs.diagrams.requestBody.card2Example'),
    },
    {
      title: t('workbench.docs.diagrams.requestBody.card3Title'),
      example: t('workbench.docs.diagrams.requestBody.card3Example'),
    },
    {
      title: t('workbench.docs.diagrams.requestBody.card4Title'),
      example: t('workbench.docs.diagrams.requestBody.card4Example'),
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
      aria-label={t('workbench.docs.diagrams.requestBody.useCasesAria')}
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
        {t('workbench.docs.diagrams.requestBody.useCasesFooter')}
      </text>
    </svg>
  );
};

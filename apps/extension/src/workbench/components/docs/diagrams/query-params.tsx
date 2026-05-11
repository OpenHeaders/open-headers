/**
 * Query Params — diagrams.
 *
 *   • QueryParamAddReplaceDiagram — adds if missing, replaces if present.
 *   • QueryParamReplaceOnlyDiagram — only replaces when present.
 *   • QueryParamRemoveDiagram — strips named params.
 *   • QueryParamRemoveAllDiagram — strips the whole query string.
 *   • QueryParamWontApplyDiagram — combining-with-Add/Replace gotcha.
 *   • QueryParamUseCasesDiagram — common patterns at a glance.
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  TEXT,
  TEXT_DIM,
} from './_shared';

const SHARED = {
  RULE_Y: 22,
  RULE_H: 22,
  STATE_X: 30,
  STATE_W: 260,
  ROW_H: 38,
  BEFORE_Y: 70,
};

const ARROW_Y_START = SHARED.BEFORE_Y + SHARED.ROW_H + 4;
const ARROW_Y_END = ARROW_Y_START + 22;
const AFTER_Y = ARROW_Y_END + 4;
const STAMP_Y = AFTER_Y + SHARED.ROW_H + 22;

/** Generic before → after card used by every operation. */
const BeforeAfterCards: React.FC<{
  idSuffix: string;
  rule: string;
  before: React.ReactNode;
  after: React.ReactNode;
  arrowLabel: string;
  stamp: string;
}> = ({ idSuffix, rule, before, after, arrowLabel, stamp }) => {
  const ID = `qp-${idSuffix}`;
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={SHARED.RULE_Y} width={280} height={SHARED.RULE_H} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={SHARED.RULE_Y + 15} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        {rule}
      </text>

      {/* BEFORE */}
      <rect
        x={SHARED.STATE_X}
        y={SHARED.BEFORE_Y}
        width={SHARED.STATE_W}
        height={SHARED.ROW_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={SHARED.STATE_X + 8} y={SHARED.BEFORE_Y + 13} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      <text x={SHARED.STATE_X + 10} y={SHARED.BEFORE_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        {before}
      </text>

      <line
        x1={SHARED.STATE_X + SHARED.STATE_W / 2}
        y1={ARROW_Y_START}
        x2={SHARED.STATE_X + SHARED.STATE_W / 2}
        y2={ARROW_Y_END}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={SHARED.STATE_X + SHARED.STATE_W / 2 + 12}
        y={(ARROW_Y_START + ARROW_Y_END) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_BLUE}
      >
        {arrowLabel}
      </text>

      {/* AFTER */}
      <rect
        x={SHARED.STATE_X}
        y={AFTER_Y}
        width={SHARED.STATE_W}
        height={SHARED.ROW_H}
        rx={5}
        fill={FILL_GREEN}
        stroke={STROKE_GREEN}
      />
      <text x={SHARED.STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        AFTER
      </text>
      <text x={SHARED.STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        {after}
      </text>

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {stamp}
      </text>
    </svg>
  );
};

export const QueryParamAddReplaceDiagram: React.FC = () => (
  <BeforeAfterCards
    idSuffix="add"
    rule="Add / Replace · debug = true"
    before={<>?page=1</>}
    after={
      <>
        ?page=1
        <tspan fontWeight={700} fill={STROKE_GREEN}>
          &debug=true
        </tspan>
      </>
    }
    arrowLabel="param added or replaced"
    stamp="Adds when missing, replaces when present."
  />
);

export const QueryParamReplaceOnlyDiagram: React.FC = () => {
  const ID = 'qp-rep';
  const TILE_W = 138;
  const LEFT_X = 14;
  const RIGHT_X = 168;
  const SCENARIO_LABEL_Y = 50;
  const SCENARIO_SUB_Y = 62;
  const BEFORE_Y = 74;
  const STATE_H = 34;
  const ARROW_Y_S = BEFORE_Y + STATE_H + 4;
  const ARROW_Y_E = ARROW_Y_S + 20;
  const AFTER_Y_T = ARROW_Y_E + 4;
  const STAMP = AFTER_Y_T + STATE_H + 24;

  const renderTile = (
    xOff: number,
    label: 'Present' | 'Absent',
    sub: string,
    beforeText: string,
    afterText: string,
    afterHighlight: boolean,
    arrowLabel: string,
  ) => (
    <g>
      <text x={xOff + TILE_W / 2} y={SCENARIO_LABEL_Y} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_BLUE}>
        {label}
      </text>
      <text x={xOff + TILE_W / 2} y={SCENARIO_SUB_Y} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {sub}
      </text>

      <rect
        x={xOff}
        y={BEFORE_Y}
        width={TILE_W}
        height={STATE_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={xOff + 6} y={BEFORE_Y + 12} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      <text x={xOff + 8} y={BEFORE_Y + 28} fontFamily="monospace" fontSize={9} fill={TEXT}>
        {beforeText}
      </text>

      <line
        x1={xOff + TILE_W / 2}
        y1={ARROW_Y_S}
        x2={xOff + TILE_W / 2}
        y2={ARROW_Y_E}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={xOff + TILE_W / 2 + 8} y={(ARROW_Y_S + ARROW_Y_E) / 2 + 2} fontSize={8} fontStyle="italic" fill={STROKE_BLUE}>
        {arrowLabel}
      </text>

      <rect
        x={xOff}
        y={AFTER_Y_T}
        width={TILE_W}
        height={STATE_H}
        rx={5}
        fill={afterHighlight ? FILL_GREEN : 'var(--ant-color-fill-secondary)'}
        stroke={afterHighlight ? STROKE_GREEN : 'var(--ant-color-border)'}
      />
      <text
        x={xOff + 6}
        y={AFTER_Y_T + 12}
        fontSize={8}
        fontWeight={700}
        fill={afterHighlight ? STROKE_GREEN : TEXT_DIM}
        letterSpacing={0.5}
      >
        AFTER
      </text>
      <text
        x={xOff + 8}
        y={AFTER_Y_T + 28}
        fontFamily="monospace"
        fontSize={9}
        fontWeight={afterHighlight ? 700 : 400}
        fill={afterHighlight ? STROKE_GREEN : TEXT}
      >
        {afterText}
      </text>
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Replace only — replaces existing query param values, but leaves URLs without the param untouched."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Replace only · region = eu
      </text>

      {renderTile(LEFT_X, 'Present', 'param already there', '?region=us', '?region=eu', true, 'value replaced')}
      {renderTile(RIGHT_X, 'Absent', 'no region param', '?page=1', '?page=1', false, 'unchanged')}

      <line x1={160} y1={SCENARIO_LABEL_Y - 8} x2={160} y2={AFTER_Y_T + STATE_H + 4} stroke="var(--ant-color-border-secondary)" strokeDasharray="2 4" />

      <text x={160} y={STAMP} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Replaces, never adds — URLs without the param pass through.
      </text>
    </svg>
  );
};

export const QueryParamRemoveDiagram: React.FC = () => (
  <BeforeAfterCards
    idSuffix="rem"
    rule="Remove · utm_source"
    before={
      <>
        ?
        <tspan fontWeight={700} fill="var(--ant-color-error)" textDecoration="line-through">
          utm_source=google
        </tspan>
        &page=1
      </>
    }
    after={<>?page=1</>}
    arrowLabel="param stripped"
    stamp="Named param removed; everything else passes through."
  />
);

export const QueryParamRemoveAllDiagram: React.FC = () => (
  <BeforeAfterCards
    idSuffix="rma"
    rule="Remove All"
    before={<>?utm_source=google&page=1&debug=true</>}
    after={
      <tspan fontStyle="italic" fill={TEXT_DIM}>
        (no query string)
      </tspan>
    }
    arrowLabel="entire query stripped"
    stamp="Whole query string removed in one step."
  />
);

export const QueryParamWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 140"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Query Params gotcha — Remove All can't be combined with Add/Replace in the same rule."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHAT TO WATCH FOR
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={100}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        Combining Remove All with Add / Replace
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        DNR rejects rules that strip the whole query and add new params.
      </text>

      <text x={28} y={88} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={88} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={102} fontSize={9} fill={TEXT}>
        Use two rules — Remove All first, then Add / Replace.
      </text>
      <text x={48} y={116} fontSize={9} fill={TEXT_DIM}>
        Rule order matters; both must match the same request.
      </text>
    </svg>
  );
};

export const QueryParamUseCasesDiagram: React.FC = () => {
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'Force a flag', example: 'Add debug=true everywhere' },
    { title: 'Canonicalize', example: 'Replace region only if present' },
    { title: 'Strip trackers', example: 'Remove utm_source, utm_medium' },
    { title: 'Privacy mode', example: 'Remove All on outgoing fetches' },
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
      aria-label="Query Params — common use cases: force a flag, canonicalize a value, strip trackers, privacy-mode strip-all."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        COMMON USE CASES
      </text>

      {CARDS.map((card, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = CARD_X[col];
        const y = CARD_Y_START + row * (CARD_H + CARD_GAP);
        return (
          <g key={card.title}>
            <rect x={x} y={y} width={CARD_W} height={CARD_H} rx={5} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
            <rect x={x} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_BLUE} />
            <circle cx={x + 16} cy={y + 16} r={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={x + 16} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_BLUE}>
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
        Pair with URL Pattern or Domains to scope to specific routes.
      </text>
    </svg>
  );
};

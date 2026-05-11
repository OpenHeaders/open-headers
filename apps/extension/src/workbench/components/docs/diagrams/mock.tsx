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

export const MockFlowDiagram: React.FC = () => (
  <svg
    viewBox="0 0 300 240"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Static skips the network entirely; Dynamic hits it first, then transforms the real response."
  >
    <ArrowDefs id="mk-arrow" />
    <text x="75" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      Static
    </text>
    <text x="225" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      Dynamic
    </text>
    <Box x={20} y={22} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="fetch('/api')" />
    <Box x={170} y={22} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="fetch('/api')" />
    <line x1="75" y1="48" x2="75" y2="62" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <line x1="225" y1="48" x2="225" y2="62" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <Box x={20} y={64} w={110} h={26} fill={FILL_PURPLE} stroke={STROKE_PURPLE} label="Intercept" />
    <Box x={170} y={64} w={110} h={26} fill={FILL_PURPLE} stroke={STROKE_PURPLE} label="Intercept" />
    <line x1="75" y1="90" x2="75" y2="108" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <text x="75" y="125" textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      (real network
    </text>
    <text x="75" y="136" textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      never hit)
    </text>
    <line x1="225" y1="90" x2="225" y2="108" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <Box
      x={170}
      y={110}
      w={110}
      h={26}
      fill={FILL_ORANGE}
      stroke={STROKE_ORANGE}
      label="real network"
      sub="real response"
    />
    <line x1="225" y1="146" x2="225" y2="160" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <Box x={20} y={148} w={110} h={26} fill={FILL_GREEN} stroke={STROKE_GREEN} label="synthetic body" />
    <line x1="75" y1="174" x2="75" y2="188" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <Box x={170} y={162} w={110} h={26} fill={FILL_GREEN} stroke={STROKE_GREEN} label="fn(response)" />
    <line x1="225" y1="188" x2="225" y2="202" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#mk-arrow)" />
    <Box x={20} y={190} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="page receives" />
    <Box x={170} y={204} w={110} h={26} fill={FILL_BLUE} stroke={STROKE_BLUE} label="page receives" />
  </svg>
);

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
  const ID = `mk-${idSuffix}`;
  return (
    <svg viewBox="0 0 320 240" width="100%" style={{ maxWidth: 360 }} role="img">
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={RULE_Y} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={RULE_Y + 15} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
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
        <text
          key={`a-${i}`}
          x={STATE_X + 10}
          y={AFTER_Y + 30 + i * 14}
          fontFamily="monospace"
          fontSize={9}
          fill={TEXT}
        >
          {line}
        </text>
      ))}

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {stamp}
      </text>
    </svg>
  );
};

export const MockStaticDiagram: React.FC = () => (
  <MockCard
    idSuffix="st"
    rule='Static response: 200 { "users": [] }'
    beforeTitle="REAL NETWORK"
    beforeLines={[
      <tspan key="b" fontStyle="italic" fill={TEXT_DIM}>
        (never reached)
      </tspan>,
      <tspan key="b2" fontStyle="italic" fill={TEXT_DIM}>
        — request short-circuited
      </tspan>,
    ]}
    afterTitle="PAGE RECEIVES"
    afterLines={[
      <tspan key="a">{'200 OK · Content-Type: application/json'}</tspan>,
      <tspan key="a2" fontWeight={700} fill={STROKE_PURPLE}>
        {'{ "users": [] }'}
      </tspan>,
    ]}
    arrowLabel="synthetic response served"
    stamp="Fixed body + status + headers — server is never contacted."
  />
);

export const MockDynamicDiagram: React.FC = () => (
  <MockCard
    idSuffix="dyn"
    rule="Dynamic response: redact PII fields"
    beforeTitle="REAL RESPONSE"
    beforeLines={[
      <tspan key="b">{'{ "user":'}</tspan>,
      <tspan key="b2">{'  { "email": "alice@openheaders.io" } }'}</tspan>,
    ]}
    afterTitle="PAGE RECEIVES"
    afterLines={[
      <tspan key="a">{'{ "user":'}</tspan>,
      <tspan key="a2">
        {'  { "email": '}
        <tspan fontWeight={700} fill={STROKE_PURPLE}>
          "[redacted]"
        </tspan>
        {' } }'}
      </tspan>,
    ]}
    arrowLabel="fn(real response) →"
    stamp="Real call still happens; your function rewrites the body."
  />
);

export const MockWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Mocks only intercept JS-initiated fetch / XHR — static resources flow through unchanged. Use a real local proxy for sub-resource fixtures."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHEN IT DOESN'T FIRE
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
        Static resources (img, script, link)
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Browser-issued — never touch fetch / XHR.
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        Page navigations
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Top-level HTML loads bypass the script engine entirely.
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        Use a real local proxy for sub-resource fixtures.
      </text>
    </svg>
  );
};

export const MockUseCasesDiagram: React.FC = () => {
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'Offline dev', example: 'Stub the whole API' },
    { title: 'Error simulation', example: 'Force 500 on one route' },
    { title: 'PII redaction', example: 'Mask emails on the wire' },
    { title: 'Edge cases', example: 'Empty arrays, huge payloads' },
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
      aria-label="Response Body + Status — common use cases: offline dev, error simulation, PII redaction, edge-case payload shapes."
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
        Static = fixture mode · Dynamic = real-call passthrough + edit.
      </text>
    </svg>
  );
};

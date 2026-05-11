/**
 * Block — diagrams.
 *
 *   • BlockDiagram — visualises the cancellation: a matched request
 *     is killed before it leaves Chrome's network stack, and the
 *     page sees it fail as if the server were unreachable.
 *   • BlockWontApplyDiagram — the "already in flight / already
 *     loaded" gotcha. Rule edits don't retro-cancel resources the
 *     page has already fetched; reload to pick up the new rule.
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

export const BlockDiagram: React.FC = () => {
  const ID = 'bl';
  const errColor = 'var(--ant-color-error)';
  const errBg = 'var(--ant-color-error-bg)';
  const errBorder = 'var(--ant-color-error-border)';

  const RULE_Y = 22;
  const RULE_H = 22;
  const FLOW_Y = 70;
  const FLOW_H = 60;

  const PAGE_X = 14;
  const PAGE_W = 90;
  const NET_X = 216;
  const NET_W = 90;

  // Push outcomes further down so the "DNR block" caption beneath
  // the ✗ badge doesn't collide with the "WHAT THE PAGE SEES"
  // header that introduces the outcome row.
  const OUTCOMES_Y = FLOW_Y + FLOW_H + 56;
  const OUTCOME_H = 56;
  const OUTCOME_W = 142;

  return (
    <svg
      viewBox="0 0 320 274"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Block cancels matching requests at the network layer — the page sees a network error. main_frame blocks render ERR_BLOCKED_BY_CLIENT; sub-resource blocks fail silently."
    >
      <ArrowDefs id={ID} />

      {/* Rule banner */}
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={RULE_Y} width={280} height={RULE_H} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={RULE_Y + 15} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Block · Request Domains: ads.openheaders.io
      </text>

      {/* Flow row — Page → ✗ intercept → Network */}
      {/* Page card */}
      <rect x={PAGE_X} y={FLOW_Y} width={PAGE_W} height={FLOW_H} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={PAGE_X} y={FLOW_Y} width={PAGE_W} height={14} rx={5} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={PAGE_X + PAGE_W / 2} y={FLOW_Y + 10} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Page
      </text>
      <text x={PAGE_X + PAGE_W / 2} y={FLOW_Y + 32} textAnchor="middle" fontFamily="monospace" fontSize={9} fill={TEXT}>
        fetch()
      </text>
      <text x={PAGE_X + PAGE_W / 2} y={FLOW_Y + 46} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        ads.openheaders.io
      </text>

      {/* Arrow toward middle */}
      <line
        x1={PAGE_X + PAGE_W}
        y1={FLOW_Y + FLOW_H / 2}
        x2={140}
        y2={FLOW_Y + FLOW_H / 2}
        stroke={STROKE}
        strokeWidth={1.5}
      />

      {/* X intercept badge in the middle */}
      <circle cx={160} cy={FLOW_Y + FLOW_H / 2} r={16} fill={errBg} stroke={errBorder} strokeWidth={1.5} />
      <line x1={152} y1={FLOW_Y + FLOW_H / 2 - 8} x2={168} y2={FLOW_Y + FLOW_H / 2 + 8} stroke={errColor} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={168} y1={FLOW_Y + FLOW_H / 2 - 8} x2={152} y2={FLOW_Y + FLOW_H / 2 + 8} stroke={errColor} strokeWidth={2.2} strokeLinecap="round" />
      <text x={160} y={FLOW_Y + FLOW_H + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill={errColor}>
        DNR block
      </text>

      {/* Dashed line continuing toward Network (cancelled) */}
      <line
        x1={180}
        y1={FLOW_Y + FLOW_H / 2}
        x2={NET_X}
        y2={FLOW_Y + FLOW_H / 2}
        stroke={errBorder}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />

      {/* Network card — dimmed, unreached */}
      <rect
        x={NET_X}
        y={FLOW_Y}
        width={NET_W}
        height={FLOW_H}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />
      <text x={NET_X + NET_W / 2} y={FLOW_Y + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        Network
      </text>
      <text x={NET_X + NET_W / 2} y={FLOW_Y + 36} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        never reached
      </text>
      <text x={NET_X + NET_W / 2} y={FLOW_Y + 50} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        request cancelled
      </text>

      {/* Outcome cards — what the user sees */}
      <text x={160} y={OUTCOMES_Y - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHAT THE PAGE SEES
      </text>

      {/* main_frame outcome */}
      <rect x={14} y={OUTCOMES_Y} width={OUTCOME_W} height={OUTCOME_H} rx={5} fill="var(--ant-color-bg-container)" stroke={errBorder} />
      <rect x={14} y={OUTCOMES_Y} width={OUTCOME_W} height={16} rx={5} fill={errBg} stroke={errBorder} />
      <text x={14 + OUTCOME_W / 2} y={OUTCOMES_Y + 12} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={errColor}>
        main_frame
      </text>
      <text x={14 + OUTCOME_W / 2} y={OUTCOMES_Y + 32} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        ERR_BLOCKED_BY_CLIENT
      </text>
      <text x={14 + OUTCOME_W / 2} y={OUTCOMES_Y + 46} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        Chrome's block page
      </text>

      {/* sub-resource outcome */}
      <rect x={164} y={OUTCOMES_Y} width={OUTCOME_W} height={OUTCOME_H} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE_GREEN} />
      <rect x={164} y={OUTCOMES_Y} width={OUTCOME_W} height={16} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={164 + OUTCOME_W / 2} y={OUTCOMES_Y + 12} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_GREEN}>
        sub-resource
      </text>
      <text x={164 + OUTCOME_W / 2} y={OUTCOMES_Y + 32} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Silent failure
      </text>
      <text x={164 + OUTCOME_W / 2} y={OUTCOMES_Y + 46} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        page handles its own error
      </text>
    </svg>
  );
};

/**
 * Block — common use cases at a glance. Four cards in a 2×2 grid,
 * each pairing a short title with a concrete one-line example so
 * users can recognise their own intent without reading prose.
 */
export const BlockUseCasesDiagram: React.FC = () => {
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'Ads & trackers', example: 'Block ads.openheaders.io' },
    { title: 'Outage simulation', example: 'Take a host offline to test' },
    { title: 'Endpoint denial', example: 'Block /api/admin only' },
    { title: 'Page-only block', example: 'Add main_frame condition' },
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
      aria-label="Block — common use cases: ads & trackers, outage simulation, endpoint denial, and page-only block."
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
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            {/* Accent stripe on the left edge */}
            <rect x={x} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_BLUE} />
            {/* Numbered badge */}
            <circle cx={x + 16} cy={y + 16} r={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={x + 16} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_BLUE}>
              {i + 1}
            </text>
            {/* Title */}
            <text x={x + 30} y={y + 19} fontSize={10} fontWeight={700} fill={TEXT}>
              {card.title}
            </text>
            {/* Example */}
            <text x={x + 12} y={y + 40} fontSize={9} fill={TEXT}>
              {card.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={188} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Pair Block with Conditions to scope it down.
      </text>
    </svg>
  );
};

export const BlockWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 120"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Block doesn't retro-cancel already-loaded resources. Reload the page after enabling the rule to catch future requests."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHEN IT DOESN'T FIRE
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={80}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        Already-loaded resources
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Only future requests are intercepted — past ones stay loaded.
      </text>

      <text x={28} y={88} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={88} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={102} fontSize={9} fill={TEXT}>
        Reload the page after enabling the rule.
      </text>
    </svg>
  );
};

/**
 * Delay — diagrams.
 *
 *   • DelayRoutingDiagram     — three lanes for three request kinds
 *   • DelayNavDiagram         — document / iframe nav goes via the
 *                                local waiting page
 *   • DelayXhrDiagram         — JS-initiated fetch/XHR delayed inside
 *                                a monkey-patched setTimeout
 *   • DelayWontApplyDiagram   — service-worker + sub-resource gotchas
 *   • DelayUseCasesDiagram    — common patterns at a glance
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

export const DelayRoutingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 200"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Delay routing across navigation, fetch, and sub-resource lanes — only the first two are intercepted, sub-resources pass through."
  >
    <ArrowDefs id="dl-arrow" />
    <Box x={95} y={10} w={90} h={32} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Matched request" />
    <line x1="140" y1="42" x2="140" y2="58" stroke={STROKE} strokeWidth="1.5" />
    <line x1="40" y1="58" x2="240" y2="58" stroke={STROKE} strokeWidth="1.5" />
    <line x1="40" y1="58" x2="40" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <line x1="140" y1="58" x2="140" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <line x1="240" y1="58" x2="240" y2="74" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
    <Box x={5} y={76} w={70} h={40} fill={FILL_GREEN} stroke={STROKE_GREEN} label="Document" sub="iframe nav" />
    <text x={40} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      ≤ 30,000 ms
    </text>
    <text x={40} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      via waiting page
    </text>
    <Box
      x={105}
      y={76}
      w={70}
      h={40}
      fill={FILL_PURPLE}
      stroke={STROKE_PURPLE}
      label="Fetch / XHR"
      sub="JS-initiated"
    />
    <text x={140} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      ≤ 5,000 ms
    </text>
    <text x={140} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      monkey-patched
    </text>
    <Box
      x={205}
      y={76}
      w={70}
      h={40}
      fill="var(--ant-color-fill-secondary)"
      stroke={STROKE}
      label="Sub-resource"
      sub="img / css / js"
    />
    <text x={240} y={130} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--ant-color-error)">
      not delayed
    </text>
    <text x={240} y={143} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      passes through
    </text>
    <text x={140} y={180} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      Higher caps require a real local proxy
    </text>
  </svg>
);

/**
 * Document / iframe navigation delay — the user clicks a link, but
 * instead of going straight to the target, the browser is redirected
 * to a local waiting page that holds for N ms before forwarding to
 * the real URL.
 */
export const DelayNavDiagram: React.FC = () => {
  const ID = 'dl-nav';
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Navigation delay — the browser is redirected to a local waiting page that holds for N ms before forwarding to the real target URL."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Delay 8,000 ms · page navigation
      </text>

      {/* Click */}
      <rect x={10} y={68} width={70} height={40} rx={5} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={45} y={84} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Click
      </text>
      <text x={45} y={98} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        /target
      </text>

      <line x1={80} y1={88} x2={108} y2={88} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Waiting page */}
      <rect x={110} y={64} width={100} height={48} rx={5} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={160} y={80} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Waiting page
      </text>
      <text x={160} y={92} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        chrome-extension://…/wait
      </text>
      <text x={160} y={104} textAnchor="middle" fontSize={9} fontWeight={700} fill={STROKE_ORANGE}>
        ⏱ holds 8s
      </text>

      <line x1={210} y1={88} x2={238} y2={88} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Target page */}
      <rect x={240} y={68} width={70} height={40} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={275} y={84} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        /target
      </text>
      <text x={275} y={98} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        loads now
      </text>

      <text x={160} y={138} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Honored up to 30,000 ms — Chrome's redirect ceiling.
      </text>
      <text x={160} y={154} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Implemented as a DNR redirect to a local waiting page.
      </text>
    </svg>
  );
};

/**
 * JS-initiated fetch / XHR delay — the rule is implemented by a
 * monkey-patched setTimeout that holds the resolution of the call.
 * Capped at 5s to avoid starving Chrome's HTTP connection pool.
 */
export const DelayXhrDiagram: React.FC = () => {
  const ID = 'dl-xhr';
  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="JS-initiated fetch/XHR delay — a monkey-patched setTimeout holds the resolution. Capped at 5000ms."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={22} width={280} height={22} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={160} y={37} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Delay 3,000 ms · JS fetch / XHR
      </text>

      {/* Three lifelines */}
      <text x={40} y={64} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        page.js
      </text>
      <text x={160} y={64} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        intercept
      </text>
      <text x={280} y={64} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        network
      </text>

      <line x1={40} y1={70} x2={40} y2={190} stroke={STROKE} strokeDasharray="2 3" />
      <line x1={160} y1={70} x2={160} y2={190} stroke={STROKE} strokeDasharray="2 3" />
      <line x1={280} y1={70} x2={280} y2={190} stroke={STROKE} strokeDasharray="2 3" />

      {/* call out */}
      <line x1={40} y1={86} x2={158} y2={86} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={100} y={82} textAnchor="middle" fontSize={9} fill={TEXT}>
        fetch()
      </text>

      {/* Intercept holds */}
      <rect x={150} y={86} width={20} height={66} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={186} y={112} fontSize={9} fontStyle="italic" fill={STROKE_PURPLE}>
        setTimeout
      </text>
      <text x={186} y={125} fontSize={9} fontStyle="italic" fill={STROKE_PURPLE}>
        3,000 ms hold
      </text>

      {/* Forwarded to network */}
      <line x1={170} y1={152} x2={278} y2={152} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={224} y={148} textAnchor="middle" fontSize={9} fill={TEXT}>
        real request
      </text>

      {/* Response */}
      <line
        x1={280}
        y1={172}
        x2={42}
        y2={172}
        stroke={STROKE}
        strokeWidth={1.2}
        strokeDasharray="3 2"
        markerEnd={`url(#${ID})`}
      />
      <text x={160} y={168} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        response (delayed by 3s)
      </text>

      <text x={160} y={206} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Capped at 5,000 ms — values above are clamped on the wire.
      </text>
    </svg>
  );
};

export const DelayWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Delay doesn't apply to sub-resources (img/css/js) or service-worker fetches that bypass the page-level monkey-patch."
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
        Sub-resources (img, css, js, fonts)
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Browser issues these — no monkey-patch can hold them.
      </text>

      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        Service-worker fetches
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Run in a different scope; page-level patches don't reach them.
      </text>

      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        Sub-resource throttling lands with the desktop app soon.
      </text>
    </svg>
  );
};

export const DelayUseCasesDiagram: React.FC = () => {
  type Card = { title: string; example: string };
  const CARDS: Card[] = [
    { title: 'Loading states', example: 'Show spinners reliably' },
    { title: 'Debounce checks', example: 'Test typing throttles' },
    { title: 'Race conditions', example: 'Surface request orders' },
    { title: 'Slow network sim', example: 'Approx 3G-ish latency' },
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
      aria-label="Delay — common use cases: loading-state QA, debounce testing, race-condition surfacing, slow-network simulation."
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
        Static resources need a real proxy — extensions can't hold them.
      </text>
    </svg>
  );
};

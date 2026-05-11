/**
 * Pending diagrams — these belong to sections we haven't redone yet.
 * Each will move into its own per-section file (e.g.
 * `header-actions.tsx`) when we revisit the corresponding section.
 *
 * Until then, they live here so `index.ts` can re-export them and the
 * sections that already use them keep working unchanged.
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

// ── Inject timing relative to page parse ─────────────────────────

export const InjectTimingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 140"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Inject script insertion timing diagram"
  >
    <ArrowDefs id="inj-arrow" />
    <line x1="20" y1="80" x2="260" y2="80" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#inj-arrow)" />
    <text x={260} y={94} textAnchor="end" fontSize="9" fill={TEXT_DIM}>
      time →
    </text>
    <circle cx="60" cy="80" r="3" fill={STROKE} />
    <text x={60} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      navigation
    </text>
    <circle cx="140" cy="80" r="3" fill={STROKE} />
    <text x={140} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM parsed
    </text>
    <circle cx="220" cy="80" r="3" fill={STROKE} />
    <text x={220} y={100} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      load event
    </text>
    <rect x={50} y={30} width={50} height={30} rx={4} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
    <text x={75} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      ASAP
    </text>
    <text x={75} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      pre-page-script
    </text>
    <rect x={205} y={30} width={50} height={30} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
    <text x={230} y={48} textAnchor="middle" fontSize="10" fontWeight="600" fill={TEXT}>
      After Load
    </text>
    <text x={230} y={20} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      DOM-safe
    </text>
    <line x1="75" y1="60" x2="60" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <line x1="230" y1="60" x2="220" y2="78" stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" />
    <text x={140} y={130} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
      Pick ASAP to win monkey-patch races; After Load for DOM reads
    </text>
  </svg>
);

// ── Delay routing ────────────────────────────────────────────────

export const DelayRoutingDiagram: React.FC = () => (
  <svg
    viewBox="0 0 280 200"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Delay routing across navigation, fetch, and sub-resource lanes"
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

// ── Header operations comparison ─────────────────────────────────

/**
 * Hero diagram for the Header Actions section. Reads as a single
 * "story": one starting header, four operations, four different
 * outcomes. Each row pairs the operation name + engine pill with a
 * side-by-side before → after that highlights what changed:
 *   • Added value:   bold + green tinted background
 *   • Removed value: strikethrough + dimmed
 *   • Concatenated:  bold separator + appended value highlighted
 * Locked color contract preserved (blue=DNR, purple=Script).
 */
export const HeaderOpsDiagram: React.FC = () => {
  const ID = 'hop';
  const BEFORE = 'Cookie: a=1';

  type Op = {
    name: string;
    engine: 'DNR' | 'Script';
    after: React.ReactNode;
  };

  const OPS: Op[] = [
    {
      name: 'Override',
      engine: 'DNR',
      // Cookie: a=1 → Cookie: Z
      after: (
        <tspan>
          Cookie:{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            Z
          </tspan>
        </tspan>
      ),
    },
    {
      name: 'Append',
      engine: 'DNR',
      // Cookie: a=1 (kept) PLUS a second Cookie: Z (duplicate row)
      after: (
        <tspan>
          a=1 ·{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            +Cookie: Z
          </tspan>
        </tspan>
      ),
    },
    {
      name: 'Remove',
      engine: 'DNR',
      after: (
        <tspan fontStyle="italic" fill={TEXT_DIM}>
          (header gone)
        </tspan>
      ),
    },
    {
      name: 'Merge',
      engine: 'Script',
      // Cookie: a=1 + new=val → Cookie: a=1; new=val
      after: (
        <tspan>
          Cookie: a=1
          <tspan fontWeight={700} fill={STROKE_PURPLE}>
            ; new=val
          </tspan>
        </tspan>
      ),
    },
  ];

  // Layout geometry
  const HEADER_Y = 16;
  const BEFORE_BOX_X = 80;
  const BEFORE_BOX_Y = 26;
  const BEFORE_BOX_W = 160;
  const BEFORE_BOX_H = 28;

  const ROW_Y0 = 84;
  const ROW_H = 40;
  const ROW_GAP = 8;
  const ROW_X = 10;
  const ROW_W = 300;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Four header operations applied to the same starting header — Override replaces, Append adds duplicate, Remove deletes, Merge concatenates."
    >
      <ArrowDefs id={ID} />

      {/* Top: starting header */}
      <text x={160} y={HEADER_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Same starting header → four outcomes
      </text>
      <rect
        x={BEFORE_BOX_X}
        y={BEFORE_BOX_Y}
        width={BEFORE_BOX_W}
        height={BEFORE_BOX_H}
        rx={4}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={BEFORE_BOX_X + BEFORE_BOX_W / 2} y={BEFORE_BOX_Y + 12} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      <text
        x={BEFORE_BOX_X + BEFORE_BOX_W / 2}
        y={BEFORE_BOX_Y + 24}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT}
      >
        {BEFORE}
      </text>

      {/* Vertical connector down to the rows */}
      <line
        x1={160}
        y1={BEFORE_BOX_Y + BEFORE_BOX_H}
        x2={160}
        y2={ROW_Y0 - 6}
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <line x1={160} y1={ROW_Y0 - 6} x2={160} y2={ROW_Y0 - 2} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Four operation rows */}
      {OPS.map((op, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const isScript = op.engine === 'Script';
        const accent = isScript ? STROKE_PURPLE : STROKE_BLUE;
        const accentFill = isScript ? FILL_PURPLE : FILL_BLUE;
        return (
          <g key={op.name}>
            {/* Row card */}
            <rect
              x={ROW_X}
              y={y}
              width={ROW_W}
              height={ROW_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            {/* Left band — operation name + engine tag */}
            <rect x={ROW_X} y={y} width={102} height={ROW_H} rx={5} fill={accentFill} stroke={accent} />
            <text x={ROW_X + 12} y={y + 17} fontSize={11} fontWeight={700} fill={TEXT}>
              {op.name}
            </text>
            <rect x={ROW_X + 12} y={y + 22} width={42} height={12} rx={3} fill="var(--ant-color-bg-container)" stroke={accent} />
            <text x={ROW_X + 33} y={y + 31} textAnchor="middle" fontSize={8} fontWeight={700} fill={accent}>
              {op.engine}
            </text>

            {/* Arrow connecting left band to outcome */}
            <line
              x1={ROW_X + 102 + 4}
              y1={y + ROW_H / 2}
              x2={ROW_X + 130}
              y2={y + ROW_H / 2}
              stroke={accent}
              strokeWidth={1.5}
              markerEnd={`url(#${ID})`}
            />

            {/* Right side — AFTER value with diff highlights */}
            <text
              x={ROW_X + 138}
              y={y + ROW_H / 2 + 4}
              fontFamily="monospace"
              fontSize={10}
              fill={TEXT}
            >
              {op.after}
            </text>
          </g>
        );
      })}

      {/* Legend at bottom */}
      <g transform={`translate(0, ${ROW_Y0 + 4 * (ROW_H + ROW_GAP) + 8})`}>
        <rect x={ROW_X} y={0} width={12} height={12} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={ROW_X + 18} y={9} fontSize={9} fill={TEXT_DIM}>
          DNR — native, applied by Chrome
        </text>
        <rect x={ROW_X} y={16} width={12} height={12} rx={2} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
        <text x={ROW_X + 18} y={25} fontSize={9} fill={TEXT_DIM}>
          Script — patched fetch / XHR (Merge only)
        </text>
      </g>
    </svg>
  );
};

// ── Request-body interception ────────────────────────────────────

export const BodyInterceptDiagram: React.FC = () => (
  <svg
    viewBox="0 0 300 220"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Request body interception pipeline"
  >
    <ArrowDefs id="bd-arrow" />
    <Box x={105} y={10} w={90} h={32} fill={FILL_BLUE} stroke={STROKE_BLUE} label="page.js" sub="fetch / XHR call" />
    <line x1="150" y1="42" x2="150" y2="58" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
    <Box
      x={75}
      y={60}
      w={150}
      h={36}
      fill={FILL_PURPLE}
      stroke={STROKE_PURPLE}
      label="Intercept"
      sub="extension monkey-patch"
    />
    <line x1="150" y1="96" x2="150" y2="112" stroke={STROKE} strokeWidth="1.5" />
    <line x1="60" y1="112" x2="240" y2="112" stroke={STROKE} strokeWidth="1.5" />
    <line x1="60" y1="112" x2="60" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
    <line x1="150" y1="112" x2="150" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
    <line x1="240" y1="112" x2="240" y2="125" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
    <text x="60" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      Static
    </text>
    <text x="60" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      replace body
    </text>
    <text x="60" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      wholesale
    </text>
    <text x="150" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      Dynamic
    </text>
    <text x="150" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      fn(orig) →
    </text>
    <text x="150" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      modified body
    </text>
    <text x="240" y="138" textAnchor="middle" fontSize="9" fontWeight="600" fill={TEXT}>
      GraphQL
    </text>
    <text x="240" y="150" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      match op? →
    </text>
    <text x="240" y="160" textAnchor="middle" fontSize="8" fill={TEXT_DIM}>
      apply : skip
    </text>
    <line x1="60" y1="170" x2="60" y2="180" stroke={STROKE} strokeWidth="1.5" />
    <line x1="150" y1="170" x2="150" y2="180" stroke={STROKE} strokeWidth="1.5" />
    <line x1="240" y1="170" x2="240" y2="180" stroke={STROKE} strokeWidth="1.5" />
    <line x1="60" y1="180" x2="240" y2="180" stroke={STROKE} strokeWidth="1.5" />
    <line x1="150" y1="180" x2="150" y2="192" stroke={STROKE} strokeWidth="1.5" markerEnd="url(#bd-arrow)" />
    <Box x={105} y={194} w={90} h={22} fill={FILL_GREEN} stroke={STROKE_GREEN} label="real network" />
  </svg>
);

// ── Mock — static vs dynamic flow ────────────────────────────────

export const MockFlowDiagram: React.FC = () => (
  <svg
    viewBox="0 0 300 240"
    width="100%"
    style={{ maxWidth: 320 }}
    role="img"
    aria-label="Mock responses — static vs dynamic, real network hit or skipped"
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
